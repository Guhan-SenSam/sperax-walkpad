import { useCallback, useEffect, useRef, useState } from 'react';
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, Device, Subscription } from 'react-native-ble-plx';
import {
  PadCommands,
  FrameParser,
  NOTIFY_UUID,
  PadStatus,
  SERVICE_UUID,
  WRITE_UUID,
  parseStatus,
} from './protocol';
import { fromBase64, toBase64 } from './base64';

export type Connection = 'disconnected' | 'scanning' | 'connecting' | 'connected';

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

function isPad(d: Device) {
  const name = d.name ?? d.localName ?? '';
  return name.toUpperCase().startsWith('SPERAX');
}

export interface PadEvents {
  onStatus?: (s: PadStatus) => void;
  onDisconnect?: () => void;
}

export function usePad(events: PadEvents = {}) {
  const [connection, setConnection] = useState<Connection>('disconnected');
  const [deviceName, setDeviceName] = useState<string | null>(null);
  const [status, setStatus] = useState<PadStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const device = useRef<Device | null>(null);
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
  }, []);

  const send = useCallback(async (frame: number[]) => {
    const d = device.current;
    if (!d) return;
    try {
      await d.writeCharacteristicWithoutResponseForService(
        SERVICE_UUID,
        WRITE_UUID,
        toBase64(frame),
      );
    } catch (e: any) {
      setError(`Write failed: ${e?.message ?? e}`);
    }
  }, []);

  const attach = useCallback(
    async (d: Device) => {
      setConnection('connecting');
      setDeviceName(d.name ?? d.localName ?? d.id);
      const connected = await d.connect({ timeout: 15000 });
      await connected.discoverAllServicesAndCharacteristics();
      device.current = connected;

      subs.current.push(
        manager.onDeviceDisconnected(connected.id, () => {
          cleanup();
          setConnection('disconnected');
          setStatus(null);
          handlers.current.onDisconnect?.();
        }),
      );

      const parser = new FrameParser();
      subs.current.push(
        connected.monitorCharacteristicForService(SERVICE_UUID, NOTIFY_UUID, (err, ch) => {
          if (err || !ch?.value) return;
          for (const frame of parser.push(fromBase64(ch.value))) {
            const s = parseStatus(frame);
            if (s) {
              setStatus(s);
              handlers.current.onStatus?.(s);
            }
          }
        }),
      );

      poll.current = setInterval(() => send(PadCommands.status()), POLL_MS);
      setConnection('connected');
    },
    [cleanup, send],
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
      setError('Pad not found. Is it powered on and not connected to another phone?');
    }, SCAN_TIMEOUT_MS);

    manager.startDeviceScan(null, null, (err, d) => {
      if (err) {
        manager.stopDeviceScan();
        if (scanTimer.current) clearTimeout(scanTimer.current);
        setConnection('disconnected');
        setError(`Scan failed: ${err.message}`);
        return;
      }
      if (!d || !isPad(d)) return;
      manager.stopDeviceScan();
      if (scanTimer.current) clearTimeout(scanTimer.current);
      attach(d).catch((e) => {
        cleanup();
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
    deviceName,
    status,
    error,
    connect,
    disconnect,
    start: () => send(PadCommands.start()),
    pause: () => send(PadCommands.pause()),
    stop: () => send(PadCommands.stop()),
    setSpeed: (kmh: number) => send(PadCommands.setSpeed(kmh)),
    vibrate: (level: number) => send(PadCommands.vibrate(level)),
    stopVibration: () => send(PadCommands.stopVibration()),
  };
}
