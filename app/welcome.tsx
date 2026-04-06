import React from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeContext';

const FEATURES = [
  { icon: '\u2728', title: 'AI-Powered Quizzes', desc: 'Generate quizzes on any topic instantly' },
  { icon: '\u2694\uFE0F', title: 'Challenge Friends', desc: 'Compete with friends and compare scores' },
  { icon: '\uD83D\uDCC8', title: 'Track Progress', desc: 'Earn points, unlock rewards, level up' },
];

export default function WelcomeScreen() {
  const router = useRouter();
  const { colors, spacing, borderRadius } = useTheme();

  return (
    <LinearGradient colors={colors.gradientHero} style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          {/* Hero */}
          <Animated.View entering={FadeInDown.duration(600)} style={styles.hero}>
            <View style={[styles.iconCircle, { backgroundColor: 'rgba(255,255,255,0.15)' }]}>
              <Text style={styles.heroEmoji}>{'\uD83E\uDDE0'}</Text>
            </View>
            <Text style={styles.appName}>QuizMaster</Text>
            <Text style={styles.tagline}>
              Learn anything, one question at a time
            </Text>
          </Animated.View>

          {/* Features */}
          <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.features}>
            {FEATURES.map((f, i) => (
              <Animated.View
                key={f.title}
                entering={FadeInDown.duration(400).delay(300 + i * 100)}
                style={[styles.featureRow, { borderRadius: borderRadius.md }]}
              >
                <Text style={styles.featureIcon}>{f.icon}</Text>
                <View style={styles.featureText}>
                  <Text style={styles.featureTitle}>{f.title}</Text>
                  <Text style={styles.featureDesc}>{f.desc}</Text>
                </View>
              </Animated.View>
            ))}
          </Animated.View>

          {/* Buttons */}
          <Animated.View entering={FadeInUp.duration(600).delay(600)} style={styles.buttons}>
            <TouchableOpacity
              onPress={() => router.push('/onboarding')}
              style={[styles.signUpBtn, { borderRadius: borderRadius.md }]}
            >
              <Text style={[styles.signUpText, { color: colors.primary }]}>Sign Up</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/onboarding?mode=login')}
              style={[styles.loginBtn, { borderRadius: borderRadius.md }]}
            >
              <Text style={styles.loginText}>Log In</Text>
            </TouchableOpacity>
          </Animated.View>
        </View>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  safeArea: { flex: 1 },
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
  appName: { fontSize: 36, fontWeight: '900', letterSpacing: -1, marginBottom: 8, color: '#FFFFFF' },
  tagline: { fontSize: 16, fontWeight: '500', textAlign: 'center', color: 'rgba(255,255,255,0.7)' },
  features: { gap: 12, marginVertical: 32 },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    gap: 14,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  featureIcon: { fontSize: 28 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2, color: '#FFFFFF' },
  featureDesc: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  buttons: { paddingBottom: 24 },
  signUpBtn: {
    backgroundColor: '#FFFFFF',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  signUpText: { fontSize: 17, fontWeight: '700' },
  loginBtn: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },
});
