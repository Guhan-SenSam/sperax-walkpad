import type { ColorValue } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';

interface IconProps {
  color: ColorValue;
  size?: number;
}

const stroke = (color: ColorValue) => ({
  stroke: color,
  strokeWidth: 1.8,
  fill: 'none',
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
});

export function PadIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M3 15.5 13 10l8 4.5-10 5.5z" {...stroke(color)} />
      <Path d="M3 15.5V17l8 4.5V20M21 14.5V16l-10 5.5" {...stroke(color)} />
      <Path d="M13 10l2.5-1.4 2 1.1" {...stroke(color)} />
    </Svg>
  );
}

export function ActivityIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Rect x="4" y="12" width="3.5" height="8" rx="1.2" {...stroke(color)} />
      <Rect x="10.25" y="7" width="3.5" height="13" rx="1.2" {...stroke(color)} />
      <Rect x="16.5" y="4" width="3.5" height="16" rx="1.2" {...stroke(color)} />
    </Svg>
  );
}

export function SettingsIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 7h10M18 7h2M4 17h2M10 17h10" {...stroke(color)} />
      <Circle cx="16" cy="7" r="2.2" {...stroke(color)} />
      <Circle cx="8" cy="17" r="2.2" {...stroke(color)} />
    </Svg>
  );
}

export function CloseIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M6 6l12 12M18 6 6 18" {...stroke(color)} />
    </Svg>
  );
}

export function ExpandIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" {...stroke(color)} />
    </Svg>
  );
}
