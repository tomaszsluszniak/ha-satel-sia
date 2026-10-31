"""Helper functions for the Satel SIA integration."""

from datetime import datetime, timedelta
from typing import Any

from .pysiaalarm import SIAEvent
from .pysiaalarm.utils import MessageTypes

from homeassistant.util.dt import utcnow

from .const import (
    ATTR_CODE,
    ATTR_ID,
    ATTR_MESSAGE,
    ATTR_PI,
    ATTR_SATEL_NUMBER,
    ATTR_SATEL_PARTITION,
    ATTR_SATEL_SOURCE,
    ATTR_TIMESTAMP,
    ATTR_ZONE,
    KEY_ALARM,
    SATEL_NAME_LENGTH,
    SIA_HUB_ZONE,
)

PING_INTERVAL_MARGIN = 30


def get_unique_id_and_name(
    entry_id: str,
    port: int,
    account: str,
    zone: int,
    entity_key: str,
) -> tuple[str, str]:
    """Return the unique_id and name for an entity."""
    return (
        (
            f"{entry_id}_{account}_{zone}"
            if entity_key == KEY_ALARM
            else f"{entry_id}_{account}_{zone}_{entity_key}"
        ),
        (
            f"{port} - {account} - {entity_key}"
            if zone == SIA_HUB_ZONE
            else f"{port} - {account} - zone {zone} - {entity_key}"
        ),
    )


def get_unavailability_interval(ping: int) -> float:
    """Return the interval to the next unavailability check."""
    return timedelta(minutes=ping, seconds=PING_INTERVAL_MARGIN).total_seconds()


def parse_satel_message(message: str | None) -> dict[str, str | None]:
    """Split a Satel SIA message into number and names.

    With "SIA - send partition name" and "SIA - send source name" enabled,
    Satel panels append an ASCII block to the event: ``2^Garage          John            ^``
    i.e. the number (user / input / module), then the partition name and
    the source name (user / input / module), each padded to 16 characters.
    """
    result: dict[str, str | None] = {
        "number": None,
        "partition_name": None,
        "source_name": None,
    }
    if not message:
        return result
    number, sep, rest = message.partition("^")
    result["number"] = number.strip() or None
    if not sep:
        return result
    names = rest.split("^", 1)[0]
    partition = names[:SATEL_NAME_LENGTH].strip()
    source = names[SATEL_NAME_LENGTH:].strip()
    if len(names) <= SATEL_NAME_LENGTH and not source:
        # Only one name block was sent; it is the source name
        partition, source = "", partition
    result["partition_name"] = partition or None
    result["source_name"] = source or None
    return result


def get_attr_from_sia_event(event: SIAEvent) -> dict[str, Any]:
    """Create the attributes dict from a SIAEvent."""
    timestamp = event.timestamp or utcnow()
    satel = parse_satel_message(event.message)
    return {
        ATTR_ZONE: event.ri,
        ATTR_CODE: event.code,
        ATTR_MESSAGE: event.message,
        ATTR_ID: event.id,
        ATTR_PI: getattr(event, "pi", None),
        ATTR_SATEL_NUMBER: satel["number"],
        ATTR_SATEL_PARTITION: satel["partition_name"],
        ATTR_SATEL_SOURCE: satel["source_name"],
        ATTR_TIMESTAMP: timestamp.isoformat()
        if isinstance(timestamp, datetime)
        else timestamp,
    }


def get_event_data_from_sia_event(event: SIAEvent) -> dict[str, Any]:
    """Create a dict from the SIA Event for the HA Event."""
    return {
        "message_type": event.message_type.value
        if isinstance(event.message_type, MessageTypes)
        else event.message_type,
        "receiver": event.receiver,
        "line": event.line,
        "account": event.account,
        "sequence": event.sequence,
        "content": event.content,
        "ti": event.ti,
        "id": event.id,
        "ri": event.ri,
        "pi": getattr(event, "pi", None),
        "code": event.code,
        "message": event.message,
        "x_data": event.x_data,
        "timestamp": event.timestamp.isoformat()
        if isinstance(event.timestamp, datetime)
        else event.timestamp,
        "event_qualifier": event.event_qualifier,
        "event_type": event.event_type,
        "partition": event.partition,
        "extended_data": [
            {
                "identifier": xd.identifier,
                "name": xd.name,
                "description": xd.description,
                "length": xd.length,
                "characters": xd.characters,
                "value": xd.value,
            }
            for xd in event.extended_data
        ]
        if event.extended_data is not None
        else None,
        "satel": parse_satel_message(event.message),
        "sia_code": {
            "code": event.sia_code.code,
            "type": event.sia_code.type,
            "description": event.sia_code.description,
            "concerns": event.sia_code.concerns,
        }
        if event.sia_code is not None
        else None,
    }
