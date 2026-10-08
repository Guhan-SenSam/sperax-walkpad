import { router } from 'expo-router';
import { useRef, useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../AppProvider';
import { GoalRing } from '../components/charts';
import { PadModel } from '../components/PadModel';
import { Screen } from '../components/Screen';
import { ActionButton, Eyebrow } from '../components/ui';
import type { PadState } from '../protocol';
import { colors, fonts, stateAccent } from '../theme';

interface Page {
  eyebrow: string;
  title: string;
  points: string[];
  art: ReactNode;
  accent: string;
}

const model = (state: PadState, speedKmh = 0, vibrationLevel = 0, displayText = '') => (
  <PadModel
    state={state}
    accent={stateAccent[state]}
    speedKmh={speedKmh}
    vibrationLevel={vibrationLevel}
    displayText={displayText}
  />
);

export default function Onboarding() {
  const { settings, updateSettings, log } = useApp();
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);
  const [page, setPage] = useState(0);

  const pages: Page[] = [
    {
      eyebrow: 'Welcome',
      title: 'Your walking pad, back in your hands',
      points: [
        'Control your Sperax pad without the old SPX app, an account or a server.',
        'Start, stop, set the speed and use vibration, with live steps, time and distance.',
      ],
      art: model('running', 3.5, 0, '3.5'),
      accent: stateAccent.running,
    },
    {
      eyebrow: 'Connect',
      title: 'Pairing takes one tap',
      points: [
        'Plug in and switch on your pad.',
        'Close the old app on other phones. A pad accepts only one connection at a time.',
        'Tap Connect on the Pad tab. The pad is found automatically.',
      ],
      art: model('idle', 0, 0, '0.0'),
      accent: stateAccent.idle,
    },
    {
      eyebrow: 'Walk safely',
      title: 'You are always in control',
      points: [
        'Start counts down 3-2-1 before the belt moves, then ramps up gently.',
        'Pause or Stop at any time. The pad’s own remote keeps working too.',
        'Tap the expand icon for full-screen controls with big buttons while you walk.',
      ],
      art: model('paused', 0, 0, '2.5'),
      accent: stateAccent.paused,
    },
    {
      eyebrow: 'Track',
      title: 'Every step counts',
      points: [
        'Workouts save automatically when you stop. A pause never ends one.',
        'Link Health Connect to share steps with Health Sync, Google Fit or Samsung Health.',
      ],
      art: (
        <View style={{ alignItems: 'center', paddingVertical: 24 }}>
          <GoalRing value={6420} goal={8000} color={stateAccent.running} size={170} />
        </View>
      ),
      accent: stateAccent.vibrating,
    },
  ];
  const last = page === pages.length - 1;

  const go = (i: number) => {
    scroller.current?.scrollTo({ x: i * width, animated: true });
    setPage(i);
  };

  const finish = () => {
    updateSettings({ onboarded: true });
    if (settings.onboarded && router.canGoBack()) router.back();
    else router.replace('/');
  };

  return (
    <Screen accent={pages[page].accent} scroll={false}>
      <View style={styles.skipRow}>
        <Eyebrow>{`${page + 1} / ${pages.length}`}</Eyebrow>
        {!last && (
          <Text style={styles.skip} onPress={finish}>
            Skip
          </Text>
        )}
      </View>
      <ScrollView
        ref={scroller}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setPage(Math.round(e.nativeEvent.contentOffset.x / width))}
        style={{ marginHorizontal: -18, flex: 1 }}
      >
        {pages.map((p, i) => (
          <View key={i} style={[styles.page, { width }]}>
            <View style={styles.art}>{p.art}</View>
            <Eyebrow color={p.accent}>{p.eyebrow}</Eyebrow>
            <Text style={styles.title}>{p.title}</Text>
            <View style={{ gap: 12, marginTop: 6 }}>
              {p.points.map((t, j) => (
                <View key={j} style={styles.point}>
                  <View style={[styles.bullet, { backgroundColor: p.accent }]} />
                  <Text style={styles.pointText}>{t}</Text>
                </View>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: Math.max(0, 8 - insets.bottom) }]}>
        <View style={styles.dots}>
          {pages.map((p, i) => (
            <View key={i} style={[styles.dot, i === page && { backgroundColor: pages[page].accent, width: 22 }]} />
          ))}
        </View>
        {last && !log.healthLinked && (
          <ActionButton label="Link Health Connect" color={stateAccent.running} onPress={log.linkHealth} />
        )}
        <ActionButton
          label={last ? 'Get started' : 'Next'}
          color={pages[page].accent}
          filled
          onPress={() => (last ? finish() : go(page + 1))}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  skipRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  skip: { fontFamily: fonts.medium, color: colors.muted, fontSize: 15, padding: 4 },
  page: { paddingHorizontal: 24, gap: 10, justifyContent: 'center' },
  art: { marginBottom: 12 },
  title: { fontFamily: fonts.display, color: colors.text, fontSize: 30, lineHeight: 36 },
  point: { flexDirection: 'row', gap: 12, alignItems: 'flex-start' },
  bullet: { width: 6, height: 6, borderRadius: 3, marginTop: 8 },
  pointText: { flex: 1, color: '#c3cddd', fontSize: 16, lineHeight: 23 },
  footer: { gap: 12 },
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 4 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.faint },
});
