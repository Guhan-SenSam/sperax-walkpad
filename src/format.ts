import type { Settings } from './settings';

const KM_PER_MI = 1.609344;

export function formatTime(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  const mmss = `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return h > 0 ? `${h}:${mmss}` : mmss;
}

export function formatDuration(total: number) {
  const h = Math.floor(total / 3600);
  const m = Math.round((total % 3600) / 60);
  return h > 0 ? `${h} h ${m} min` : `${m} min`;
}

export function formatDate(iso: string) {
  return new Date(iso).toLocaleString(undefined, {
    weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  });
}

export function distance(km: number, units: Settings['units']) {
  return units === 'imperial'
    ? { value: (km / KM_PER_MI).toFixed(2), unit: 'mi' }
    : { value: km.toFixed(2), unit: 'km' };
}

export function speed(kmh: number, units: Settings['units']) {
  return units === 'imperial'
    ? { value: (kmh / KM_PER_MI).toFixed(1), unit: 'mph' }
    : { value: kmh.toFixed(1), unit: 'km/h' };
}

export const dayKey = (d: Date) => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
