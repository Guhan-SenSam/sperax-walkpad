# Protocols

How Walkpad talks to each kind of pad. Byte values are hex.

The Sperax protocols were reverse engineered from the SPX Fitness Android app (`com.spreax.fitness202412`, a Flutter app decompiled with [blutter](https://github.com/worawit/blutter)) for interoperability, and the RM01 protocol was verified against a real pad. No code from that app is included in this repository.

## Sperax UART (RM01)

Verified on hardware. The pad advertises as `SPERAX_RM01`, and its BLE module is a Wi-Link WLT6200.

| | UUID |
|---|---|
| Service | `0000fff0-0000-1000-8000-00805f9b34fb` |
| Write (no response) | `0000fff2-…` |
| Notify | `0000fff1-…` |

### Framing

```
F5 <len> 00 <payload…> <crcLo> <crcHi> FA
```

- `len` is the total on-wire frame length, including inserted escape bytes.
- The CRC is CRC-16 with init `0xFFFF` and reflected polynomial **`0xA327`**, computed over the logical, unescaped `F5 … payload` frame before the CRC is appended.
- Escape inner bytes `0xF0`–`0xFF` as `F0 <low nibble>`; the transmitted length includes those extra bytes. For example, the status poll is sent as `F5 08 00 19 F0 0A 59 FA`; its CRC is `FA 59` over the logical frame `F5 07 00 19`.
- The official app sends an initialization payload `01` before polling. It was observed in the capture, but its necessity has not been isolated.
- The official app polls at approximately 300 ms intervals; this app uses the same interval for UART status polling.

### Commands (payload)

| Action | Payload |
|---|---|
| Observed initialization (necessity unconfirmed) | `01` |
| Status poll | `19` |
| Lifetime totals | `1A` |
| Start belt (3-2-1 countdown) | `15 01 02 00` |
| Set speed (0.1 km/h command resolution) | `15 01 <km/h × 10> 00` |
| Pause | `15 02 00 00` |
| Stop | `15 00 00 00` |
| Vibration on / set level | `16 01 <level>` (levels 1–9 verified) |
| Vibration off | `16 00 00` |

The pad acknowledges each control command with `D0 <cmd> …`.

The app currently retains a 6 km/h speed ceiling as a safety limit; the capture does not establish the treadmill's maximum speed.

### Status frame (`19`), byte offsets in the unescaped frame

| Bytes | Meaning |
|---|---|
| 6 | State: `00` idle, `13/12/11` countdown 3/2/1, `10` running, `0F` slowing down, `01` paused (counters kept, start resumes), `50` vibrating |
| 8 | Unit (`01` = metric) |
| 9–10 | Elapsed seconds (big-endian) |
| 11–12 | Distance in units of 10 m (big-endian) |
| 13–14 | Calories (big-endian) |
| 15–16 | Steps from the pad's footfall sensor (big-endian) |
| 17 | Current speed in 0.1 km/h (the pad ramps gradually to the target) |
| 20 | Vibration level |

The captured official-app trace also contains 20-byte status prefixes with the CRC and tail omitted. The app accepts that exact prefix length after validating the available header, reserved bytes and state code; vibration level is unavailable in this form. Complete frames are still checked against their CRC.

## FTMS + Sperax extension

Standard [Fitness Machine Service](https://www.bluetooth.com/specifications/specs/fitness-machine-service-1-0/) (`0x1826`):

- **Treadmill Data (`2ACD`):** speed, distance, energy and elapsed time.
- **Machine Status (`2ADA`):** start, pause and stop events.
- **Control Point (`2AD9`):** request control `00`, start `07`, stop `08 01`, pause `08 02`, set speed `02 <u16 LE, 0.01 km/h>`.
- **Speed range:** read from Supported Speed Range (`2AD4`).

Sperax models add a vendor service, `FFF0`:

- **`FFF3` (notify):** `[_, 02, lo, hi]` is the step count, and `[_, 01, state, level]` is the vibration state (`state` 1 = on, 2 = off).
- **`FFF2` (write):** vibration on or set level `F0 01 01 <level>`, vibration off `F0 01 02`.
