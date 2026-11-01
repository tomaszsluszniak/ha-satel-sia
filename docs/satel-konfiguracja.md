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

[![Dodaj integrację Satel SIA](https://my.home-assistant.io/badges/config_flow_start.svg)](https://my.home-assistant.io/redirect/config_flow_start/?domain=satel_sia)

albo Ustawienia → Urządzenia i usługi → Dodaj integrację → **Satel SIA**:

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

Nazwy encji uzupełniają się same: pierwsze zdarzenie z danej strefy przynosi jej nazwę z centrali
(„SIA – wysyłaj nazwę strefy”) i encja oraz urządzenie dostają tę nazwę. Nazwa nadana ręcznie w HA
ma pierwszeństwo, a identyfikatory encji się nie zmieniają.

Integracja dodaje też kartę `custom:satel-alarm-card`. Wybierz ją w edytorze dashboardu albo wpisz:

```yaml
type: custom:satel-alarm-card
partitions:
  - entity: alarm_control_panel.6514_1234_zone_1_alarm
  - entity: alarm_control_panel.6514_1234_zone_2_alarm
connectivity: binary_sensor.6514_1234_connectivity
power: binary_sensor.6514_1234_power
show_events: true       # true | false | collapsed
```

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

## 4. Powiadomienia (blueprinty)

Zamiast pisać automatyzacje ręcznie, zaimportuj gotowe blueprinty, a potem utwórz z nich
automatyzację (Ustawienia → Automatyzacje i sceny → Blueprinty → wybierz blueprint).

### Satel SIA – powiadomienia

[![Importuj blueprint](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Ftomaszsluszniak%2Fha-satel-sia%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Fsatel_sia%2Fnotifications.yaml)

| Pole | Co wpisać |
|---|---|
| Port, Account | jak w integracji, np. `6514` i `1234` |
| Notify action | usługa powiadomień, np. `notify.mobile_app_telefon` albo grupa, np. `notify.rodzina` |
| Language | `Polski` |
| Critical alarm notifications | alarmy przebijają tryb cichy na iOS (trzeba na to zezwolić w aplikacji) |
| Notify about arming and disarming | powiadomienia o załączeniu i wyłączeniu czuwania |
| Codes without notification | kody bez powiadomień; domyślnie test łączności, końce naruszeń i problemy z transmisją (YS/YK) |
| Last code helper | opcjonalny pomocnik `input_text`, w którym zapisuje się ostatni kod |

Co przychodzi:

- alarm (włamanie, pożar, napad, przymus, medyczny): powiadomienie krytyczne, np. „🚨 ALARM – Parter · Alarm włamaniowy · Salon PIR”;
- sabotaż: powiadomienie pilne;
- załączenie i wyłączenie czuwania: „🔒 Parter: załączenie czuwania · Przez: Jan”;
- pozostałe (awaria 230 V, akumulator, restart, tryb serwisowy…): „ℹ️ Alarm: Awaria zasilania 230 V”.

### Satel SIA – brak łączności z centralą

[![Importuj blueprint](https://my.home-assistant.io/badges/blueprint_import.svg)](https://my.home-assistant.io/redirect/blueprint_import/?blueprint_url=https%3A%2F%2Fgithub.com%2Ftomaszsluszniak%2Fha-satel-sia%2Fblob%2Fmain%2Fblueprints%2Fautomation%2Fsatel_sia%2Fconnection_lost.yaml)

Powiadamia, gdy centrala nie odzywa się przez ustawiony czas (domyślnie 10 min), np. po
wyłączeniu monitoringu w DLOADX, przy braku sieci albo awarii centrali, a potem drugi raz, gdy
łączność wróci. Wybierz sensor łączności (`binary_sensor.6514_1234_connectivity`), czas i usługę
powiadomień.

## 5. Własne automatyzacje

Każde zdarzenie jest dostępne jako `sia_event_<port>_<konto>`. Najważniejsze pola: `code` (kod
SIA), `ri` (strefa), `satel.partition_name`, `satel.source_name` (użytkownik lub wejście),
`satel.number`, `pi` (moduł). Przykład wyzwalacza:

```yaml
triggers:
  - trigger: event
    event_type: sia_event_6514_1234
    event_data:
      code: BA
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
