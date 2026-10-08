import type { PadState } from './protocol';

export const colors = {
  bg: '#05070d',
  bgTop: '#0a1020',
  panel: 'rgba(255,255,255,0.04)',
  panelBorder: 'rgba(255,255,255,0.07)',
  text: '#f1f5f9',
  muted: '#7c8aa3',
  faint: '#3b475e',
  danger: '#f43f5e',
};

export const fonts = {
  display: 'SpaceGrotesk_700Bold',
  medium: 'SpaceGrotesk_500Medium',
};

/** Accent colour for each pad state; drives the model lighting and UI highlights. */
export const stateAccent: Record<PadState | 'offline', string> = {
  offline: '#64748b',
  idle: '#93c5fd',
  countdown: '#22d3ee',
  running: '#22d3ee',
  paused: '#fbbf24',
  stopping: '#fb923c',
  vibrating: '#a78bfa',
  unknown: '#93c5fd',
};

export const stateLabel: Record<PadState | 'offline', string> = {
  offline: 'Offline',
  idle: 'Ready',
  countdown: 'Starting',
  running: 'Walking',
  paused: 'Paused',
  stopping: 'Slowing',
  vibrating: 'Vibrating',
  unknown: 'Standby',
};
