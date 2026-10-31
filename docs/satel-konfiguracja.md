# Satel VERSA → Home Assistant przez monitoring SIA

Przewodnik konfiguracji centrali Satel (sprawdzone na VERSA IP, DLOADX) tak, żeby wysyłała
wszystkie zdarzenia do Home Assistant z integracją **Satel SIA**. Home Assistant udaje stację
monitorującą, więc nie potrzebujesz modułu ETHM-1 Plus ani protokołu integracji.

Wszystkie dane w przykładach są zmyślone. W miejsce nich wpisz swoje:

| W przykładach | Co to jest |
|---|---|
| `192.168.1.10` | adres IP Home Assistant w sieci lokalnej |
| `6514` | port, na którym HA nasłuchuje zdarzeń SIA |
| `1234` | numer konta SIA-IP (3–16 znaków 0–9, A–F) |
| `0123456789ABCDEF` | klucz szyfrowania SIA-IP (16, 24 lub 32 znaki) |
| `Parter`, `Garaż` | nazwy stref (partycji) w centrali |
| `Jan` | nazwa użytkownika w centrali |

## Jak to działa

- Centrala wysyła każde zdarzenie z pamięci zdarzeń do „stacji monitorującej", czyli do HA,
  i czeka na potwierdzenie (ACK). Kanał działa **tylko w jedną stronę**: z HA nie uzbroisz
  centrali ani nie zmienisz jej ustawień.
- Zdarzenia idą **po kolei**. Jeśli stacja nie potwierdzi jednego zdarzenia, centrala ponawia je
  i wstrzymuje wszystkie następne. Z tego powodu wbudowana integracja SIA blokowała się na
  zdarzeniach systemowych Satela (`Npi0/AT`), a `satel_sia` je obsługuje.
- Zwykłe naruszenie czujki przy **rozbrojonej** strefie nie trafia do pamięci zdarzeń, więc nie
  zostanie wysłane. Przyjdą uzbrojenia, rozbrojenia, alarmy, sabotaże, awarie i zdarzenia systemowe.
- Stan partycji w HA jest `unknown` do pierwszego uzbrojenia lub rozbrojenia, bo SIA nie pozwala
  odpytać centrali o stan.

## 1. DLOADX → Struktura → Moduły → ETHM / Monitorowanie

### Zakładka „Stacje monitorujące"

| Ustawienie | Wartość |
|---|---|
| Monitorowanie – ETHM | ☑ |
| Monitorowanie – TELEFON | ☐ (chyba że używasz też prawdziwej stacji) |
| Opcje | **Tylko stacja 1** |
| Ograniczanie ilości zdarzeń | ☑ (ogranicza powtarzające się alarmy z tego samego wejścia) |
| Wysyłaj restarty modułów | ☑ |
| Wysyłaj kod powrotu po zakończeniu alarmu / po wył. czuwania | ☑ |
| **Stacja 1 → Format transmisji** | **SIA (wszystkie kody)** |
| Stacja 1 → ETHM → Adres serwera | `192.168.1.10` |
| Stacja 1 → ETHM → Port | `6514` |
| Klucz stacji, Klucz ETHM | puste (dotyczą formatu Satel, nie SIA-IP) |
| Identyfikatory 1, 2, 3, Sys. | dowolne, np. `0000` (HA patrzy na konto z zakładki SIA-IP) |
| Prefix SIA/Telim | `00` |
| **SIA – wysyłaj nazwę strefy** | ☑ (nazwa partycji w zdarzeniu) |
| **SIA – wysyłaj nazwę źródła** | ☑ (nazwa użytkownika lub wejścia w zdarzeniu) |
| SIA – potw. każdego bloku | ☑ |
| SIA – wymagaj potw. ident. | ☐ |
| Transmisje testowe stacji 1 | puste (test łączności robi „Kontrola komunikacji" w zakładce SIA-IP) |

> Dlaczego „SIA (wszystkie kody)"? W tym trybie centrala wysyła każde zdarzenie ze standardowym
> kodem SIA, a tabele z zakładek „Kody zdarzeń…" są **ignorowane**. Przy „SIA (wybrane kody)"
> zdarzenie idzie tylko wtedy, gdy w odpowiedniej komórce tabeli coś wpiszesz (treść nie ma
> znaczenia, wystarczy `1`). Ten tryb jest przydatny tylko wtedy, gdy chcesz coś świadomie wyciszyć.

### Zakładka „Monitorowanie"

| Ustawienie | Wartość |
|---|---|
| Stacja 1 → Priorytet transmisji | `1: ETHM` |

### Zakładka „SIA-IP"

| Ustawienie (Stacja monitorująca 1) | Wartość |
|---|---|
| Format IP | **SIA-IP** |
| Protokół | **TCP** |
| Prześlij adres MAC | ☐ |
| Prześlij datę i czas | ☑ (wymuszone przy kodowaniu) |
| **Koduj dane** | ☑ (szyfrowanie AES) |
| Klucz SIA-IP | `0123456789ABCDEF` |
| hex | ☐ (klucz wpisany jako zwykłe znaki, tak samo wpisujesz go w HA) |
| SIA-IP acct | `1234` |
| Kontrola komunikacji | co `0` dni `0` godz. `1` min `0` sek. |

„Kontrola komunikacji" to puste ramki `*NULL`, które HA traktuje jako test łączności (kod `RP`).
Na ich podstawie działa sensor łączności w HA.

Stację monitorującą 2 zostaw pustą.

### Po zapisaniu

1. Zapisz ustawienia do centrali i **rozłącz DLOADX**. Przy aktywnym połączeniu serwisowym
   centrala może wstrzymać monitoring.
2. Jeśli kolejka była wcześniej zablokowana (stara integracja odpowiadała DUH), wyłącz i włącz
   „Monitorowanie – ETHM" z zapisem pomiędzy. Bufor zdarzeń monitoringu zostanie wtedy wyczyszczony.

## 2. Home Assistant → Satel SIA

Ustawienia → Urządzenia i usługi → Dodaj integrację → **Satel SIA**:

| Pole | Wartość |
|---|---|
| Port | `6514` |
| Protokół | `TCP` |
| Konto (SIA-IP acct) | `1234` |
| Klucz SIA-IP | `0123456789ABCDEF` |
| Interwał testu łączności (min) | `2` (trochę więcej niż „Kontrola komunikacji") |
| Liczba stref (partycji) | liczba stref w centrali, np. `2` |

Powstaną encje (port `6514`, konto `1234`):

- `alarm_control_panel.6514_1234_zone_1_alarm`, `…_zone_2_alarm`: stan uzbrojenia partycji;
- `binary_sensor.6514_1234_connectivity`: łączność z centralą;
- `binary_sensor.6514_1234_power`: zasilanie 230 V;
- `binary_sensor.6514_1234_zone_N_smoke`, `…_moisture`: dym i zalanie, jeśli centrala je zgłasza.

Każde zdarzenie trafia też na magistralę jako `sia_event_6514_1234`.

## 3. Najczęstsze kody zdarzeń z VERSA

| Kod | Znaczenie | Uwagi |
|---|---|---|
| `RP` | test łączności | co minutę, nie powiadamiać |
| `CL` / `OP` | uzbrojenie / rozbrojenie | `satel.source_name` = użytkownik |
| `CG`, `NL` | uzbrojenie częściowe / nocne | |
| `BA` / `BR` | alarm włamaniowy / koniec naruszenia | `satel.source_name` = wejście |
| `BC`, `OR` | skasowanie alarmu | |
| `TA` / `TR` | sabotaż / koniec sabotażu | |
| `FA`, `PA`, `HA`, `MA` | pożar, napad, przymus, medyczny | |
| `AT` / `AR` | awaria / powrót 230 V | zwykle z `pi` (moduł) |
| `YT` / `YR` | awaria / powrót akumulatora | |
| `CI` | nieudane uzbrojenie | |
| `RR` | restart centrali | |
| `YS` / `YK` | problem z transmisją do stacji / transmisja przywrócona | np. po restarcie HA lub zmianie integracji; zgłaszane z opóźnieniem po powrocie łączności |
| `LB` / `LX` | początek / koniec trybu serwisowego | |

Pełna lista: https://pl.safestar.ai/docs/protokol-sia/

Przykładowe zdarzenie (rozbrojenie strefy 2 przez użytkownika 2):

```yaml
event_type: sia_event_6514_1234
data:
  code: OP
  ri: "2"
  pi: null
  message: "2^Garaż           Jan             ^"
  satel:
    number: "2"
    partition_name: Garaż
    source_name: Jan
  sia_code:
    description: Account was disarmed
```

## 4. Automatyzacja: powiadomienia

Wymaga pomocnika `input_text.alarm_ostatni_kod` (Ustawienia → Pomocnicy → Tekst). Jeśli go nie
chcesz, usuń pierwszą akcję. `notify.all_devices` zamień na swoją usługę powiadomień, np.
`notify.mobile_app_telefon`.

```yaml
alias: Alarm – powiadomienia
description: Powiadomienia ze zdarzeń SIA centrali Satel
mode: queued
max: 20
trace:
  stored_traces: 20
triggers:
  - trigger: event
    event_type: sia_event_6514_1234
variables:
  kod: "{{ trigger.event.data.code or '' }}"
  kody_alarm: [BA, FA, PA, HA, MA, GA, KA, WA, QA, BV]
  kody_sabotaz: [TA, ES, XT]
  kody_uzbr: [CL, CG, NL, CA, CS, CQ, CF]
  kody_rozbr: [OP, OG, NP, OA, OS, OQ]
  kody_cisza: [RP, BR, TR, FR, PR, HR, MR, UR, ""]
conditions:
  - condition: template
    value_template: "{{ kod not in kody_cisza }}"
actions:
  # HA zapisuje klucze bloku variables alfabetycznie, dlatego zależne
  # zmienne liczymy w osobnych krokach
  - variables:
      satel: "{{ trigger.event.data.satel or {} }}"
      ri: "{{ trigger.event.data.ri or '' }}"
      opisy:
        AT: Awaria zasilania 230V
        AR: Powrót zasilania 230V
        YT: Awaria akumulatora
        YR: Akumulator OK
        TA: Sabotaż
        BA: Alarm włamaniowy
        FA: Alarm pożarowy
        PA: Alarm napadowy
        HA: Napad / przymus
        MA: Alarm medyczny
        BC: Alarm skasowany
        OR: Alarm skasowany
        CI: Nieudane uzbrojenie
        YS: Problem z transmisją do stacji monitorującej
        YK: Transmisja do stacji monitorującej przywrócona
        RR: Restart centrali
        LB: Tryb serwisowy
        LX: Koniec trybu serwisowego
  - variables:
      strefa: >-
        {{ satel.partition_name or ('strefa ' ~ ri if ri not in ['', '0'] else 'system') }}
      kto: >-
        {{ satel.source_name or ('nr ' ~ satel.number if satel.number else '') }}
      opis: >-
        {{ opisy.get(kod, trigger.event.data.sia_code.description
           if trigger.event.data.sia_code else kod) }}
  - action: input_text.set_value
    target:
      entity_id: input_text.alarm_ostatni_kod
    data:
      value: "{{ kod }}"
  - choose:
      - alias: Alarm – krytyczne (przebija tryb cichy)
        conditions:
          - condition: template
            value_template: "{{ kod in kody_alarm }}"
        sequence:
          - action: notify.all_devices
            data:
              title: "🚨 ALARM – {{ strefa }}"
              message: "{{ opis }}{{ ': ' ~ kto if kto }}"
              data:
                ttl: 0
                priority: high
                push:
                  interruption-level: critical
                  sound:
                    name: default
                    critical: 1
                    volume: 1
      - alias: Sabotaż
        conditions:
          - condition: template
            value_template: "{{ kod in kody_sabotaz }}"
        sequence:
          - action: notify.all_devices
            data:
              title: "⚠️ Sabotaż – {{ strefa }}"
              message: "{{ opis }}{{ ': ' ~ kto if kto }}"
              data:
                ttl: 0
                priority: high
                push:
                  interruption-level: time-sensitive
      - alias: Uzbrojenie
        conditions:
          - condition: template
            value_template: "{{ kod in kody_uzbr }}"
        sequence:
          - action: notify.all_devices
            data:
              title: "🔒 {{ strefa }} uzbrojona"
              message: "{{ 'Przez: ' ~ kto if kto else 'Uzbrojenie' }}"
              data:
                tag: "alarm_strefa_{{ ri }}"   # nowe powiadomienie zastępuje poprzednie
                group: alarm
      - alias: Rozbrojenie
        conditions:
          - condition: template
            value_template: "{{ kod in kody_rozbr }}"
        sequence:
          - action: notify.all_devices
            data:
              title: "🔓 {{ strefa }} rozbrojona"
              message: "{{ 'Przez: ' ~ kto if kto else 'Rozbrojenie' }}"
              data:
                tag: "alarm_strefa_{{ ri }}"
                group: alarm
    default:
      - action: notify.all_devices
        data:
          title: "ℹ️ Alarm: {{ opis }}"
          message: >-
            {{ kod }}{{ ' · ' ~ strefa if strefa != 'system' }}{{ ' · ' ~ kto if kto }}
          data:
            group: alarm
```

## 5. Automatyzacja: brak łączności z centralą

Ostrzega, gdy centrala przestaje wysyłać testy łączności, np. po wyłączeniu monitoringu w
DLOADX, przy braku sieci albo awarii centrali.

```yaml
alias: Alarm – brak łączności z centralą
mode: single
triggers:
  - trigger: state
    entity_id: binary_sensor.6514_1234_connectivity
    to: "off"
    for:
      minutes: 10
    id: lost
  - trigger: state
    entity_id: binary_sensor.6514_1234_connectivity
    from: "off"
    to: "on"
    id: back
actions:
  - choose:
      - conditions:
          - condition: trigger
            id: lost
        sequence:
          - action: notify.all_devices
            data:
              title: "⚠️ Alarm: brak łączności"
              message: >-
                Centrala nie odzywa się od 10 minut.
                Powiadomienia o alarmie nie będą docierać.
              data:
                tag: alarm_lacznosc
                push:
                  interruption-level: time-sensitive
      - conditions:
          - condition: trigger
            id: back
          # tylko po realnej utracie, nie po krótkiej przerwie
          - condition: template
            value_template: >-
              {{ (now() - trigger.from_state.last_changed).total_seconds() > 600 }}
        sequence:
          - action: notify.all_devices
            data:
              title: "✅ Alarm: łączność wróciła"
              message: Centrala znów wysyła zdarzenia.
              data:
                tag: alarm_lacznosc
```

## 6. Rozwiązywanie problemów

| Objaw | Przyczyna i rozwiązanie |
|---|---|
| Sensor łączności `off`, w logach nic | Monitoring w DLOADX wyłączony, DLOADX wciąż połączony, zły adres lub port, zapora na hoście HA. |
| W logach `Code not found … DUH` | Kod, którego parser nie zna. Włącz debug integracji i zgłoś linię `Content matches` (sprawdź, czy nie ma w niej danych osobowych). |
| Przychodzą tylko testy `RP`, brak uzbrojeń | Kolejka zablokowana starym zdarzeniem: wyłącz i włącz „Monitorowanie – ETHM" w DLOADX. |
| Brak nazw strefy i użytkownika | Włącz „SIA – wysyłaj nazwę strefy" i „SIA – wysyłaj nazwę źródła". |
| Partycja ciągle `unknown` | Normalne do pierwszego uzbrojenia lub rozbrojenia tej partycji. |
| Panele skaczą `unavailable` ↔ `unknown` | Interwał testu w HA krótszy niż „Kontrola komunikacji" w centrali; ustaw go wyżej. |
