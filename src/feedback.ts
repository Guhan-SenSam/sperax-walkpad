import { AudioPlayer, createAudioPlayer, setAudioModeAsync } from 'expo-audio';
import * as Haptics from 'expo-haptics';

const SOURCES = {
  tick: require('../assets/sounds/tick.wav'),
  go: require('../assets/sounds/go.wav'),
  up: require('../assets/sounds/up.wav'),
  down: require('../assets/sounds/down.wav'),
  pause: require('../assets/sounds/pause.wav'),
  stop: require('../assets/sounds/stop.wav'),
  vibe: require('../assets/sounds/vibe.wav'),
  done: require('../assets/sounds/done.wav'),
};

export type Cue = keyof typeof SOURCES;

const HAPTIC: Record<Cue, () => Promise<void>> = {
  tick: () => Haptics.selectionAsync(),
  go: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
  up: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  down: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light),
  pause: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  stop: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy),
  vibe: () => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium),
  done: () => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success),
};

let players: Partial<Record<Cue, AudioPlayer>> | null = null;

function load() {
  if (players) return players;
  // Mix with music/podcasts instead of pausing them.
  setAudioModeAsync({ interruptionMode: 'mixWithOthers', playsInSilentMode: false }).catch(() => {});
  players = {};
  for (const [cue, src] of Object.entries(SOURCES)) {
    players[cue as Cue] = createAudioPlayer(src);
  }
  return players;
}

/** Plays a cue as a sound and/or haptic, depending on the user's settings. */
export function cue(name: Cue, opts: { sound: boolean; haptic: boolean }) {
  if (opts.haptic) HAPTIC[name]().catch(() => {});
  if (!opts.sound) return;
  try {
    const p = load()[name];
    if (!p) return;
    p.seekTo(0);
    p.play();
  } catch {
    // Audio is a nicety; never let it break controls.
  }
}
