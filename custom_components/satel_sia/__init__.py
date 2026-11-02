"""The Satel SIA integration."""

import logging
from pathlib import Path

from homeassistant.components.frontend import add_extra_js_url
from homeassistant.components.http import StaticPathConfig
from homeassistant.components.lovelace.const import LOVELACE_DATA
from homeassistant.const import CONF_PORT
from homeassistant.core import HomeAssistant
from homeassistant.exceptions import ConfigEntryNotReady
from homeassistant.helpers import config_validation as cv
from homeassistant.helpers.typing import ConfigType

from .const import CARD_URL, CARD_VERSION, DOMAIN, PLATFORMS
from .hub import SIAConfigEntry, SIAHub


_LOGGER = logging.getLogger(__name__)

CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def async_setup(hass: HomeAssistant, config: ConfigType) -> bool:
    """Serve the bundled Lovelace card and load it on every dashboard."""
    card = Path(__file__).parent / "www" / "satel-alarm-card.js"
    await hass.http.async_register_static_paths(
        [StaticPathConfig(CARD_URL, str(card), cache_headers=False)]
    )
    url = f"{CARD_URL}?v={CARD_VERSION}"
    # A Lovelace resource is loaded before the dashboard creates its cards. A
    # script added with add_extra_js_url is not awaited, so on slow clients
    # (mobile app) the card could be created before it was defined and show
    # "Configuration error".
    try:
        if await _async_ensure_lovelace_resource(hass, url):
            return True
    except Exception:  # noqa: BLE001
        _LOGGER.debug("Cannot register the card as a Lovelace resource", exc_info=True)
    add_extra_js_url(hass, url)
    return True


async def _async_ensure_lovelace_resource(hass: HomeAssistant, url: str) -> bool:
    """Create or update the card's Lovelace resource; False in YAML mode."""
    lovelace = hass.data.get(LOVELACE_DATA)
    if lovelace is None or lovelace.resource_mode != "storage":
        return False
    resources = lovelace.resources
    await resources.async_get_info()  # loads the collection
    ours = [
        item
        for item in resources.async_items()
        if str(item.get("url", "")).split("?")[0] == CARD_URL
    ]
    if not ours:
        await resources.async_create_item({"res_type": "module", "url": url})
        _LOGGER.info("Added Lovelace resource %s", url)
        return True
    first, *duplicates = ours
    if first.get("url") != url:
        await resources.async_update_item(
            first["id"], {"res_type": "module", "url": url}
        )
    for item in duplicates:
        await resources.async_delete_item(item["id"])
    return True


async def async_setup_entry(hass: HomeAssistant, entry: SIAConfigEntry) -> bool:
    """Set up sia from a config entry."""
    hub = SIAHub(hass, entry)
    hub.async_setup_hub()

    try:
        if hub.sia_client:
            await hub.sia_client.async_start(reuse_port=True)
    except OSError as exc:
        raise ConfigEntryNotReady(
            f"SIA Server at port {entry.data[CONF_PORT]} could not start."
        ) from exc

    entry.runtime_data = hub
    await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS)
    return True


async def async_unload_entry(hass: HomeAssistant, entry: SIAConfigEntry) -> bool:
    """Unload a config entry."""
    unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS)
    if unload_ok:
        await entry.runtime_data.async_shutdown()
    return unload_ok
