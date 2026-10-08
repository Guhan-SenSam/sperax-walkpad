import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useApp } from '../AppProvider';
import { PageTitle, Screen } from '../components/Screen';
import { ActionButton, Eyebrow, Panel } from '../components/ui';
import { colors, fonts, stateAccent } from '../theme';

const KM_PER_MI = 1.609344;
const pad2 = (n: number) => String(n).padStart(2, '0');

/**
 * Log a walk by hand. Fields can be prefilled with query params, e.g.
 * walkpad://add-workout?start=2026-10-07T21:14&minutes=13.5&steps=1157&km=0.38&kcal=46
 * Nothing is saved until the user taps Save.
 */
export default function AddWorkout() {
  const { log, settings } = useApp();
  const p = useLocalSearchParams<{ start?: string; minutes?: string; steps?: string; km?: string; kcal?: string }>();
  const imperial = settings.units === 'imperial';

  const [initial] = useState(() => {
    const d = p.start ? new Date(p.start) : new Date(Date.now() - 30 * 60_000);
    const km = p.km ? Number(p.km) : 0;
    return {
      date: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
      time: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
      minutes: p.minutes ?? '30',
      steps: p.steps ?? '',
      distance: km ? (imperial ? (km / KM_PER_MI).toFixed(2) : String(km)) : '',
      calories: p.kcal ?? '',
    };
  });
  const [f, setF] = useState(initial);
  const [error, setError] = useState<string | null>(null);
  const field = (k: keyof typeof f) => (v: string) => setF((prev) => ({ ...prev, [k]: v }));

  const save = async () => {
    const start = new Date(`${f.date}T${f.time}`);
    const minutes = Number(f.minutes);
    const steps = Math.round(Number(f.steps || 0));
    const dist = Number(f.distance || 0);
    const kcal = Math.round(Number(f.calories || 0));
    if (Number.isNaN(start.getTime())) return setError('Check the date (YYYY-MM-DD) and time (HH:MM).');
    if (!(minutes > 0)) return setError('Duration must be more than 0 minutes.');
    if ([steps, dist, kcal].some((n) => Number.isNaN(n) || n < 0)) return setError('Numbers can’t be negative.');
    if (start.getTime() + minutes * 60_000 > Date.now() + 60_000) return setError('The walk can’t end in the future.');

    await log.addManual({
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + minutes * 60_000).toISOString(),
      seconds: Math.round(minutes * 60),
      steps,
      distanceKm: Math.round((imperial ? dist * KM_PER_MI : dist) * 100) / 100,
      calories: kcal,
    });
    if (router.canGoBack()) router.back();
    else router.replace('/activity');
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior="padding">
      <Screen accent={stateAccent.running}>
        <PageTitle>Add workout</PageTitle>
        <Text style={styles.hint}>
          Log a walk the app missed. It is saved here and, if linked, sent to Health Connect as a manual entry.
        </Text>
        <Panel>
          <View style={styles.row}>
            <Field label="Date" value={f.date} onChange={field('date')} placeholder="YYYY-MM-DD" />
            <Field label="Start time" value={f.time} onChange={field('time')} placeholder="HH:MM" />
          </View>
          <View style={styles.row}>
            <Field label="Duration (min)" value={f.minutes} onChange={field('minutes')} numeric />
            <Field label="Steps" value={f.steps} onChange={field('steps')} numeric />
          </View>
          <View style={styles.row}>
            <Field label={`Distance (${imperial ? 'mi' : 'km'})`} value={f.distance} onChange={field('distance')} numeric />
            <Field label="Calories (kcal)" value={f.calories} onChange={field('calories')} numeric />
          </View>
        </Panel>
        {error && <Text style={styles.error}>{error}</Text>}
        <ActionButton label="Save" color={stateAccent.running} filled onPress={save} />
        <ActionButton label="Cancel" color={colors.muted} onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))} />
      </Screen>
    </KeyboardAvoidingView>
  );
}

function Field({ label, value, onChange, placeholder, numeric }: {
  label: string; value: string; onChange: (v: string) => void; placeholder?: string; numeric?: boolean;
}) {
  return (
    <View style={{ flex: 1, gap: 6 }}>
      <Eyebrow>{label}</Eyebrow>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.faint}
        keyboardType={numeric ? 'decimal-pad' : 'numbers-and-punctuation'}
        style={styles.input}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  hint: { color: colors.muted, fontSize: 14, lineHeight: 20 },
  row: { flexDirection: 'row', gap: 12 },
  input: {
    fontFamily: fonts.display, color: colors.text, fontSize: 18,
    borderWidth: 1, borderColor: colors.panelBorder, borderRadius: 12,
    paddingHorizontal: 12, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.03)',
  },
  error: { color: colors.danger, fontSize: 14 },
});
