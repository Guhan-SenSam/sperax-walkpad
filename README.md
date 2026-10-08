# Walking Pad (SPX Fitness replacement)

A small React Native (Expo) Android app that controls a **Sperax RM-01** walking/vibration pad over Bluetooth LE. It replaces the SPX Fitness app, which stopped working when its servers went down. The app runs fully offline and needs no account.

## Install

```bash
npm install
npx expo prebuild --platform android      # only needed if android/ is missing
npm run build:apk                         # -> android/app/build/outputs/apk/release/app-release.apk
adb install -r android/app/build/outputs/apk/release/app-release.apk
```

The release APK is signed with the debug key, which is fine for sideloading. To install it, either connect the phone with USB debugging enabled and run `adb install`, or copy the APK to the phone and open it.

`npm test` checks the protocol code against frames captured from a real pad.

## Workouts and Health Connect

- **When a workout is saved:** it starts when the belt starts. It ends when the pad has been idle for 30 seconds, or when the app disconnects. A short pause and resume counts as one workout, even though the pad resets its own counters on resume.
- **Discarded workouts:** anything under 15 seconds with no steps is dropped.
- **Storage:** workouts are saved on the phone with AsyncStorage. Long-press a workout to delete it from the app; this does not remove it from Health Connect.
- **Health Connect:** tap **Link Health Connect** once. After that, each finished workout is written as Steps, Distance, Active calories and a Walking exercise session. Health Sync, Google Fit and Samsung Health can read it from there.
- **No duplicates:** every record has a stable `clientRecordId`, so re-syncing a workout does not create duplicates.

## Protocol

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
| 6 | State: `00` idle, `13/12/11` countdown 3/2/1, `10` running, `0F` slowing down, `50` vibrating |
| 8 | Unit (`01` = metric) |
| 9–10 | Elapsed seconds (big-endian) |
| 11–12 | Distance in units of 10 m (big-endian) |
| 13–14 | Calories (big-endian) |
| 15–16 | Steps from the pad's footfall sensor (big-endian) |
| 17 | Current speed in 0.1 km/h (the pad ramps gradually to the target) |
| 20 | Vibration level |
