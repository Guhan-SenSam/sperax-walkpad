import { router } from 'expo-router';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';
import { SPEED_STEP, useApp } from '../AppProvider';
import { CloseIcon } from '../components/icons';
import { Screen } from '../components/Screen';
import { Eyebrow } from '../components/ui';
import { distance, formatTime, speed } from '../format';
import { colors, fonts, stateAccent, stateLabel } from '../theme';

/** Large, glanceable controls for use while walking. */
export default function WorkoutScreen() {
  const { status: s, state, accent, totals, target, actions, settings, connected, pad, minSpeed, caps } = useApp();
  const units = settings.units;
  const walking = state === 'running' || state === 'countdown';
  const live = speed(s?.speedKmh ?? 0, units);
  const tgt = speed(target, units);
  const dist = distance(totals?.distanceKm ?? 0, units);
  const close = () => (router.canGoBack() ? router.back() : router.replace('/'));

  return (
    <Screen accent={accent} scroll={false}>
      <View style={styles.topBar}>
        <Pressable onPress={close} style={styles.close} hitSlop={12}>
          <CloseIcon color={colors.text} />
        </Pressable>
        <Text style={[styles.state, { color: accent }]}>{stateLabel[state]}</Text>
        <Text style={styles.time}>{formatTime(totals?.seconds ?? 0)}</Text>
      </View>

      <View style={styles.stats}>
        <Text style={styles.steps} adjustsFontSizeToFit numberOfLines={1}>
          {(totals?.steps ?? 0).toLocaleString()}
        </Text>
        <Eyebrow color={accent}>Steps</Eyebrow>
        <View style={styles.subStats}>
          <SubStat value={live.value} unit={live.unit} label="Speed" />
          <SubStat value={dist.value} unit={dist.unit} label="Distance" />
          <SubStat value={String(totals?.calories ?? 0)} unit="kcal" label="Calories" />
        </View>
      </View>

      {connected ? (
        <View style={styles.controls}>
          <View style={styles.speedRow}>
            <BigButton
              onPress={() => actions.changeTarget(target - SPEED_STEP)}
              disabled={target <= minSpeed}
              color={accent}
            >
              <Text style={[styles.sign, { color: accent }]}>−</Text>
            </BigButton>
            <View style={styles.targetBox}>
              <Text style={styles.target}>{tgt.value}</Text>
              <Eyebrow>target {tgt.unit}</Eyebrow>
            </View>
            <BigButton
              onPress={() => actions.changeTarget(target + SPEED_STEP)}
              disabled={target >= caps.maxSpeed}
              color={accent}
            >
              <Text style={[styles.sign, { color: accent }]}>+</Text>
            </BigButton>
          </View>

          {walking ? (
            <BigButton onPress={actions.pause} color={stateAccent.paused} tall>
              <Text style={[styles.actionText, { color: stateAccent.paused }]}>Pause</Text>
            </BigButton>
          ) : (
            <BigButton onPress={actions.start} color={stateAccent.running} filled tall disabled={state === 'stopping'}>
              <Text style={[styles.actionText, { color: '#04121a' }]}>{state === 'paused' ? 'Resume' : 'Start'}</Text>
            </BigButton>
          )}
          <BigButton onPress={actions.stop} color={colors.danger}>
            <Text style={[styles.actionText, { color: colors.danger }]}>Stop</Text>
          </BigButton>
        </View>
      ) : (
        <View style={styles.offline}>
          <Text style={styles.offlineText}>
            {pad.connection === 'disconnected' ? 'Not connected to a pad' : 'Searching for your pad…'}
          </Text>
          <BigButton onPress={actions.connect} color={accent} disabled={pad.connection !== 'disconnected'}>
            <Text style={[styles.actionText, { color: accent }]}>Connect</Text>
          </BigButton>
        </View>
      )}

      {s?.countdown != null && state === 'countdown' && (
        <View style={styles.overlay} pointerEvents="none">
          <Animated.Text
            key={s.countdown}
            entering={ZoomIn.duration(350)}
            exiting={FadeOut.duration(250)}
            style={[styles.countdown, { color: accent, textShadowColor: accent }]}
          >
            {s.countdown}
          </Animated.Text>
        </View>
      )}
    </Screen>
  );
}

function SubStat({ value, unit, label }: { value: string; unit: string; label: string }) {
  return (
    <View style={{ alignItems: 'center', flex: 1 }}>
      <Text style={styles.subValue}>
        {value}
        <Text style={styles.subUnit}> {unit}</Text>
      </Text>
      <Eyebrow>{label}</Eyebrow>
    </View>
  );
}

function BigButton({ children, onPress, color, filled, tall, disabled }: {
  children: ReactNode; onPress: () => void; color: string; filled?: boolean; tall?: boolean; disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.big,
        tall && { height: 104 },
        { borderColor: filled ? color : `${color}66`, backgroundColor: filled ? color : `${color}10` },
        disabled && { opacity: 0.35 },
        pressed && { transform: [{ scale: 0.97 }], backgroundColor: filled ? color : `${color}30` },
      ]}
    >
      {children}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  close: {
    width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  state: { fontFamily: fonts.display, fontSize: 18, letterSpacing: 4, textTransform: 'uppercase' },
  time: { fontFamily: fonts.display, color: colors.text, fontSize: 20, fontVariant: ['tabular-nums'], minWidth: 44, textAlign: 'right' },
  stats: { alignItems: 'center', flex: 1, justifyContent: 'center', gap: 4 },
  steps: { fontFamily: fonts.display, color: colors.text, fontSize: 96, lineHeight: 104, fontVariant: ['tabular-nums'] },
  subStats: { flexDirection: 'row', marginTop: 18, alignSelf: 'stretch' },
  subValue: { fontFamily: fonts.display, color: colors.text, fontSize: 24, fontVariant: ['tabular-nums'] },
  subUnit: { fontFamily: fonts.medium, color: colors.muted, fontSize: 12 },
  controls: { gap: 12 },
  speedRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  targetBox: { alignItems: 'center', minWidth: 110 },
  target: { fontFamily: fonts.display, color: colors.text, fontSize: 56, lineHeight: 62, fontVariant: ['tabular-nums'] },
  sign: { fontFamily: fonts.display, fontSize: 52, lineHeight: 58 },
  big: {
    flex: 0, flexGrow: 1, height: 84, borderRadius: 26, borderWidth: 2,
    alignItems: 'center', justifyContent: 'center',
  },
  actionText: { fontFamily: fonts.display, fontSize: 24, letterSpacing: 3, textTransform: 'uppercase' },
  offline: { gap: 16, alignItems: 'stretch' },
  offlineText: { fontFamily: fonts.medium, color: colors.muted, fontSize: 16, textAlign: 'center' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  countdown: { fontFamily: fonts.display, fontSize: 200, textShadowRadius: 40, textShadowOffset: { width: 0, height: 0 } },
});
