import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { colors, fonts } from '../theme';

const BAR = '#0891b2'; // single-series bar colour, validated against the dark surface

/** Circular progress toward the daily step goal. */
export function GoalRing({ value, goal, color, size = 150 }: { value: number; goal: number; color: string; size?: number }) {
  const stroke = 12;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const p = Math.min(1, goal > 0 ? value / goal : 0);
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} fill="none" />
        {p > 0 && (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={color}
          strokeWidth={stroke}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={`${c * p} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
        )}
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.ringCenter]}>
        <Text style={styles.ringValue}>{value.toLocaleString()}</Text>
        <Text style={styles.ringLabel}>of {goal.toLocaleString()}</Text>
      </View>
    </View>
  );
}

export interface DayBar {
  label: string; // e.g. "M"
  title: string; // e.g. "Mon 6 Oct"
  value: number;
}

/** Steps per day for the last week. Tap a bar to read its value. */
export function WeekBars({ days, goal }: { days: DayBar[]; goal: number }) {
  const [selected, setSelected] = useState(days.length - 1);
  const W = 320;
  const H = 140;
  const top = 18;
  const max = Math.max(goal, ...days.map((d) => d.value), 1);
  const slot = W / days.length;
  const barW = Math.min(26, slot - 10);
  const y = (v: number) => top + (H - top) * (1 - v / max);
  const goalY = y(goal);
  const sel = days[selected];

  return (
    <View>
      <View style={styles.chartHeader}>
        <Text style={styles.chartValue}>{sel ? sel.value.toLocaleString() : ''}</Text>
        <Text style={styles.chartTitle}>{sel ? `steps · ${sel.title}` : ''}</Text>
      </View>
      <View>
        <Svg width="100%" height={H + 2} viewBox={`0 0 ${W} ${H + 2}`} preserveAspectRatio="none">
          <Line x1={0} x2={W} y1={H + 1} y2={H + 1} stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          {goal > 0 && (
            <Line x1={0} x2={W} y1={goalY} y2={goalY} stroke={colors.muted} strokeWidth={1} strokeDasharray="4 4" />
          )}
          {days.map((d, i) => {
            if (d.value <= 0) return null;
            const x = i * slot + (slot - barW) / 2;
            const yy = y(d.value);
            const h = H - yy;
            const r = Math.min(4, h, barW / 2);
            // Rounded top, square base anchored to the baseline.
            const path = `M${x},${H} L${x},${yy + r} Q${x},${yy} ${x + r},${yy} L${x + barW - r},${yy} Q${x + barW},${yy} ${x + barW},${yy + r} L${x + barW},${H} Z`;
            return <Path key={i} d={path} fill={BAR} opacity={i === selected ? 1 : 0.55} />;
          })}
        </Svg>
        {/* Hit targets wider than the bars */}
        <View style={StyleSheet.absoluteFill}>
          <View style={{ flexDirection: 'row', flex: 1 }}>
            {days.map((d, i) => (
              <Pressable key={i} style={{ flex: 1 }} onPress={() => setSelected(i)} accessibilityLabel={`${d.title}: ${d.value} steps`} />
            ))}
          </View>
        </View>
        {goal > 0 && <Text style={[styles.goalLabel, { top: goalY - 16 }]}>Goal</Text>}
      </View>
      <View style={styles.labels}>
        {days.map((d, i) => (
          <Text key={i} style={[styles.dayLabel, i === selected && { color: colors.text }]}>
            {d.label}
          </Text>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ringCenter: { alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontFamily: fonts.display, color: colors.text, fontSize: 26, fontVariant: ['tabular-nums'] },
  ringLabel: { fontFamily: fonts.medium, color: colors.muted, fontSize: 12 },
  chartHeader: { flexDirection: 'row', alignItems: 'baseline', gap: 8, marginBottom: 8 },
  chartValue: { fontFamily: fonts.display, color: colors.text, fontSize: 22, fontVariant: ['tabular-nums'] },
  chartTitle: { fontFamily: fonts.medium, color: colors.muted, fontSize: 12 },
  goalLabel: { position: 'absolute', right: 0, fontFamily: fonts.medium, color: colors.muted, fontSize: 10 },
  labels: { flexDirection: 'row', marginTop: 6 },
  dayLabel: { flex: 1, textAlign: 'center', fontFamily: fonts.medium, color: colors.muted, fontSize: 11 },
});
