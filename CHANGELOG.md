# Changelog

## 1.3.1

- Card: registered as a Lovelace resource (storage mode), so it is loaded before the dashboard
  creates its cards. Fixes the card intermittently showing "Configuration error" in the mobile app:
  it was added with `add_extra_js_url`, which the frontend does not wait for. YAML-mode
  dashboards keep the previous behaviour.

## 1.3.0

- Removed output-only partitions: every partition is shown and notified the same way, as the
  panel reports it (card option `mode: switch` and the blueprint input "Output-only partitions"
  are gone; existing configs keep working, the options are ignored).

## 1.2.1

- Notifications blueprint: partition numbers and names made of digits are handled as text
  (Home Assistant turns "2" into a number when it renders variables, so output-only partitions
  were not recognised and a partition without a name could fail).
- CI: `actions/checkout` v5.

## 1.2.0

- Automation blueprints: notifications (alarms, tamper, arming, system events, output-only
  partitions, Polish / English) and connection to the panel lost; README import buttons.
- Card: `show_events: true | false | collapsed` to show, hide or fold the recent events list.
- README: My Home Assistant buttons to open the repository in HACS and to add the integration.

## 1.1.0

- Partition entities and their devices are named after the partition name sent by the panel (kept across restarts; names set in Home Assistant take precedence).
- Card: uses the entity name from Home Assistant; `name` in the card config is optional.
- Card: `mode: switch` per partition (On / Off with a custom icon) for partitions that only drive an output (relay).
- Card: Polish labels use the gender-neutral Satel terms ("Czuwanie", "Brak czuwania", "załączenie / wyłączenie czuwania").

## 1.0.0

First release.

Based on the Home Assistant `sia` integration (core 2026.10.4) and `pysiaalarm` 3.2.2.

### Changes against the built-in integration
- Domain `satel_sia`, so it can be installed next to the built-in `sia`.
- `pysiaalarm` bundled in `custom_components/satel_sia/pysiaalarm` instead of a pip requirement.
- Event data and panel attributes include the Satel module number (`pi`) and the partition and
  source names sent by Satel panels (`satel.number`, `satel.partition_name`, `satel.source_name`).
- Polish translation.
- Bundled `custom:satel-alarm-card` Lovelace card, served by the integration and loaded on all dashboards.

### Changes in the bundled pysiaalarm
- `utils/regexes.py`: SIA modifiers `ti`, `id`, `ri` and the Satel `pi` (peripheral) modifier are
  accepted in any order. Before, `Npi0/AT` was parsed as code `pi`, answered with DUH and blocked the
  panel's event queue; `Nri1/id2/CL` was parsed as code `id`.
- `event.py`: new `pi` field on events.
- `account.py`: `pytz.utc` replaced with `datetime.timezone.utc`, dropping the `pytz` dependency.
