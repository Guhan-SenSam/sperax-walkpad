import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router, usePathname } from 'expo-router';
import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Capabilities } from './drivers';
import { Cue, cue } from './feedback';
import { MAX_SPEED, MAX_VIBRATION_LEVEL, MIN_SPEED, type PadState, type PadStatus } from './protocol';
import { useSettings } from './settings';
import { stateAccent } from './theme';
import { useDemo } from './useDemo';
import { usePad } from './usePad';
import { useWorkouts } from './useWorkouts';

export const SPEED_STEP = 0.5;

// Used before a pad is connected (and in demo mode): the verified RM01 limits.
const DEFAULT_CAPS: Capabilities = {
  vibration: true,
  maxVibrationLevel: MAX_VIBRATION_LEVEL,
  minSpeed: MIN_SPEED,
  maxSpeed: MAX_SPEED,
};

const KEEP_AWAKE_TAG = 'workout';
const ACTIVE: (PadState | 'offline')[] = ['countdown', 'running', 'paused', 'stopping', 'vibrating'];

function useAppState() {
  const { settings, loaded, update } = useSettings();
  const feedback = useRef(settings);
  useEffect(() => {
    feedback.current = settings;
  });
  const play = (c: Cue) => cue(c, { sound: feedback.current.sounds, haptic: feedback.current.haptics });

  const log = useWorkouts({
    autoSync: settings.autoSync,
    onSaved: () => play('done'),
    onSynced: (at) => update({ lastSyncAt: at }),
  });
  const pad = usePad({ onStatus: log.onStatus, onDisconnect: log.onDisconnect });
  const [demo, setDemo] = useState(false);
  const demoStatus = useDemo(demo);

  const status: PadStatus | null = demoStatus ?? pad.status;
  const connected = pad.connection === 'connected' || demo;
  const state: PadState | 'offline' = connected && status ? status.state : 'offline';
  // Whole-workout totals survive the pad resetting its counters after a stop/start.
  const totals = demo ? status : (log.current ?? status);
  const caps = (!demo && pad.info?.capabilities) || DEFAULT_CAPS;
  const minSpeed = Math.ceil(caps.minSpeed / SPEED_STEP) * SPEED_STEP;

  const [chosenTarget, setChosenTarget] = useState<number | null>(null);
  const target = Math.min(caps.maxSpeed, Math.max(minSpeed, chosenTarget ?? settings.defaultSpeed));
  const pendingStart = useRef(false);

  // The pad starts at a crawl; once the countdown finishes, ramp to the target.
  useEffect(() => {
    if (pendingStart.current && state === 'running') {
      pendingStart.current = false;
      pad.setSpeed(target);
    }
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sound/haptic cues follow what the pad actually does, so the remote control triggers them too.
  const prev = useRef<{ state: string; countdown: number | null }>({ state: 'offline', countdown: null });
  useEffect(() => {
    const p = prev.current;
    const countdown = status?.countdown ?? null;
    if (state === 'countdown' && countdown !== p.countdown && countdown) play('tick');
    else if (state === 'running' && (p.state === 'countdown' || p.state === 'paused')) play('go');
    else if (state === 'paused' && p.state !== 'paused') play('pause');
    else if ((state === 'stopping' || state === 'idle') && (p.state === 'running' || p.state === 'paused')) play('stop');
    else if (state === 'vibrating' && p.state !== 'vibrating') play('vibe');
    prev.current = { state, countdown };
  }, [state, status?.countdown]);

  // Keep the screen on during workouts.
  const active = ACTIVE.includes(state);
  useEffect(() => {
    if (!settings.keepAwake || !active) return;
    activateKeepAwakeAsync(KEEP_AWAKE_TAG).catch(() => {});
    return () => {
      deactivateKeepAwake(KEEP_AWAKE_TAG).catch(() => {});
    };
  }, [settings.keepAwake, active]);

  // Optionally jump to the full-screen controls when a walk starts.
  const pathname = usePathname();
  const startedFromIdle = useRef(false);
  useEffect(() => {
    const starting = state === 'countdown' || state === 'running';
    if (starting && !startedFromIdle.current && settings.autoFullScreen && pathname !== '/workout') {
      router.push('/workout');
    }
    startedFromIdle.current = starting || state === 'paused' || state === 'stopping';
  }, [state]); // eslint-disable-line react-hooks/exhaustive-deps

  const actions = {
    connect: pad.connect,
    disconnect: () => {
      if (demo) setDemo(false);
      else pad.disconnect();
    },
    start: () => {
      if (state === 'vibrating') pad.stopVibration();
      pendingStart.current = true;
      pad.start();
    },
    pause: pad.pause,
    stop: () => {
      log.stopRequested();
      pad.stop();
    },
    changeTarget: (kmh: number) => {
      const next = Math.round(Math.min(caps.maxSpeed, Math.max(minSpeed, kmh)) * 10) / 10;
      if (next === target) return;
      play(next > target ? 'up' : 'down');
      setChosenTarget(next);
      if (state === 'running') pad.setSpeed(next);
    },
    vibrate: pad.vibrate,
    stopVibration: pad.stopVibration,
    setDemo,
    preview: play,
  };

  return {
    settings,
    settingsLoaded: loaded,
    updateSettings: update,
    pad,
    log,
    demo,
    status,
    connected,
    state,
    accent: stateAccent[state],
    totals,
    caps,
    minSpeed,
    target,
    actions,
  };
}

export type AppState = ReturnType<typeof useAppState>;

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const value = useAppState();
  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
