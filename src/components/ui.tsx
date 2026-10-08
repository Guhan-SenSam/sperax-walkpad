import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { colors, fonts } from '../theme';

export function Panel({ children, style }: { children: ReactNode; style?: ViewStyle }) {
  return <View style={[styles.panel, style]}>{children}</View>;
}

export function Eyebrow({ children, color = colors.muted }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.eyebrow, { color }]}>{children}</Text>;
}

export function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricValue}>
        {value}
        {unit && <Text style={styles.metricUnit}> {unit}</Text>}
      </Text>
      <Eyebrow>{label}</Eyebrow>
    </View>
  );
}

export function IconButton({ label, onPress, disabled, accent }: {
  label: string; onPress: () => void; disabled?: boolean; accent: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.iconBtn,
        { borderColor: `${accent}55` },
        disabled && styles.disabled,
        pressed && { backgroundColor: `${accent}22` },
      ]}
    >
      <Text style={[styles.iconBtnText, { color: accent }]}>{label}</Text>
    </Pressable>
  );
}

export function ActionButton({ label, onPress, disabled, color, filled, flex }: {
  label: string; onPress: () => void; disabled?: boolean; color: string; filled?: boolean; flex?: number;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.action,
        { flex, borderColor: color, backgroundColor: filled ? color : 'transparent' },
        !filled && { borderColor: `${color}66` },
        disabled && styles.disabled,
        pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
      ]}
    >
      <Text style={[styles.actionText, { color: filled ? '#04121a' : color }]}>{label}</Text>
    </Pressable>
  );
}

/** A row of tappable segments, e.g. speed or vibration level. */
export function SegmentTrack({ count, value, onSelect, accent, disabled, labels }: {
  count: number; value: number; onSelect: (i: number) => void; accent: string; disabled?: boolean; labels?: string[];
}) {
  return (
    <View style={[styles.track, disabled && styles.disabled]}>
      {Array.from({ length: count }, (_, i) => {
        const on = i < value;
        return (
          <Pressable key={i} disabled={disabled} onPress={() => onSelect(i + 1)} style={styles.segmentHit}>
            <View
              style={[
                styles.segment,
                on && { backgroundColor: accent, shadowColor: accent, shadowOpacity: 0.9, shadowRadius: 6, elevation: 4 },
              ]}
            />
            {labels && <Text style={[styles.segmentLabel, on && { color: colors.text }]}>{labels[i]}</Text>}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    backgroundColor: colors.panel,
    borderColor: colors.panelBorder,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 22,
    padding: 18,
    gap: 14,
  },
  eyebrow: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' },
  metric: { flex: 1, alignItems: 'center', gap: 2 },
  metricValue: { fontFamily: fonts.display, color: colors.text, fontSize: 22, fontVariant: ['tabular-nums'] },
  metricUnit: { fontFamily: fonts.medium, color: colors.muted, fontSize: 12 },
  iconBtn: {
    width: 56, height: 56, borderRadius: 28, borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  iconBtnText: { fontFamily: fonts.display, fontSize: 26, marginTop: -2 },
  action: {
    height: 58, borderRadius: 18, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 18,
  },
  actionText: { fontFamily: fonts.display, fontSize: 16, letterSpacing: 1.5, textTransform: 'uppercase' },
  track: { flexDirection: 'row', gap: 6 },
  segmentHit: { flex: 1, alignItems: 'center', gap: 6, paddingVertical: 4 },
  segment: { height: 10, alignSelf: 'stretch', borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.08)' },
  segmentLabel: { fontFamily: fonts.medium, fontSize: 11, color: colors.faint },
  disabled: { opacity: 0.35 },
});
