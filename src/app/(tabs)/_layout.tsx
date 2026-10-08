import { Redirect, Tabs } from 'expo-router';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '../../AppProvider';
import { ActivityIcon, PadIcon, SettingsIcon } from '../../components/icons';
import { colors, fonts } from '../../theme';

export default function TabsLayout() {
  const { settings, settingsLoaded } = useApp();
  const insets = useSafeAreaInsets();
  if (!settingsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;
  if (!settings.onboarded) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.bg },
        tabBarActiveTintColor: '#22d3ee',
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: '#070a12',
          borderTopColor: colors.panelBorder,
          height: 62 + insets.bottom,
          paddingTop: 6,
          paddingBottom: insets.bottom + 4,
        },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 0.5 },
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Pad', tabBarIcon: ({ color }) => <PadIcon color={color} /> }} />
      <Tabs.Screen
        name="activity"
        options={{ title: 'Activity', tabBarIcon: ({ color }) => <ActivityIcon color={color} /> }}
      />
      <Tabs.Screen
        name="settings"
        options={{ title: 'Settings', tabBarIcon: ({ color }) => <SettingsIcon color={color} /> }}
      />
    </Tabs>
  );
}
