import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../theme';

/** Dark gradient page with a glow tinted by the current state colour. */
export function Screen({ accent, children, scroll = true }: { accent: string; children: ReactNode; scroll?: boolean }) {
  const insets = useSafeAreaInsets();
  const pad = { paddingTop: insets.top + 16, paddingBottom: insets.bottom + 24 };
  return (
    <View style={styles.root}>
      <LinearGradient colors={[colors.bgTop, colors.bg]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[`${accent}26`, 'transparent']} style={[StyleSheet.absoluteFill, { height: 520 }]} />
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, pad]}>{children}</ScrollView>
      ) : (
        <View style={[styles.content, pad, { flex: 1 }]}>{children}</View>
      )}
    </View>
  );
}

export function PageTitle({ children }: { children: ReactNode }) {
  return <Text style={styles.title}>{children}</Text>;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { paddingHorizontal: 18, gap: 16 },
  title: { fontFamily: fonts.display, color: colors.text, fontSize: 30, letterSpacing: 0.5 },
});
