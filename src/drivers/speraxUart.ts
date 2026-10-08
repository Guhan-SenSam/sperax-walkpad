import {
  FrameParser,
  MAX_SPEED,
  MAX_VIBRATION_LEVEL,
  MIN_SPEED,
  NOTIFY_UUID,
  PadCommands,
  SERVICE_UUID,
  WRITE_UUID,
  parseStatus,
} from '../protocol';
import { GattMap, PadDriver, Transport, has } from './types';

/**
 * Sperax pads with a framed UART-style protocol on FFF0 (FFF1 notify, FFF2
 * write), e.g. SPERAX_RM01. Verified on real hardware.
 */
export class SperaxUartDriver implements PadDriver {
  readonly protocol = 'Sperax UART';
  readonly capabilities = {
    vibration: true,
    maxVibrationLevel: MAX_VIBRATION_LEVEL,
    minSpeed: MIN_SPEED,
    maxSpeed: MAX_SPEED,
  };
  private t!: Transport;

  static matches(gatt: GattMap) {
    return has(gatt, 'fff0', 'fff1', 'fff2');
  }

  async attach(t: Transport, onStatus: Parameters<PadDriver['attach']>[1]) {
    this.t = t;
    const parser = new FrameParser();
    t.monitor(SERVICE_UUID, NOTIFY_UUID, (bytes) => {
      for (const frame of parser.push(bytes)) {
        const s = parseStatus(frame);
        if (s) onStatus(s);
      }
    });
  }

  private send(frame: number[]) {
    return this.t.write(SERVICE_UUID, WRITE_UUID, frame);
  }

  poll = () => this.send(PadCommands.status());
  start = () => this.send(PadCommands.start());
  pause = () => this.send(PadCommands.pause());
  stop = () => this.send(PadCommands.stop());
  setSpeed = (kmh: number) => this.send(PadCommands.setSpeed(kmh));
  vibrate = (level: number) => this.send(PadCommands.vibrate(level));
  stopVibration = () => this.send(PadCommands.stopVibration());
}
