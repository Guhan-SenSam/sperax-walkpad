import Constants from 'expo-constants';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, type ReactNode } from 'react';
import { Alert, Pressable, StyleSheet, Switch, Text, View } from 'react-native';
import { SPEED_STEP, useApp } from '../../AppProvider';
import { PageTitle, Screen } from '../../components/Screen';
import { ActionButton, Eyebrow, Panel } from '../../components/ui';
import { speed } from '../../format';
import { openHealthConnectSettings } from '../../health';
import { colors, fonts, stateAccent } from '../../theme';

const GOAL_STEP = 500;

export default function SettingsScreen() {
  const { settings, updateSettings: set, log, pad, demo, actions, connected } = useApp();
  const accent = stateAccent.idle;
  const pending = log.workouts.filter((w) => !w.synced).length;
  const lastSync = settings.lastSyncAt
    ? new Date(settings.lastSyncAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
    : 'Never';
  const defaultSpeed = speed(settings.defaultSpeed, settings.units);

  // Permissions can change in the Health Connect app; re-check when returning here.
  const { refreshHealth } = log;
  useFocusEffect(useCallback(() => refreshHealth(), [refreshHealth]));

  const confirmDeleteAll = () =>
    Alert.alert('Delete all workouts?', 'This clears your history in this app. Data already in Health Connect stays there.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete all', style: 'destructive', onPress: () => log.deleteAll() },
    ]);

  return (
    <Screen accent={accent}>
      <PageTitle>Settings</PageTitle>

      <Section title="Health Connect">
        <Row
          label={log.healthLinked ? 'Linked' : 'Not linked'}
          detail={
            log.healthLinked
              ? 'Steps, distance, calories and walking sessions are shared with Health Connect.'
              : 'Link to share your walks with Health Sync, Google Fit, Samsung Health and others.'
          }
          right={<View style={[styles.dot, { backgroundColor: log.healthLinked ? '#34d399' : colors.faint }]} />}
        />
        {log.syncError && <Text style={styles.error}>{log.syncError}</Text>}
        {log.healthLinked ? (
          <>
            <Row
              label="Sync automatically"
              detail="Send each workout as soon as it finishes."
              right={<Toggle value={settings.autoSync} onChange={(v) => set({ autoSync: v })} />}
            />
            <Row
              label="Sync now"
              detail={`${pending === 0 ? 'Everything is synced' : `${pending} workout${pending === 1 ? '' : 's'} waiting`} · last sync ${lastSync}`}
              right={
                <SmallButton label={log.syncing ? 'Syncing…' : 'Sync'} onPress={log.syncPending} disabled={log.syncing || pending === 0} />
              }
            />
            <Row
              label="Re-send all workouts"
              detail="Use this if you cleared data in Health Connect. Workouts already there are updated, not duplicated."
              right={<SmallButton label="Re-send" onPress={log.resyncAll} disabled={log.syncing || log.workouts.length === 0} />}
            />
            <Row label="Manage permissions" right={<SmallButton label="Open" onPress={() => openHealthConnectSettings()} />} />
          </>
        ) : (
          <ActionButton label="Link Health Connect" color={stateAccent.running} filled onPress={log.linkHealth} />
        )}
      </Section>

      <Section title="Feedback">
        <Row
          label="Sounds"
          detail="Short tones for start, speed changes, pause, stop and the countdown. Plays alongside your music."
          right={<Toggle value={settings.sounds} onChange={(v) => set({ sounds: v })} />}
        />
        <Row
          label="Vibrate phone"
          detail="Haptic taps for the same events."
          right={<Toggle value={settings.haptics} onChange={(v) => set({ haptics: v })} />}
        />
        <Row
          label="Preview"
          right={
            <SmallButton
              label="Play"
              onPress={() => actions.preview('go')}
              disabled={!settings.sounds && !settings.haptics}
            />
          }
        />
      </Section>

      <Section title="Workout">
        <Row
          label="Full screen when starting"
          detail="Open the large controls automatically when the belt starts."
          right={<Toggle value={settings.autoFullScreen} onChange={(v) => set({ autoFullScreen: v })} />}
        />
        <Row
          label="Keep screen on"
          detail="Stops your phone from locking during a workout."
          right={<Toggle value={settings.keepAwake} onChange={(v) => set({ keepAwake: v })} />}
        />
        <Row
          label="Starting speed"
          detail="The belt ramps up to this after the countdown."
          right={
            <Stepper
              value={`${defaultSpeed.value} ${defaultSpeed.unit}`}
              onMinus={() => set({ defaultSpeed: Math.max(1, settings.defaultSpeed - SPEED_STEP) })}
              onPlus={() => set({ defaultSpeed: Math.min(6, settings.defaultSpeed + SPEED_STEP) })}
            />
          }
        />
        <Row
          label="Daily step goal"
          right={
            <Stepper
              value={settings.stepGoal.toLocaleString()}
              onMinus={() => set({ stepGoal: Math.max(GOAL_STEP, settings.stepGoal - GOAL_STEP) })}
              onPlus={() => set({ stepGoal: Math.min(50000, settings.stepGoal + GOAL_STEP) })}
            />
          }
        />
      </Section>

      <Section title="Display">
        <Row
          label="Units"
          right={
            <Segmented
              options={[
                { value: 'metric', label: 'km' },
                { value: 'imperial', label: 'mi' },
              ]}
              value={settings.units}
              onChange={(units) => set({ units: units as 'metric' | 'imperial' })}
            />
          }
        />
      </Section>

      <Section title="Pad">
        <Row
          label={connected ? (demo ? 'Demo pad' : (pad.info?.name ?? 'Connected')) : 'No pad connected'}
          detail={connected ? (demo ? 'Simulated data' : pad.info?.protocol) : 'Go to the Pad tab and tap Connect.'}
          right={connected ? <SmallButton label="Disconnect" onPress={actions.disconnect} /> : undefined}
        />
        <Row
          label="Demo mode"
          detail="Preview the app without a pad. Demo walks are never saved or synced."
          right={<Toggle value={demo} onChange={(v) => actions.setDemo(v)} />}
        />
      </Section>

      <Section title="Data">
        <Row
          label="Delete all workouts"
          detail={`${log.workouts.length} saved on this phone`}
          right={<SmallButton label="Delete" danger onPress={confirmDeleteAll} disabled={log.workouts.length === 0} />}
        />
      </Section>

      <Section title="About">
        <Row label="Show the intro again" right={<SmallButton label="Open" onPress={() => router.push('/onboarding')} />} />
        <Text style={styles.about}>
          Walkpad {Constants.expoConfig?.version ?? ''} · An open-source app for Sperax and FTMS walking pads. Not affiliated
          with Sperax. Your data stays on your phone and in Health Connect.
        </Text>
      </Section>
    </Screen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={{ gap: 8 }}>
      <Eyebrow>{title}</Eyebrow>
      <Panel style={{ gap: 0, paddingVertical: 6 }}>{children}</Panel>
    </View>
  );
}

function Row({ label, detail, right }: { label: string; detail?: string; right?: ReactNode }) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, gap: 2 }}>
        <Text style={styles.label}>{label}</Text>
        {detail ? <Text style={styles.detail}>{detail}</Text> : null}
      </View>
      {right}
    </View>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ false: '#273248', true: '#0e7490' }}
      thumbColor={value ? '#22d3ee' : '#94a3b8'}
    />
  );
}

function SmallButton({ label, onPress, disabled, danger }: {
  label: string; onPress: () => void; disabled?: boolean; danger?: boolean;
}) {
  const color = danger ? colors.danger : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [styles.small, { borderColor: `${color}44` }, disabled && { opacity: 0.35 }, pressed && { opacity: 0.6 }]}
    >
      <Text style={[styles.smallText, { color }]}>{label}</Text>
    </Pressable>
  );
}

function Stepper({ value, onMinus, onPlus }: { value: string; onMinus: () => void; onPlus: () => void }) {
  return (
    <View style={styles.stepper}>
      <Pressable onPress={onMinus} style={styles.stepBtn} hitSlop={6}>
        <Text style={styles.stepSign}>−</Text>
      </Pressable>
      <Text style={styles.stepValue}>{value}</Text>
      <Pressable onPress={onPlus} style={styles.stepBtn} hitSlop={6}>
        <Text style={styles.stepSign}>+</Text>
      </Pressable>
    </View>
  );
}

function Segmented({ options, value, onChange }: {
  options: { value: string; label: string }[]; value: string; onChange: (v: string) => void;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, value === o.value && styles.segmentOn]}>
          <Text style={[styles.segmentText, value === o.value && { color: '#04121a' }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.panelBorder,
  },
  label: { fontFamily: fonts.medium, color: colors.text, fontSize: 15 },
  detail: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  error: { color: colors.danger, fontSize: 13, paddingVertical: 8 },
  small: { borderWidth: 1, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 8 },
  smallText: { fontFamily: fonts.medium, fontSize: 13 },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  stepBtn: {
    width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  stepSign: { color: colors.text, fontSize: 18, lineHeight: 20, fontFamily: fonts.display },
  stepValue: { fontFamily: fonts.display, color: colors.text, fontSize: 14, minWidth: 64, textAlign: 'center', fontVariant: ['tabular-nums'] },
  segmented: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 3 },
  segment: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 8 },
  segmentOn: { backgroundColor: '#22d3ee' },
  segmentText: { fontFamily: fonts.medium, color: colors.text, fontSize: 13 },
  about: { color: colors.muted, fontSize: 12, lineHeight: 18, paddingVertical: 12 },
});
