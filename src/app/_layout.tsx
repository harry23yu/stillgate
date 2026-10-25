import { ConvexProvider } from 'convex/react';
import { DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';

import { LaunchScreen } from '@/components/launch-screen';
import { Colors } from '@/constants/theme';
import { convex } from '@/lib/convex';

SplashScreen.preventAutoHideAsync();

const stillgateTheme = {
  ...DefaultTheme,
  dark: false,
  colors: {
    ...DefaultTheme.colors,
    primary: Colors.primary,
    background: Colors.background,
    card: Colors.surface,
    text: Colors.text,
    border: Colors.border,
  },
};

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    'AtkinsonHyperlegible-Regular': require('@/assets/fonts/AtkinsonHyperlegible-Regular.ttf'),
    'AtkinsonHyperlegible-Bold': require('@/assets/fonts/AtkinsonHyperlegible-Bold.ttf'),
  });

  if (!fontsLoaded) {
    return null;
  }

  const app = (
    <ThemeProvider value={stillgateTheme}>
      <LaunchScreen />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="gate-change" options={{ presentation: 'card' }} />
        <Stack.Screen name="flight-lookup" options={{ presentation: 'modal' }} />
        <Stack.Screen name="review" options={{ presentation: 'modal' }} />
      </Stack>
    </ThemeProvider>
  );

  return convex ? <ConvexProvider client={convex}>{app}</ConvexProvider> : app;
}
