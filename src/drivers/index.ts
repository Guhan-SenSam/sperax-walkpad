import { FtmsDriver } from './ftms';
import { SperaxUartDriver } from './speraxUart';
import { GattMap, PadDriver, uuid16 } from './types';

export type { Capabilities, PadDriver, Transport } from './types';

/** Services worth scanning for; pads are also matched by a SPERAX name prefix. */
export const SCAN_SERVICES = [uuid16('1826'), uuid16('fff0')];

/** Picks a driver from the services a connected pad exposes. */
export function pickDriver(gatt: GattMap): PadDriver | null {
  if (FtmsDriver.matches(gatt)) return new FtmsDriver(gatt);
  if (SperaxUartDriver.matches(gatt)) return new SperaxUartDriver();
  return null;
}
