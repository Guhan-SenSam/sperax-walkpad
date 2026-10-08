# Contributing

Thanks for helping keep these pads working.

## Reporting whether your pad works

This is the most valuable contribution. Open a [pad compatibility report](../../issues/new?template=pad-report.yml) and include:

- The pad model, and its Bluetooth name (shown on the Pad tab once connected, or in your phone's Bluetooth settings).
- What worked and what didn't: connect, start, speed, pause, stop, steps, distance, vibration.

## Bugs and ideas

Open an issue with steps to reproduce, your phone model and your Android version. Screenshots help.

## Pull requests

1. Fork the repo and create a branch.
2. Keep changes focused, and match the existing code style.
3. Run the checks before opening the PR:

   ```bash
   npm test
   npx tsc --noEmit
   npx expo lint
   ```

4. For protocol changes, add tests with packets captured from a real device (see `scripts/*.test.ts`), and update [docs/PROTOCOL.md](docs/PROTOCOL.md).
5. Say in the PR which pad you tested on. If you couldn't test on hardware, say that too.

## Adding support for a pad

See [Adding a pad](README.md#adding-a-pad) in the README. A quick way to explore a pad is a short Python [bleak](https://github.com/hbldh/bleak) script that lists its services and logs notifications.

Please don't commit decompiled code from vendor apps. Document what you learn in `docs/PROTOCOL.md` instead.
