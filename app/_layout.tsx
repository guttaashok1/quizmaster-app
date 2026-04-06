import { useEffect, useState } from 'react';
import { StatusBar } from 'react-native';
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
  const [hydrated, setHydrated] = useState(false);

  // Wait for Zustand store to rehydrate from AsyncStorage before checking onboarding
  useEffect(() => {
    const unsub = useUserStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
    // If already hydrated (e.g. sync storage)
    if (useUserStore.persist.hasHydrated()) {
      setHydrated(true);
    }
    return () => unsub();
  }, []);

  useEffect(() => {
    if (hydrated && !hasCompletedOnboarding) {
      router.replace('/welcome');
    }
  }, [hydrated, hasCompletedOnboarding]);

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
