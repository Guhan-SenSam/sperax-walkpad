import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Defs,
  Ellipse,
  G,
  Line,
  LinearGradient,
  Path,
  Polygon,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import type { PadState } from '../protocol';

const AnimatedPath = Animated.createAnimatedComponent(Path);
const AnimatedEllipse = Animated.createAnimatedComponent(Ellipse);
const AnimatedG = Animated.createAnimatedComponent(G);

// Isometric projection: x runs along the deck (down-right), y across it
// (down-left), z is height.
const C = Math.cos(Math.PI / 6);
const S = 0.5;
const iso = (x: number, y: number, z: number) => [(x - y) * C, (x + y) * S - z] as const;
const pts = (...p: [number, number, number][]) => p.map((q) => iso(...q).join(',')).join(' ');

// Model dimensions (arbitrary units).
const L = 150; // deck length
const W = 64; // deck width
const T = 7; // deck thickness
const HOOD = 24; // motor hood length
const HOOD_H = 9; // hood height at the back
const BELT = { x0: HOOD + 2, x1: L - 6, y0: 8, y1: W - 8 };
const TREAD_PERIOD = 9; // dash + gap
const CENTER = { x: (BELT.x0 + BELT.x1) / 2, y: W / 2 };

// Tread lines run along the deck; dashes scroll toward the viewer to show belt motion.
const treadPath = (() => {
  let d = '';
  for (let y = BELT.y0 + 3; y <= BELT.y1 - 3; y += 4.5) {
    const [ax, ay] = iso(BELT.x0 + 2, y, T + 0.6);
    const [bx, by] = iso(BELT.x1 - 2, y, T + 0.6);
    d += `M${ax},${ay}L${bx},${by}`;
  }
  return d;
})();

const [cx, cy] = iso(CENTER.x, CENTER.y, T + 0.7);
const [glowX, glowY] = iso(L / 2, W / 2, 0);

interface Props {
  state: PadState | 'offline';
  accent: string;
  speedKmh: number;
  vibrationLevel: number;
  displayText: string;
}

export function PadModel({ state, accent, speedKmh, vibrationLevel, displayText }: Props) {
  const tread = useSharedValue(0);
  const pulse = useSharedValue(0);
  const ring = useSharedValue(0);
  const shake = useSharedValue(0);

  const vibrating = state === 'vibrating';
  const lit = state !== 'offline';
  const moving = (state === 'running' || state === 'stopping') && speedKmh > 0;
  // Snap speed to 0.5 km/h steps so the animation doesn't restart on every tick.
  const beltSpeed = moving ? Math.max(0.5, Math.round(speedKmh * 2) / 2) : 0;

  useEffect(() => {
    cancelAnimation(tread);
    if (beltSpeed > 0) {
      tread.value = 0;
      const unitsPerSec = beltSpeed * 9;
      tread.value = withRepeat(
        withTiming(-TREAD_PERIOD, { duration: (TREAD_PERIOD / unitsPerSec) * 1000, easing: Easing.linear }),
        -1,
        false,
      );
    }
  }, [beltSpeed, tread]);

  useEffect(() => {
    pulse.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(pulse);
  }, [pulse]);

  useEffect(() => {
    cancelAnimation(ring);
    cancelAnimation(shake);
    ring.value = 0;
    shake.value = 0;
    if (!vibrating) return;
    const level = Math.max(1, vibrationLevel);
    ring.value = withRepeat(withTiming(1, { duration: 1500 - level * 90, easing: Easing.out(Easing.quad) }), -1, false);
    const amp = 0.4 + level * 0.22;
    shake.value = withRepeat(
      withSequence(withTiming(amp, { duration: 35 }), withTiming(-amp, { duration: 70 }), withTiming(0, { duration: 35 })),
      -1,
      false,
    );
  }, [vibrating, vibrationLevel, ring, shake]);

  const treadProps = useAnimatedProps(() => ({ strokeDashoffset: tread.value }));
  const ledProps = useAnimatedProps(() => ({ opacity: lit ? 0.55 + 0.45 * pulse.value : 0.15 }));
  const glowProps = useAnimatedProps(() => ({ opacity: lit ? 0.35 + 0.3 * pulse.value : 0.08 }));
  const ring1 = useAnimatedProps(() => {
    const r = 6 + ring.value * 30;
    return { rx: r * Math.SQRT2 * C, ry: r * Math.SQRT2 * S, opacity: vibrating ? 1 - ring.value : 0 };
  });
  const ring2 = useAnimatedProps(() => {
    const p = (ring.value + 0.5) % 1;
    const r = 6 + p * 30;
    return { rx: r * Math.SQRT2 * C, ry: r * Math.SQRT2 * S, opacity: vibrating ? 1 - p : 0 };
  });
  const shakeStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: shake.value }, { translateY: -shake.value * 0.6 }],
  }));

  // Display text lies flat on the hood, reading across the deck.
  const hoodSlope = (HOOD_H - 4) / HOOD;
  const dispX = HOOD * 0.45;
  const [dx, dy] = iso(dispX, W / 2 + 13, T + HOOD_H - hoodSlope * dispX + 0.2);

  return (
    <View style={styles.wrap}>
      <Animated.View style={[StyleSheet.absoluteFill, shakeStyle]}>
        <Svg viewBox="-78 -32 225 158" width="100%" height="100%">
          <Defs>
            <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor={accent} stopOpacity="0.9" />
              <Stop offset="0.55" stopColor={accent} stopOpacity="0.25" />
              <Stop offset="1" stopColor={accent} stopOpacity="0" />
            </RadialGradient>
            <RadialGradient id="shadow" cx="50%" cy="50%" r="50%">
              <Stop offset="0" stopColor="#000" stopOpacity="0.8" />
              <Stop offset="1" stopColor="#000" stopOpacity="0" />
            </RadialGradient>
            <LinearGradient id="deckTop" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#3a4560" />
              <Stop offset="1" stopColor="#222a3b" />
            </LinearGradient>
            <LinearGradient id="deckSide" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor="#1a2130" />
              <Stop offset="1" stopColor="#0f1420" />
            </LinearGradient>
            <LinearGradient id="belt" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#141924" />
              <Stop offset="1" stopColor="#07090e" />
            </LinearGradient>
            <LinearGradient id="hoodTop" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#4a5675" />
              <Stop offset="1" stopColor="#2a3246" />
            </LinearGradient>
          </Defs>

          {/* Floor: ambient under-glow and contact shadow */}
          <AnimatedEllipse
            cx={glowX}
            cy={glowY + 6}
            rx={L * 0.6}
            ry={W * 0.7}
            fill="url(#glow)"
            transform={`rotate(24 ${glowX} ${glowY + 6})`}
            animatedProps={glowProps}
          />
          <Ellipse
            cx={glowX}
            cy={glowY + 3}
            rx={L * 0.58}
            ry={W * 0.45}
            fill="url(#shadow)"
            transform={`rotate(24 ${glowX} ${glowY + 3})`}
          />

          {/* Deck */}
          <Polygon points={pts([0, W, T], [L, W, T], [L, W, 0], [0, W, 0])} fill="url(#deckSide)" />
          <Polygon points={pts([L, 0, T], [L, W, T], [L, W, 0], [L, 0, 0])} fill="#0b0f18" />
          <Polygon points={pts([0, 0, T], [L, 0, T], [L, W, T], [0, W, T])} fill="url(#deckTop)" />

          {/* LED strips along the visible edges */}
          <AnimatedG animatedProps={ledProps}>
            <Line x1={iso(4, W, 2)[0]} y1={iso(4, W, 2)[1]} x2={iso(L - 3, W, 2)[0]} y2={iso(L - 3, W, 2)[1]}
              stroke={accent} strokeWidth={5} strokeOpacity={0.25} strokeLinecap="round" />
            <Line x1={iso(4, W, 2)[0]} y1={iso(4, W, 2)[1]} x2={iso(L - 3, W, 2)[0]} y2={iso(L - 3, W, 2)[1]}
              stroke={accent} strokeWidth={1.2} strokeLinecap="round" />
            <Line x1={iso(L, 4, 2)[0]} y1={iso(L, 4, 2)[1]} x2={iso(L, W - 4, 2)[0]} y2={iso(L, W - 4, 2)[1]}
              stroke={accent} strokeWidth={5} strokeOpacity={0.25} strokeLinecap="round" />
            <Line x1={iso(L, 4, 2)[0]} y1={iso(L, 4, 2)[1]} x2={iso(L, W - 4, 2)[0]} y2={iso(L, W - 4, 2)[1]}
              stroke={accent} strokeWidth={1.2} strokeLinecap="round" />
          </AnimatedG>

          {/* Belt */}
          <Polygon
            points={pts([BELT.x0, BELT.y0, T + 0.6], [BELT.x1, BELT.y0, T + 0.6], [BELT.x1, BELT.y1, T + 0.6], [BELT.x0, BELT.y1, T + 0.6])}
            fill="url(#belt)"
          />
          <AnimatedPath
            d={treadPath}
            stroke="#ffffff"
            strokeOpacity={moving ? 0.16 : 0.07}
            strokeWidth={1.1}
            strokeDasharray={`${TREAD_PERIOD * 0.45} ${TREAD_PERIOD * 0.55}`}
            animatedProps={treadProps}
          />
          <Polygon
            points={pts([BELT.x0, BELT.y1, T + 0.6], [BELT.x1, BELT.y1, T + 0.6], [BELT.x1, BELT.y1, T], [BELT.x0, BELT.y1, T])}
            fill="#05070b"
          />

          {/* Vibration ripples */}
          <AnimatedEllipse cx={cx} cy={cy} fill="none" stroke={accent} strokeWidth={1.2} animatedProps={ring1} />
          <AnimatedEllipse cx={cx} cy={cy} fill="none" stroke={accent} strokeWidth={1.2} animatedProps={ring2} />

          {/* Edge highlights */}
          <Polyline points={pts([0, W, T], [L, W, T], [L, 0, T])} fill="none" stroke="#ffffff" strokeOpacity={0.16} strokeWidth={0.6} />

          {/* Motor hood (wedge) */}
          <Polygon points={pts([0, W, T + HOOD_H], [HOOD, W, T + 4], [HOOD, W, T], [0, W, T])} fill="#1b2232" />
          <Polygon points={pts([HOOD, 0, T + 4], [HOOD, W, T + 4], [HOOD, W, T], [HOOD, 0, T])} fill="#121825" />
          <Polygon
            points={pts([0, 0, T + HOOD_H], [HOOD, 0, T + 4], [HOOD, W, T + 4], [0, W, T + HOOD_H])}
            fill="url(#hoodTop)"
          />
          <Polyline
            points={pts([0, W, T + HOOD_H], [HOOD, W, T + 4], [HOOD, 0, T + 4])}
            fill="none"
            stroke="#ffffff"
            strokeOpacity={0.18}
            strokeWidth={0.6}
          />

          {/* Hood display */}
          <G transform={`matrix(${C},${-S},${C},${S + hoodSlope},${dx},${dy})`}>
            <Rect x={-1} y={-9} width={28} height={12} rx={2} fill="#04060a" stroke={accent} strokeOpacity={lit ? 0.6 : 0.15} strokeWidth={0.5} />
            <SvgText x={13} y={0.5} fontSize={8} fontWeight="700" fill={accent} fillOpacity={lit ? 1 : 0.3} textAnchor="middle">
              {displayText}
            </SvgText>
          </G>
        </Svg>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: '100%', aspectRatio: 225 / 158 },
});
