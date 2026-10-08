import type { PadStatus } from '../protocol';

/** Minimal BLE access a driver needs; implemented over react-native-ble-plx. */
export interface Transport {
  write(service: string, characteristic: string, bytes: number[], withResponse?: boolean): Promise<void>;
  read(service: string, characteristic: string): Promise<number[]>;
  monitor(service: string, characteristic: string, onData: (bytes: number[]) => void): void;
}

export interface Capabilities {
  vibration: boolean;
  maxVibrationLevel: number;
  /** km/h */
  minSpeed: number;
  maxSpeed: number;
}

export interface PadDriver {
  /** Shown in the UI and README, e.g. "Sperax UART" or "FTMS". */
  readonly protocol: string;
  readonly capabilities: Capabilities;
  /** Subscribe to notifications and do any handshake. */
  attach(t: Transport, onStatus: (s: PadStatus) => void): Promise<void>;
  /** Called every second while connected (for pads that must be polled). */
  poll?(): Promise<void>;
  start(): Promise<void>;
  pause(): Promise<void>;
  stop(): Promise<void>;
  setSpeed(kmh: number): Promise<void>;
  vibrate(level: number): Promise<void>;
  stopVibration(): Promise<void>;
}

/** service UUID (lowercase, 128-bit) -> characteristic UUIDs it exposes */
export type GattMap = Map<string, Set<string>>;

export const uuid16 = (short: string) => `0000${short.toLowerCase()}-0000-1000-8000-00805f9b34fb`;

export const has = (gatt: GattMap, service: string, ...chars: string[]) => {
  const c = gatt.get(uuid16(service));
  return !!c && chars.every((ch) => c.has(uuid16(ch)));
};
