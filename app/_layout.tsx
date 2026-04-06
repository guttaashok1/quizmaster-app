import { useEffect, useState } from 'react';
import { StatusBar, View, Text, StyleSheet, Platform, ActivityIndicator } from 'react-native';
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
  const [isReady, setIsReady] = useState(false);
  const [checkedOnce, setCheckedOnce] = useState(false);

  useEffect(() => {
    // On web, AsyncStorage is backed by localStorage which is synchronous
    // Give Zustand a tick to rehydrate, then check
    const timer = setTimeout(() => {
      setIsReady(true);
    }, Platform.OS === 'web' ? 100 : 0);

    // Also listen for the persist rehydration
    try {
      if (useUserStore.persist.hasHydrated()) {
        setIsReady(true);
        clearTimeout(timer);
      } else {
        const unsub = useUserStore.persist.onFinishHydration(() => {
          setIsReady(true);
          clearTimeout(timer);
          unsub();
        });
      }
    } catch {
      // If persist API isn't available, rely on timeout
    }

    return () => clearTimeout(timer);
  }, []);

  // Handle navigation after hydration — only once
  useEffect(() => {
    if (!isReady || checkedOnce) return;
    setCheckedOnce(true);

    // Re-read from store after hydration
    const onboarded = useUserStore.getState().hasCompletedOnboarding;
    if (!onboarded) {
      router.replace('/welcome');
    }
  }, [isReady]);

  if (!isReady) {
    return (
      <View style={[styles.loading, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 48 }}>{'\uD83E\uDDE0'}</Text>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
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
  },
});
