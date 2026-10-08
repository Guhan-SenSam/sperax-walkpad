import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import { fromBase64, toBase64 } from './base64';
import { Capabilities, PadDriver, SCAN_SERVICES, Transport, pickDriver } from './drivers';
import type { PadStatus } from './protocol';

export type Connection = 'disconnected' | 'scanning' | 'connecting' | 'connected';

export interface PadInfo {
  name: string;
  protocol: string;
  capabilities: Capabilities;
}

const POLL_MS = 1000;
const SCAN_TIMEOUT_MS = 15000;

const manager = new BleManager();

async function requestPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const perms =
    Platform.Version >= 31
      ? [
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
        ]
      : [PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(perms);
  return perms.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}

function looksLikePad(d: Device) {
  const name = (d.name ?? d.localName ?? '').toUpperCase();
  const services = (d.serviceUUIDs ?? []).map((u) => u.toLowerCase());
  return name.startsWith('SPERAX') || SCAN_SERVICES.some((s) => services.includes(s));
}

export interface PadEvents {
  onStatus?: (s: PadStatus) => void;
  onDisconnect?: () => void;
}

export function usePad(events: PadEvents = {}) {
  const [connection, setConnection] = useState<Connection>('disconnected');
  const [info, setInfo] = useState<PadInfo | null>(null);
  const [status, setStatus] = useState<PadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const device = useRef<Device | null>(null);
  const driver = useRef<PadDriver | null>(null);
  const subs = useRef<Subscription[]>([]);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const scanTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handlers = useRef(events);
  useEffect(() => {
    handlers.current = events;
  });

  const cleanup = useCallback(() => {
    if (poll.current) clearInterval(poll.current);
    if (scanTimer.current) clearTimeout(scanTimer.current);
    poll.current = null;
    scanTimer.current = null;
    subs.current.forEach((s) => s.remove());
    subs.current = [];
    device.current = null;
    driver.current = null;
  }, []);

  /** Runs a driver command, surfacing BLE errors in the UI. */
  const run = useCallback((fn: (d: PadDriver) => Promise<void>) => {
    const d = driver.current;
    if (!d) return;
    fn(d).catch((e: any) => setError(`Command failed: ${e?.message ?? e}`));
  }, []);

  const attach = useCallback(
    async (found: Device) => {
      setConnection('connecting');
      const connected = await found.connect({ timeout: 15000 });
      await connected.discoverAllServicesAndCharacteristics();
      device.current = connected;

      const gatt = new Map<string, Set<string>>();
      for (const svc of await connected.services()) {
        const chars = await svc.characteristics();
        gatt.set(svc.uuid.toLowerCase(), new Set(chars.map((c) => c.uuid.toLowerCase())));
      }
      const d = pickDriver(gatt);
      if (!d) throw new Error('This device does not look like a supported walking pad');

      const transport: Transport = {
        write: async (service, characteristic, bytes, withResponse) => {
          const value = toBase64(bytes);
          if (withResponse) await connected.writeCharacteristicWithResponseForService(service, characteristic, value);
          else await connected.writeCharacteristicWithoutResponseForService(service, characteristic, value);
        },
        read: async (service, characteristic) => {
          const c = await connected.readCharacteristicForService(service, characteristic);
          return c.value ? fromBase64(c.value) : [];
        },
        monitor: (service, characteristic, onData) => {
          subs.current.push(
            connected.monitorCharacteristicForService(service, characteristic, (err, c) => {
              if (!err && c?.value) onData(fromBase64(c.value));
            }),
          );
        },
      };

      subs.current.push(
        manager.onDeviceDisconnected(connected.id, () => {
          cleanup();
          setConnection('disconnected');
          setStatus(null);
          handlers.current.onDisconnect?.();
        }),
      );

      await d.attach(transport, (s) => {
        setStatus(s);
        handlers.current.onStatus?.(s);
      });
      driver.current = d;
      if (d.poll) {
        const p = d.poll.bind(d);
        poll.current = setInterval(() => p().catch(() => {}), POLL_MS);
      }
      setInfo({
        name: connected.name ?? found.localName ?? connected.id,
        protocol: d.protocol,
        capabilities: { ...d.capabilities },
      });
      setConnection('connected');
    },
    [cleanup],
  );

  const connect = useCallback(async () => {
    setError(null);
    if (!(await requestPermissions())) {
      setError('Bluetooth permission denied');
      return;
    }
    const state = await manager.state();
    if (state !== 'PoweredOn') {
      setError('Turn on Bluetooth and try again');
      return;
    }
    setConnection('scanning');
    scanTimer.current = setTimeout(() => {
      manager.stopDeviceScan();
      setConnection('disconnected');
      setError('No pad found. Is it powered on and not connected to another phone?');
    }, SCAN_TIMEOUT_MS);

    manager.startDeviceScan(null, null, (err, d) => {
      if (err) {
        manager.stopDeviceScan();
        if (scanTimer.current) clearTimeout(scanTimer.current);
        setConnection('disconnected');
        setError(`Scan failed: ${err.message}`);
        return;
      }
      if (!d || !looksLikePad(d)) return;
      manager.stopDeviceScan();
      if (scanTimer.current) clearTimeout(scanTimer.current);
      attach(d).catch((e) => {
        const dev = device.current;
        cleanup();
        dev?.cancelConnection().catch(() => {});
        setConnection('disconnected');
        setError(`Connect failed: ${e?.message ?? e}`);
      });
    });
  }, [attach, cleanup]);

  const disconnect = useCallback(async () => {
    const d = device.current;
    cleanup();
    manager.stopDeviceScan();
    setConnection('disconnected');
    setStatus(null);
    if (d) handlers.current.onDisconnect?.();
    if (d) await d.cancelConnection().catch(() => {});
  }, [cleanup]);

  useEffect(() => () => void disconnect(), [disconnect]);

  return {
    connection,
    info,
    status,
    error,
    connect,
    disconnect,
    start: () => run((d) => d.start()),
    pause: () => run((d) => d.pause()),
    stop: () => run((d) => d.stop()),
    setSpeed: (kmh: number) => run((d) => d.setSpeed(kmh)),
    vibrate: (level: number) => run((d) => d.vibrate(level)),
    stopVibration: () => run((d) => d.stopVibration()),
  };
}
