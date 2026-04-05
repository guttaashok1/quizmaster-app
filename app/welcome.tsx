import React from 'react';
import { View, Text, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeContext';
import { Button } from '../src/components/ui/Button';

const FEATURES = [
  { icon: '\u2728', title: 'AI-Powered Quizzes', desc: 'Generate quizzes on any topic instantly' },
  { icon: '\u2694\uFE0F', title: 'Challenge Friends', desc: 'Compete with friends and compare scores' },
  { icon: '\uD83D\uDCC8', title: 'Track Progress', desc: 'Earn points, unlock rewards, level up' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Hero */}
        <Animated.View entering={FadeInDown.duration(600)} style={styles.hero}>
          <View style={[styles.iconCircle, { backgroundColor: colors.primary + '15' }]}>
            <Text style={styles.heroEmoji}>{'\uD83E\uDDE0'}</Text>
          </View>
          <Text style={[styles.appName, { color: colors.text }]}>QuizMaster</Text>
          <Text style={[styles.tagline, { color: colors.textSecondary }]}>
            Learn anything, one question at a time
          </Text>
        </Animated.View>

        {/* Features */}
        <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.features}>
          {FEATURES.map((f, i) => (
            <Animated.View
              key={f.title}
              entering={FadeInDown.duration(400).delay(300 + i * 100)}
              style={[styles.featureRow, { backgroundColor: colors.surface, borderRadius: borderRadius.md }]}
            >
              <Text style={styles.featureIcon}>{f.icon}</Text>
              <View style={styles.featureText}>
                <Text style={[styles.featureTitle, { color: colors.text }]}>{f.title}</Text>
                <Text style={[styles.featureDesc, { color: colors.textMuted }]}>{f.desc}</Text>
              </View>
            </Animated.View>
          ))}
        </Animated.View>

        {/* Buttons */}
        <Animated.View entering={FadeInUp.duration(600).delay(600)} style={styles.buttons}>
          <Button
            title="Sign Up"
            onPress={() => router.push('/onboarding')}
            variant="primary"
            size="lg"
            style={{ width: '100%', marginBottom: 12 }}
          />
          <Button
            title="Log In"
            onPress={() => router.push('/onboarding?mode=login')}
            variant="outline"
            size="lg"
            style={{ width: '100%' }}
          />
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { alignItems: 'center', paddingTop: 48 },
  iconCircle: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  heroEmoji: { fontSize: 64 },
  appName: { fontSize: 36, fontWeight: '900', letterSpacing: -1, marginBottom: 8 },
  tagline: { fontSize: 16, fontWeight: '500', textAlign: 'center' },
  features: { gap: 12, marginVertical: 32 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
  },
  featureIcon: { fontSize: 28 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2 },
  featureDesc: { fontSize: 13 },
  buttons: { paddingBottom: 24 },
});
