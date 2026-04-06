import { useEffect, useState, useCallback } from 'react';
import { StatusBar, View, Text, StyleSheet, Platform } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { useUserStore } from '../src/stores/useUserStore';

SplashScreen.preventAutoHideAsync();

function useStoreHydration(): boolean {
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    // Check if already hydrated
    if (useUserStore.persist.hasHydrated()) {
      setHydrated(true);
      return;
    }

    // Listen for hydration to finish
    const unsub = useUserStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });

    // Fallback for web: manually check localStorage
    if (Platform.OS === 'web' && typeof window !== 'undefined') {
      // Give AsyncStorage a moment to load, then check
      const timer = setTimeout(() => {
        if (!useUserStore.persist.hasHydrated()) {
          // Force re-check — AsyncStorage on web is synchronous via localStorage
          setHydrated(true);
        }
      }, 500);
      return () => { unsub(); clearTimeout(timer); };
    }

    return unsub;
  }, []);

  return hydrated;
}

function RootLayoutNav() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const segments = useSegments();
  const hydrated = useStoreHydration();
  const hasCompletedOnboarding = useUserStore((s) => s.hasCompletedOnboarding);

  useEffect(() => {
    if (!hydrated) return;

    const onAuthScreen = segments[0] === 'welcome' || segments[0] === 'onboarding';

    if (!hasCompletedOnboarding && !onAuthScreen) {
      // Not logged in and not on auth screen -> go to welcome
      router.replace('/welcome');
    } else if (hasCompletedOnboarding && onAuthScreen) {
      // Already logged in but on auth screen -> go to home
      router.replace('/');
    }
  }, [hydrated, hasCompletedOnboarding, segments]);

  // Show loading screen while store hydrates
  if (!hydrated) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 48 }}>{'\uD83E\uDDE0'}</Text>
        <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading...</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="welcome" options={{ headerShown: false }} />
        <Stack.Screen name="onboarding" options={{ headerShown: false }} />
        <Stack.Screen name="topic-input" />
        <Stack.Screen name="quiz" />
        <Stack.Screen name="leaderboard" />
        <Stack.Screen name="profile" />
        <Stack.Screen name="review" />
        <Stack.Screen name="history" />
        <Stack.Screen name="quiz-review" />
        <Stack.Screen name="+not-found" />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  const [loaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) return null;

  return (
    <ThemeProvider>
      <RootLayoutNav />
    </ThemeProvider>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  loadingText: {
    fontSize: 16,
    fontWeight: '600',
  },
});
