import { useEffect, useState } from 'react';
import { Platform, StatusBar } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import 'react-native-reanimated';
import { ThemeProvider, useTheme } from '../src/theme/ThemeContext';
import { useUserStore } from '../src/stores/useUserStore';

SplashScreen.preventAutoHideAsync();

function RootLayoutNav() {
  const { colors, isDark } = useTheme();
  const router = useRouter();
  const hasCompletedOnboarding = useUserStore((s) => s.hasCompletedOnboarding);
  const [ready, setReady] = useState(false);

  // Wait for store to rehydrate before making any routing decisions
  useEffect(() => {
    let timeout: ReturnType<typeof setTimeout>;

    const checkHydration = () => {
      try {
        if (useUserStore.persist.hasHydrated()) {
          setReady(true);
          return;
        }
      } catch {}

      // Fallback: check localStorage directly on web
      if (Platform.OS === 'web' && typeof window !== 'undefined') {
        try {
          const stored = localStorage.getItem('user-storage');
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.state?.hasCompletedOnboarding === true) {
              setReady(true);
              return;
            }
          }
        } catch {}
      }

      // Also listen for hydration event
      const unsub = useUserStore.persist.onFinishHydration(() => {
        setReady(true);
        unsub();
      });

      // Safety timeout — if hydration takes too long, proceed anyway
      timeout = setTimeout(() => setReady(true), 1500);
    };

    checkHydration();
    return () => clearTimeout(timeout);
  }, []);

  // Only redirect to welcome if store is hydrated AND user hasn't onboarded
  useEffect(() => {
    if (ready && !hasCompletedOnboarding) {
      router.replace('/welcome');
    }
  }, [ready, hasCompletedOnboarding]);

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
