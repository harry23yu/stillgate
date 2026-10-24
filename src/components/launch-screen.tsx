import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useRef, useState } from 'react';
import { AccessibilityInfo, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { scheduleOnRN } from 'react-native-worklets';

import { ThemedText } from '@/components/themed-text';
import { Colors, Fonts, Spacing } from '@/constants/theme';

/** Calm, on-brand launch screen. Doubles as the startup splash and the
 *  "getting ready" loading state. Held for a minimum so it never flickers,
 *  then fades out once the app is ready. Respects Reduce Motion. */
const MIN_DISPLAY_MS = 1200;
const TAGLINE = 'A calmer way through the airport.';
const A11Y_LABEL = `Stillgate. ${TAGLINE} Loading.`;

export function LaunchScreen() {
  const reduced = useReducedMotion();
  const [visible, setVisible] = useState(true);
  const started = useRef(false);

  const overlayOpacity = useSharedValue(1);
  const contentOpacity = useSharedValue(0);
  const contentY = useSharedValue(8);
  const pulse = useSharedValue(0.35);

  const overlayStyle = useAnimatedStyle(() => ({ opacity: overlayOpacity.value }));
  const contentStyle = useAnimatedStyle(() => ({
    opacity: contentOpacity.value,
    transform: [{ translateY: contentY.value }],
  }));
  const pulseStyle = useAnimatedStyle(() => ({ opacity: pulse.value }));

  // Hide the native splash only once our screen has laid out (no blank flash),
  // then run the entrance, hold for the minimum, and fade out.
  const handleLayout = useCallback(() => {
    if (started.current) return;
    started.current = true;

    SplashScreen.hideAsync()
      .catch(() => {})
      .finally(() => {
        contentOpacity.value = withTiming(1, {
          duration: reduced ? 160 : 520,
          easing: Easing.out(Easing.cubic),
        });
        contentY.value = reduced ? 0 : withTiming(0, { duration: 520, easing: Easing.out(Easing.cubic) });
        pulse.value = reduced
          ? 0.85
          : withRepeat(withTiming(1, { duration: 820, easing: Easing.inOut(Easing.quad) }), -1, true);

        AccessibilityInfo.announceForAccessibility?.(A11Y_LABEL);

        setTimeout(() => {
          overlayOpacity.value = withTiming(
            0,
            { duration: reduced ? 220 : 420, easing: Easing.inOut(Easing.quad) },
            (finished) => {
              'worklet';
              if (finished) scheduleOnRN(setVisible, false);
            },
          );
        }, MIN_DISPLAY_MS);
      });
  }, [reduced, overlayOpacity, contentOpacity, contentY, pulse]);

  if (!visible) return null;

  return (
    <Animated.View
      onLayout={handleLayout}
      style={[styles.overlay, overlayStyle]}
      accessible
      accessibilityViewIsModal
      importantForAccessibility="yes"
      accessibilityLabel={A11Y_LABEL}>
      <Animated.View style={[styles.brand, contentStyle]}>
        <ThemedText type="title" style={styles.wordmark}>
          Stillgate
        </ThemedText>
        <ThemedText themeColor="textSecondary" style={styles.tagline}>
          {TAGLINE}
        </ThemedText>
      </Animated.View>

      <View style={styles.loading} importantForAccessibility="no-hide-descendants">
        <View style={styles.dots}>
          <Animated.View style={[styles.dot, pulseStyle]} />
          <Animated.View style={[styles.dot, pulseStyle]} />
          <Animated.View style={[styles.dot, pulseStyle]} />
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Getting things ready…
        </ThemedText>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  brand: {
    alignItems: 'center',
    paddingHorizontal: Spacing.four,
  },
  wordmark: {
    fontFamily: Fonts.sansBold,
    fontSize: 42,
    lineHeight: 48,
    letterSpacing: 0.5,
  },
  tagline: {
    marginTop: Spacing.two,
    fontSize: 17,
    lineHeight: 24,
    textAlign: 'center',
  },
  loading: {
    position: 'absolute',
    bottom: Spacing.six,
    alignItems: 'center',
    gap: Spacing.two,
  },
  dots: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.primary,
  },
});
