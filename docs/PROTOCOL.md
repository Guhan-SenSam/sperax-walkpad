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

- `len` is the total frame length.
- The CRC is CRC-16 with init `0xFFFF` and reflected polynomial **`0xA327`**, computed over `F5 … payload`.
- The pad escapes inner `0xFn` bytes as `F0 0n` in its own frames, and `len` counts the escaped bytes.
- Send frames **unescaped**. The pad rejects escaped input with `0E 04`.

### Commands (payload)

| Action | Payload |
|---|---|
| Status poll | `19` |
| Lifetime totals | `1A` |
| Start belt (3-2-1 countdown) | `15 01 02 00` |
| Set speed | `15 01 <km/h × 10> 00` |
| Pause | `15 02 00 00` |
| Stop | `15 00 00 00` |
| Vibration on / set level | `16 01 <level>` (levels 1–9 verified) |
| Vibration off | `16 00 00` |

The pad acknowledges each control command with `D0 <cmd> …`.

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

## FTMS + Sperax extension

Standard [Fitness Machine Service](https://www.bluetooth.com/specifications/specs/fitness-machine-service-1-0/) (`0x1826`):

- **Treadmill Data (`2ACD`):** speed, distance, energy and elapsed time.
- **Machine Status (`2ADA`):** start, pause and stop events.
- **Control Point (`2AD9`):** request control `00`, start `07`, stop `08 01`, pause `08 02`, set speed `02 <u16 LE, 0.01 km/h>`.
- **Speed range:** read from Supported Speed Range (`2AD4`).

Sperax models add a vendor service, `FFF0`:

- **`FFF3` (notify):** `[_, 02, lo, hi]` is the step count, and `[_, 01, state, level]` is the vibration state (`state` 1 = on, 2 = off).
- **`FFF2` (write):** vibration on or set level `F0 01 01 <level>`, vibration off `F0 01 02`.
