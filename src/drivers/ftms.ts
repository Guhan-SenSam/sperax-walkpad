import type { PadState, PadStatus } from '../protocol';
import {
  FtmsCommands,
  parseMachineStatus,
  parseSpeedRange,
  parseSperaxExtra,
  parseTreadmillData,
} from './ftmsParse';
import { Capabilities, GattMap, PadDriver, Transport, has, uuid16 } from './types';

const FTMS = uuid16('1826');
const TREADMILL_DATA = uuid16('2acd');
const CONTROL_POINT = uuid16('2ad9');
const MACHINE_STATUS = uuid16('2ada');
const SPEED_RANGE = uuid16('2ad4');
const VENDOR = uuid16('fff0');
const VENDOR_WRITE = uuid16('fff2');
const VENDOR_NOTIFY = uuid16('fff3');

/**
 * Standard FTMS treadmills, with Sperax's vendor extension (steps and
 * vibration on FFF0) when present. Covers Sperax models such as
 * SPERAX_RM-01, P2MAX, P3MAX, P3PRO, F1 and L400, and FTMS pads from other
 * brands. Built from the decompiled SPX app and the FTMS spec; not yet
 * verified on hardware.
 */
export class FtmsDriver implements PadDriver {
  readonly protocol: string;
  readonly capabilities: Capabilities;
  private t!: Transport;
  private emit!: (s: PadStatus) => void;
  private state: PadState = 'idle';
  private status: PadStatus = {
    state: 'idle',
    stateCode: 0,
    countdown: null,
    seconds: 0,
    distanceKm: 0,
    steps: 0,
    calories: 0,
    speedKmh: 0,
    vibrationLevel: 0,
  };

  constructor(private gatt: GattMap) {
    const sperax = FtmsDriver.hasSperaxExtension(gatt);
    this.protocol = sperax ? 'FTMS + Sperax' : 'FTMS';
    this.capabilities = { vibration: sperax, maxVibrationLevel: 9, minSpeed: 1, maxSpeed: 6 };
  }

  static matches(gatt: GattMap) {
    return has(gatt, '1826', '2acd', '2ad9');
  }

  private static hasSperaxExtension(gatt: GattMap) {
    return has(gatt, 'fff0', 'fff2', 'fff3');
  }

  async attach(t: Transport, onStatus: (s: PadStatus) => void) {
    this.t = t;
    this.emit = onStatus;

    try {
      const range = parseSpeedRange(await t.read(FTMS, SPEED_RANGE));
      if (range && range.max > range.min) {
        this.capabilities.minSpeed = Math.max(0.5, range.min);
        this.capabilities.maxSpeed = range.max;
      }
    } catch {
      // Optional characteristic; keep defaults.
    }

    t.monitor(FTMS, TREADMILL_DATA, (b) => {
      const d = parseTreadmillData(b);
      if (d.speedKmh !== undefined) {
        if (d.speedKmh > 0 && (this.state === 'idle' || this.state === 'paused')) this.state = 'running';
        if (d.speedKmh === 0 && this.state === 'stopping') this.state = 'idle';
      }
      this.update({ ...d });
    });
    t.monitor(FTMS, CONTROL_POINT, () => {}); // control point responses arrive as indications
    if (has(this.gatt, '1826', '2ada')) {
      t.monitor(FTMS, MACHINE_STATUS, (b) => {
        const e = parseMachineStatus(b);
        if (e === 'started') this.state = 'running';
        else if (e === 'paused') this.state = 'paused';
        else if (e === 'stopped' || e === 'reset') this.state = this.status.speedKmh > 0 ? 'stopping' : 'idle';
        this.update({});
      });
    }
    if (FtmsDriver.hasSperaxExtension(this.gatt)) {
      t.monitor(VENDOR, VENDOR_NOTIFY, (b) => {
        const x = parseSperaxExtra(b);
        if (x?.kind === 'steps') this.update({ steps: x.steps });
        if (x?.kind === 'vibration') {
          if (x.on) this.state = 'vibrating';
          else if (this.state === 'vibrating') this.state = 'idle';
          this.update({ vibrationLevel: x.on ? x.level : 0 });
        }
      });
    }

    await this.control(FtmsCommands.requestControl);
  }

  private update(patch: Partial<PadStatus>) {
    this.status = { ...this.status, ...patch, state: this.state };
    this.emit(this.status);
  }

  private control(bytes: number[]) {
    return this.t.write(FTMS, CONTROL_POINT, bytes, true);
  }

  private vendor(bytes: number[]) {
    return this.t.write(VENDOR, VENDOR_WRITE, bytes);
  }

  start = async () => {
    await this.control(FtmsCommands.requestControl);
    await this.control(FtmsCommands.start);
    this.state = 'running';
    this.update({});
  };
  pause = async () => {
    await this.control(FtmsCommands.pause);
    this.state = 'paused';
    this.update({});
  };
  stop = async () => {
    await this.control(FtmsCommands.stop);
    this.state = this.status.speedKmh > 0 ? 'stopping' : 'idle';
    this.update({});
  };
  setSpeed = (kmh: number) =>
    this.control(
      FtmsCommands.setSpeed(Math.min(this.capabilities.maxSpeed, Math.max(this.capabilities.minSpeed, kmh))),
    );
  vibrate = (level: number) => this.vendor(FtmsCommands.vibrate(Math.round(level)));
  stopVibration = () => this.vendor(FtmsCommands.stopVibration);
}
