# Satel SIA for Home Assistant

[![hacs_badge](https://img.shields.io/badge/HACS-Custom-41BDF5.svg)](https://hacs.xyz/docs/faq/custom_repositories)
[![Validate](https://github.com/tomaszsluszniak/ha-satel-sia/actions/workflows/validate.yml/badge.svg)](https://github.com/tomaszsluszniak/ha-satel-sia/actions/workflows/validate.yml)

Receive events from **Satel** alarm panels (VERSA, VERSA IP, INTEGRA, PERFECTA) in Home Assistant
using **SIA DC-09 monitoring** over TCP/UDP. Home Assistant acts as a monitoring station (ARC), so no
ETHM-1 Plus integration protocol is required. This is the only network option for VERSA panels.

[![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=tomaszsluszniak&repository=ha-satel-sia&category=integration)
[![Open your Home Assistant instance and start setting up Satel SIA.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=satel_sia)

> 🇵🇱 Polski przewodnik konfiguracji centrali (DLOADX), blueprinty powiadomień i rozwiązywanie
> problemów: [docs/satel-konfiguracja.md](docs/satel-konfiguracja.md)

## Why not the built-in SIA integration?

The built-in `sia` integration (and the `pysiaalarm` library it uses) does not understand the
`pi` (peripheral/module) modifier that Satel puts in system and module events, for example:

```
#0000|Npi0/AT]_18:33:15,10-31-2026      ← AC power failure reported by module 0
```

The library reads `pi` as the event code, replies **DUH** (not understood) and the panel then
**retransmits the same event forever**. Satel sends events strictly in order, so every later event
(arming, disarming, alarms) waits behind it and never reaches Home Assistant.

This integration is a copy of the Home Assistant 2026.10 `sia` integration with a bundled,
patched `pysiaalarm`:

| | built-in `sia` | `satel_sia` |
|---|---|---|
| `pi` modifier (`Npi0/AT`, `Nri1/pi5/TA`) | DUH, queue blocked | parsed, ACK |
| modifiers in any order (`Nri1/id2/CL`) | code read as `id` | parsed |
| Satel partition / source names (`^Garage   John   ^`) | raw text only | `satel.partition_name`, `satel.source_name` |
| external `pysiaalarm` dependency | yes | bundled, no `pytz` |
| domain | `sia` | `satel_sia` (both can be installed) |

## Installation (HACS)

1. Open the repository in HACS (it is added as a custom repository on the way):

   [![Open your Home Assistant instance and open this repository in HACS.](https://my.home-assistant.io/badges/hacs_repository.svg)](https://my.home-assistant.io/redirect/hacs_repository/?owner=tomaszsluszniak&repository=ha-satel-sia&category=integration)

   Or manually: HACS → ⋮ → **Custom repositories** → `https://github.com/tomaszsluszniak/ha-satel-sia`, type **Integration**.
2. **Download** Satel SIA and restart Home Assistant.
3. Add the integration:

   [![Open your Home Assistant instance and start setting up Satel SIA.](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=satel_sia)

   Or Settings → Devices & services → **Add integration** → **Satel SIA**.

Manual install: copy `custom_components/satel_sia` to `/config/custom_components/` and restart.

## Configuration

| Field | Value |
|---|---|
| Port | the port set in DLOADX for the monitoring station (e.g. `6514`) |
| Protocol | `TCP` (recommended) or `UDP`, same as the panel |
| Account | **SIA-IP acct** from DLOADX (3–16 hex characters) |
| Encryption key | **SIA-IP key** from DLOADX, when *Encrypt data* is enabled |
| Ping interval | a bit longer than *Communication check* in DLOADX (e.g. `2` if the panel checks every minute) |
| Number of zones | number of **partitions** (Satel "strefy") |

Panel side, in short: monitoring via ETHM, station 1 = Home Assistant IP and port, format
**SIA (all codes)**, SIA-IP format, TCP, *Encrypt data*. Turn on *SIA – send partition name* and
*SIA – send source name* to get names in events. Step-by-step guide with screenshots of every tab:
[docs/satel-konfiguracja.md](docs/satel-konfiguracja.md).

## Entities

Per account: connectivity, power and one `alarm_control_panel` per partition (read-only:
SIA is one-way, arming from Home Assistant is not possible), plus smoke and moisture sensors.

Partition panels get extra attributes from the last event: `last_code`, `last_zone`,
`last_number`, `last_partition_name`, `last_source_name` (who armed/disarmed or which input
triggered the alarm) and `last_module`.

A partition shows `unknown` until its first arm/disarm event: SIA panels only push events, they
cannot be polled.

### Names

Entities start with technical names (`6514 - 1234 - zone 1 - alarm`). With *SIA – send partition
name* enabled in DLOADX, the first event of a partition carries its name as set in the panel, and
the integration renames that partition's entities and device to it. The name is kept across
restarts. A name you set yourself in Home Assistant always wins. Entity IDs never change.

## Lovelace card

The integration ships a card and loads it on every dashboard automatically, no resource to add.

```yaml
type: custom:satel-alarm-card
title: Alarm
partitions:
  - entity: alarm_control_panel.6514_1234_zone_1_alarm
  - entity: alarm_control_panel.6514_1234_zone_2_alarm
    # name: …             # optional, overrides the entity name
connectivity: binary_sensor.6514_1234_connectivity   # optional
power: binary_sensor.6514_1234_power                 # optional
show_events: true   # true | false | collapsed (list folded, tap the header to open)
events: 6           # how many recent events to list
hours: 24           # how far back to look for events
```

It shows each partition (armed / disarmed / alarm, who and since when), a pulsing banner while
a partition is in alarm, chips for panel connectivity and mains power, and recent events built
from history. When a partition drops to `unknown`/`unavailable` between SIA tests, the card keeps
showing the last real state, marked with a dashed border. Tap anything for the more-info dialog.
The card is read-only, because SIA cannot arm or disarm the panel. Polish and English.

## Automation blueprints

Ready-made notification automations. Import, then create an automation from the blueprint and
pick your account, notify action and options in the form.

| Blueprint | | |
|---|---|---|
| **Notifications**: alarms (critical), tamper, arming / disarming, system events (mains, battery, restart…), Polish or English | [![Import blueprint](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Ftomaszsluszniak%2Fha-satel-sia%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Fsatel_sia%2Fnotifications.yaml) | [source](blueprints/automation/satel_sia/notifications.yaml) |
| **Connection to the panel lost**: the panel has not reported for a set time, and when it is back | [![Import blueprint](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Ftomaszsluszniak%2Fha-satel-sia%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Fsatel_sia%2Fconnection_lost.yaml) | [source](blueprints/automation/satel_sia/connection_lost.yaml) |

## Events

Every event is also fired on the bus as `sia_event_<port>_<account>`, e.g. `sia_event_6514_1234`:

```yaml
code: OP                     # SIA code
ri: "2"                      # partition
pi: null                     # module (Satel)
id: null
message: "2^Garage          John            ^"
satel:
  number: "2"                # user / input / module number
  partition_name: Garage
  source_name: John
sia_code:
  code: OP
  type: Opening Report
  description: Account was disarmed
  concerns: User number
timestamp: "2026-10-31T19:16:14+00:00"
```

For notifications use the [blueprints](#automation-blueprints); the event data above is what they read.

## Migrating from the built-in `sia` (or another SIA fork)

The domain is different, so the existing entry is not taken over:

1. Install this integration and add it with the **same port, account and key**.
2. Remove the old SIA integration entry (both cannot listen on the same port), and if it was a
   custom component, remove its folder from `custom_components`.
3. Entity IDs are new; rename them in the entity settings if you want to keep the old ones.
   Event names stay `sia_event_<port>_<account>`, so automations keep working.

## Troubleshooting

Enable debug logging on the integration page and look for `Content matches`: it shows each decoded
event. If you see `Code not found … DUH` with a code that is not a SIA code, please open an issue
with that log line (the content is decrypted there, check it for personal data first).

## Credits and license

- Based on the Home Assistant `sia` integration (Apache License 2.0) by @eavanvalkenburg and contributors.
- Bundles [pysiaalarm](https://github.com/eavanvalkenburg/pysiaalarm) 3.2.2 (MIT, license in
  `custom_components/satel_sia/pysiaalarm/LICENSE.txt`); changes are listed in [CHANGELOG.md](CHANGELOG.md).
- Not affiliated with SATEL sp. z o.o.

Licensed under the Apache License 2.0.
