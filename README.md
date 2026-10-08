# Walkpad

An open-source Android app for **Sperax walking pads** and other Bluetooth treadmills. It is a replacement for the SPX Fitness app, which stopped working when the manufacturer shut down its servers and left owners locked out of their pads.

- **Pad control:** start, pause, stop, speed and vibration.
- **Live stats:** steps, time, distance and calories.
- **Workouts:** saved on the phone and synced to **Health Connect**, which Health Sync, Google Fit and Samsung Health can read.
- **No account:** fully offline, with no servers involved.

> Not affiliated with Sperax. The protocols were reverse engineered from the SPX Fitness Android app for interoperability, so owners can keep using hardware they bought.

## Supported pads

| Pad | Protocol | Status |
|---|---|---|
| Sperax RM01 (Bluetooth name `SPERAX_RM01`), walking + vibration | Sperax UART on `FFF0` | ✅ Verified on hardware |
| Sperax `SPERAX_RM-01`, P2 MAX, P3 MAX, P3 PRO, F1, L400, L400B | FTMS + Sperax extension | ⚠️ From the decompiled app; untested |
| Other FTMS treadmills (Bluetooth service `0x1826`) | FTMS | ⚠️ Spec-based; untested |

If you own one of the untested pads, please open an issue saying whether it works.

The app picks a protocol after connecting by looking at the pad's Bluetooth services (`src/drivers/index.ts`). To add a pad, implement `PadDriver` in `src/drivers/`.

## Features

- **Pad tab:** an animated 3D view of the pad that shows its state, live stats, target speed and vibration.
- **Full-screen workout view:** huge buttons for use mid-walk. It keeps the screen on, and can open automatically when the belt starts.
- **Activity tab:** daily step goal ring, steps for the last 7 days, totals and history. Walks the app missed can be added by hand (`walkpad://add-workout?...` opens the form pre-filled).
- **Settings tab:**
  - Health Connect: link, auto-sync, sync now, re-send all.
  - Sounds and haptics.
  - Units, step goal, starting speed and keep-screen-on.
  - Demo mode, which previews the app without a pad and never saves or syncs anything.
- **Intro:** a short walkthrough on first launch.

## Install

```bash
npm install
npx expo prebuild --platform android      # only needed if android/ is missing
npm run build:apk                         # -> android/app/build/outputs/apk/release/app-release.apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

The release APK is signed with the debug key, which is fine for sideloading. To install it, either connect the phone with USB debugging enabled and run `adb install`, or copy the APK to the phone and open it.

`npm test` runs the parser and tracker tests. The Sperax UART tests use frames captured from a real pad; the FTMS tests use packets built from the spec.

## Workouts and Health Connect

- **When a workout is saved:** it starts when the belt starts. It ends as soon as the belt stops after you press Stop in the app. If the pad stops some other way (its remote, for example), the workout ends after the belt has been stopped for 30 seconds, or when the app disconnects. The workout in progress is saved every few seconds, so closing the app doesn't lose it. A pause never ends a workout, however long it lasts. If you stop and start again within 30 seconds, the app adds the runs together, because the pad resets its counters after a stop.
- **Discarded workouts:** anything under 15 seconds with no steps is dropped.
- **Storage:** workouts are saved on the phone with AsyncStorage. Long-press a workout to delete it from the app; this does not remove it from Health Connect.
- **Health Connect:** tap **Link Health Connect** once. After that, each finished workout is written as Steps, Distance, Active calories and a Walking exercise session. Health Sync, Google Fit and Samsung Health can read it from there.
- **No duplicates:** every record has a stable `clientRecordId`, so re-syncing a workout does not create duplicates.

## Protocol: Sperax UART (RM01)

The protocol was reverse engineered from `com.spreax.fitness202412` (a Flutter app, decompiled with blutter) and verified against a real pad. The pad advertises as `SPERAX_RM01`, and its BLE module is a Wi-Link WLT6200.

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

## Protocol: FTMS + Sperax extension

Standard [Fitness Machine Service](https://www.bluetooth.com/specifications/specs/fitness-machine-service-1-0/) (`0x1826`):

- **Treadmill Data (`2ACD`):** speed, distance, energy and elapsed time.
- **Machine Status (`2ADA`):** start, pause and stop events.
- **Control Point (`2AD9`):** request control `00`, start `07`, stop `08 01`, pause `08 02`, set speed `02 <u16 LE, 0.01 km/h>`.
- **Speed range:** read from Supported Speed Range (`2AD4`).

Sperax models add a vendor service, `FFF0`:

- **`FFF3` (notify):** `[_, 02, lo, hi]` is the step count, and `[_, 01, state, level]` is the vibration state (`state` 1 = on, 2 = off).
- **`FFF2` (write):** vibration on or set level `F0 01 01 <level>`, vibration off `F0 01 02`.
