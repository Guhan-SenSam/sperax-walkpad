import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState } from 'react';

export interface Settings {
  onboarded: boolean;
  sounds: boolean;
  haptics: boolean;
  keepAwake: boolean;
  autoFullScreen: boolean;
  autoSync: boolean;
  units: 'metric' | 'imperial';
  stepGoal: number;
  defaultSpeed: number; // km/h
  lastSyncAt: string | null;
}

export const DEFAULT_SETTINGS: Settings = {
  onboarded: false,
  sounds: true,
  haptics: true,
  keepAwake: true,
  autoFullScreen: false,
  autoSync: true,
  units: 'metric',
  stepGoal: 8000,
  defaultSpeed: 2.5,
  lastSyncAt: null,
};

const KEY = 'settings.v1';

export function useSettings() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => {
        if (raw) setSettings({ ...DEFAULT_SETTINGS, ...JSON.parse(raw) });
      })
      .finally(() => setLoaded(true));
  }, []);

  const update = useCallback((patch: Partial<Settings>) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      AsyncStorage.setItem(KEY, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  return { settings, loaded, update };
}
