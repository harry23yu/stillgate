import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { ConvexProvider, ConvexReactClient } from 'convex/react';
import type { ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { LaunchScreen } from '@/components/launch-screen';
import { SettingsProvider, useSettings } from '@/contexts/settings';
import { useTheme } from '@/hooks/use-theme';

SplashScreen.preventAutoHideAsync();

// Created once at module load. Null until EXPO_PUBLIC_CONVEX_URL is set in .env.local,
// so the app runs entirely on local mock data until Convex is wired up. See src/data/client.ts.
const convexUrl = process.env.EXPO_PUBLIC_CONVEX_URL;
const convexClient = convexUrl ? new ConvexReactClient(convexUrl) : null;

function ConvexGate({ children }: { children: ReactNode }) {
  if (!convexClient) return <>{children}</>;
  return <ConvexProvider client={convexClient}>{children}</ConvexProvider>;
}

function ThemedApp() {
  const palette = useTheme();
  const { settings } = useSettings();
  const system = useColorScheme();
  const scheme = settings.theme === 'system' ? system ?? 'light' : settings.theme;

  const navTheme = {
    ...DefaultTheme,
    dark: scheme === 'dark',
    colors: {
      ...DefaultTheme.colors,
      primary: palette.primary,
      background: palette.background,
      card: palette.surface,
      text: palette.text,
      border: palette.border,
    },
  };

  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <LaunchScreen />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="gate-change" options={{ presentation: 'card' }} />
        <Stack.Screen name="flight-lookup" options={{ presentation: 'modal' }} />
        <Stack.Screen name="settings" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'AtkinsonHyperlegible-Regular': require('@/assets/fonts/AtkinsonHyperlegible-Regular.ttf'),
    'AtkinsonHyperlegible-Bold': require('@/assets/fonts/AtkinsonHyperlegible-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  return (
    <ConvexGate>
      <SettingsProvider>
        <ThemedApp />
      </SettingsProvider>
    </ConvexGate>
  );
}
