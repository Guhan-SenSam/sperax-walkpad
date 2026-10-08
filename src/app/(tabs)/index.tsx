import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn, FadeOut, ZoomIn } from 'react-native-reanimated';
import { SPEED_STEP, useApp } from '../../AppProvider';
import { ExpandIcon } from '../../components/icons';
import { PadModel } from '../../components/PadModel';
import { Screen } from '../../components/Screen';
import { ActionButton, Eyebrow, IconButton, Metric, Panel, SegmentTrack } from '../../components/ui';
import { distance, formatTime, speed } from '../../format';
import { colors, fonts, stateAccent, stateLabel } from '../../theme';

/** "SPERAX_RM01" -> "RM01" */
const modelName = (name: string) => name.replace(/^SPERAX[_ -]*/i, '') || name;

export default function PadScreen() {
  const { pad, demo, status: s, state, accent, totals, caps, minSpeed, target, actions, settings, connected } = useApp();
  const units = settings.units;
  const walking = state === 'running' || state === 'countdown';
  const canVibrate = connected && (state === 'idle' || state === 'vibrating' || state === 'unknown');
  const vibrationLevel = state === 'vibrating' ? s!.vibrationLevel : 0;
  const levels = caps.maxVibrationLevel;
  const speedSteps = Math.round((caps.maxSpeed - minSpeed) / SPEED_STEP) + 1;
  const speedLabels = Array.from({ length: speedSteps }, (_, i) => {
    const v = minSpeed + i * SPEED_STEP;
    return Number.isInteger(v) && (speedSteps <= 13 || v % 2 === 0) ? String(v) : '';
  });
  const live = speed(s?.speedKmh ?? 0, units);
  const tgt = speed(target, units);
  const dist = totals ? distance(totals.distanceKm, units) : null;

  const subtitle =
    state === 'offline'
      ? pad.connection === 'disconnected'
        ? 'Tap connect to find your pad'
        : 'Searching for your pad…'
      : state === 'vibrating'
        ? `Level ${vibrationLevel} of ${levels}`
        : state === 'paused'
          ? 'Press resume to continue'
          : state === 'countdown'
            ? 'Get ready'
            : `${live.value} ${live.unit}`;

  return (
    <Screen accent={accent}>
      <View style={styles.header}>
        <View style={{ flexShrink: 1 }}>
          <Eyebrow>{demo ? 'Demo mode' : (pad.info?.protocol ?? 'Walking pad')}</Eyebrow>
          <Text style={styles.title} numberOfLines={1}>
            {demo ? 'RM01' : pad.info ? modelName(pad.info.name) : 'Walkpad'}
          </Text>
        </View>
        <Pressable
          onPress={connected ? actions.disconnect : actions.connect}
          disabled={pad.connection === 'scanning' || pad.connection === 'connecting'}
          style={[styles.pill, { borderColor: `${accent}66` }]}
        >
          <View style={[styles.dot, { backgroundColor: connected ? accent : colors.faint }]} />
          <Text style={styles.pillText}>
            {connected ? 'Connected' : pad.connection === 'disconnected' ? 'Connect' : 'Searching…'}
          </Text>
        </Pressable>
      </View>

      <View style={styles.headline}>
        <Text style={[styles.stateText, { color: accent }]}>{stateLabel[state]}</Text>
        <Text style={styles.subtitle}>{subtitle}</Text>
        {pad.error && !demo && <Text style={styles.error}>{pad.error}</Text>}
      </View>

      <View>
        <PadModel
          state={state}
          accent={accent}
          speedKmh={s?.speedKmh ?? 0}
          vibrationLevel={vibrationLevel}
          displayText={state === 'offline' ? '--' : state === 'vibrating' ? `L${vibrationLevel}` : live.value}
        />
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
        {connected && (
          <Pressable onPress={() => router.push('/workout')} style={styles.expand} hitSlop={12}>
            <ExpandIcon color={colors.text} size={20} />
          </Pressable>
        )}
      </View>

      <View style={styles.stepsBlock}>
        <Text style={styles.stepsValue}>{totals ? totals.steps.toLocaleString() : '0'}</Text>
        <Eyebrow color={accent}>Steps</Eyebrow>
      </View>
      <Panel style={styles.metricsRow}>
        <Metric label="Time" value={totals ? formatTime(totals.seconds) : '00:00'} />
        <View style={styles.divider} />
        <Metric label="Distance" value={dist?.value ?? '0.00'} unit={dist?.unit ?? (units === 'imperial' ? 'mi' : 'km')} />
        <View style={styles.divider} />
        <Metric label="Calories" value={totals ? String(totals.calories) : '0'} unit="kcal" />
      </Panel>

      <Panel>
        <View style={styles.rowBetween}>
          <Eyebrow>Target speed</Eyebrow>
          <Pressable onPress={() => router.push('/workout')} disabled={!connected} hitSlop={8}>
            <Eyebrow color={connected ? accent : colors.faint}>Full screen ›</Eyebrow>
          </Pressable>
        </View>
        <View style={styles.speedRow}>
          <IconButton label="−" accent={accent} disabled={!connected} onPress={() => actions.changeTarget(target - SPEED_STEP)} />
          <View style={{ alignItems: 'center' }}>
            <Text style={styles.target}>{tgt.value}</Text>
            <Eyebrow>{tgt.unit}</Eyebrow>
          </View>
          <IconButton label="+" accent={accent} disabled={!connected} onPress={() => actions.changeTarget(target + SPEED_STEP)} />
        </View>
        <SegmentTrack
          count={speedSteps}
          value={Math.round((target - minSpeed) / SPEED_STEP) + 1}
          onSelect={(i) => actions.changeTarget(minSpeed + (i - 1) * SPEED_STEP)}
          accent={accent}
          disabled={!connected}
          labels={units === 'metric' ? speedLabels : undefined}
        />
        <View style={styles.actions}>
          {walking ? (
            <ActionButton label="Pause" color={stateAccent.paused} onPress={actions.pause} disabled={!connected} flex={1} />
          ) : (
            <ActionButton
              label={state === 'paused' ? 'Resume' : 'Start'}
              color={stateAccent.running}
              filled
              onPress={actions.start}
              disabled={!connected || state === 'stopping'}
              flex={1}
            />
          )}
          <ActionButton label="Stop" color={colors.danger} onPress={actions.stop} disabled={!connected} />
        </View>
      </Panel>

      {caps.vibration && (
        <Panel>
          <View style={styles.rowBetween}>
            <Eyebrow>Vibration</Eyebrow>
            <Eyebrow color={state === 'vibrating' ? accent : colors.muted}>
              {state === 'vibrating' ? `Level ${vibrationLevel}` : canVibrate ? 'Off' : 'Stop the belt first'}
            </Eyebrow>
          </View>
          <SegmentTrack
            count={levels}
            value={vibrationLevel}
            onSelect={actions.vibrate}
            accent={stateAccent.vibrating}
            disabled={!canVibrate}
            labels={Array.from({ length: levels }, (_, i) => String(i + 1))}
          />
          {state === 'vibrating' && (
            <Animated.View entering={FadeIn} exiting={FadeOut}>
              <ActionButton label="Vibration off" color={stateAccent.vibrating} onPress={actions.stopVibration} />
            </Animated.View>
          )}
        </Panel>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 },
  title: { fontFamily: fonts.display, color: colors.text, fontSize: 30, letterSpacing: 1 },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderRadius: 999,
    paddingHorizontal: 14, paddingVertical: 9, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  pillText: { fontFamily: fonts.medium, color: colors.text, fontSize: 13 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  headline: { alignItems: 'center', marginTop: 4, gap: 2 },
  stateText: { fontFamily: fonts.display, fontSize: 34, letterSpacing: 6, textTransform: 'uppercase' },
  subtitle: { fontFamily: fonts.medium, color: colors.muted, fontSize: 14, textAlign: 'center' },
  error: { color: colors.danger, fontSize: 13, textAlign: 'center', marginTop: 4 },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  countdown: { fontFamily: fonts.display, fontSize: 120, textShadowRadius: 30, textShadowOffset: { width: 0, height: 0 } },
  expand: {
    position: 'absolute', right: 4, bottom: 8, width: 40, height: 40, borderRadius: 20,
    alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.06)',
  },
  stepsBlock: { alignItems: 'center', marginTop: -8 },
  stepsValue: { fontFamily: fonts.display, color: colors.text, fontSize: 64, fontVariant: ['tabular-nums'], lineHeight: 70 },
  metricsRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch', backgroundColor: colors.panelBorder },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  speedRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  target: { fontFamily: fonts.display, color: colors.text, fontSize: 56, fontVariant: ['tabular-nums'], lineHeight: 62 },
  actions: { flexDirection: 'row', gap: 10 },
});
