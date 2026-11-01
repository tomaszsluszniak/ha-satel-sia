"""Constants for the Satel SIA integration."""

from typing import Final

from homeassistant.const import Platform

PLATFORMS: Final = [Platform.ALARM_CONTROL_PANEL, Platform.BINARY_SENSOR]

DOMAIN: Final = "satel_sia"

ATTR_CODE: Final = "last_code"
ATTR_ZONE: Final = "last_zone"
ATTR_MESSAGE: Final = "last_message"
ATTR_ID: Final = "last_id"
ATTR_TIMESTAMP: Final = "last_timestamp"

TITLE: Final = "Satel SIA on port {}"
CONF_ACCOUNT: Final = "account"
CONF_ACCOUNTS: Final = "accounts"
CONF_ADDITIONAL_ACCOUNTS: Final = "additional_account"
CONF_ENCRYPTION_KEY: Final = "encryption_key"
CONF_IGNORE_TIMESTAMPS: Final = "ignore_timestamps"
CONF_PING_INTERVAL: Final = "ping_interval"
CONF_ZONES: Final = "zones"

SIA_HUB_ZONE: Final = 0
SIA_EVENT: Final = "sia_event_{}_{}"

KEY_ALARM: Final = "alarm"
KEY_SMOKE: Final = "smoke"
KEY_MOISTURE: Final = "moisture"
KEY_POWER: Final = "power"
KEY_CONNECTIVITY: Final = "connectivity"

PREVIOUS_STATE: Final = "previous_state"
AVAILABILITY_EVENT_CODE: Final = "RP"

ATTR_PI: Final = "last_module"
ATTR_SATEL_NUMBER: Final = "last_number"
ATTR_SATEL_PARTITION: Final = "last_partition_name"
ATTR_SATEL_SOURCE: Final = "last_source_name"
SATEL_NAME_LENGTH: Final = 16

CARD_VERSION: Final = "1.2.0"
CARD_URL: Final = "/satel_sia/satel-alarm-card.js"
