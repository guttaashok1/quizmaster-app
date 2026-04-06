import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeContext';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { useUserStore } from '../src/stores/useUserStore';
import { useQuizStore } from '../src/stores/useQuizStore';
import { apiClient } from '../src/services/api';

const SESSION_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

const FEATURES = [
  { icon: '\u2728', title: 'AI-Powered Quizzes', desc: 'Generate quizzes on any topic instantly' },
  { icon: '\u2694\uFE0F', title: 'Challenge Friends', desc: 'Compete with friends and compare scores' },
  { icon: '\uD83D\uDCC8', title: 'Track Progress', desc: 'Earn points, unlock rewards, level up' },
];

// ─── Welcome Screen (not logged in) ───
function WelcomeView() {
  const router = useRouter();
  const { colors, borderRadius } = useTheme();

  return (
    <LinearGradient colors={colors.gradientHero} style={styles.welcomeContainer}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.welcomeContent}>
          <Animated.View entering={FadeInDown.duration(600)} style={styles.hero}>
            <View style={styles.iconCircle}>
              <Text style={styles.heroEmoji}>{'\uD83E\uDDE0'}</Text>
            </View>
            <Text style={styles.appName}>QuizMaster</Text>
            <Text style={styles.tagline}>Learn anything, one question at a time</Text>
          </Animated.View>

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

          <Animated.View entering={FadeInUp.duration(600).delay(600)} style={styles.authButtons}>
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

// ─── Dashboard (logged in) ───
function DashboardView() {
  const router = useRouter();
  const { colors, isDark, borderRadius } = useTheme();
  const user = useUserStore();
  const startQuiz = useQuizStore((s) => s.startQuiz);
  const logout = useUserStore((s) => s.logout);

  const [challengeCode, setChallengeCode] = useState('');
  const [challengeError, setChallengeError] = useState('');
  const [challengeLoading, setChallengeLoading] = useState(false);

  const handleJoinChallenge = async () => {
    const code = challengeCode.trim();
    if (!code) return;
    setChallengeError('');
    setChallengeLoading(true);
    try {
      const challenge = await apiClient.getChallenge(code);
      startQuiz(challenge.questions, challenge.topic, challenge.difficulty, false, null, challenge.id);
      setChallengeCode('');
      router.push('/quiz/play');
    } catch {
      setChallengeError('Challenge not found. Check the code and try again.');
    } finally {
      setChallengeLoading(false);
    }
  };

  const stats = [
    { label: 'Score', value: user.totalScore.toLocaleString(), icon: '\u2B50' },
    { label: 'Played', value: user.gamesPlayed.toString(), icon: '\uD83C\uDFAE' },
    { label: 'Streak', value: `${user.currentStreak}d`, icon: '\uD83D\uDD25' },
    { label: 'Best', value: `${user.longestStreak}d`, icon: '\uD83C\uDFC6' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Compact banner */}
        <LinearGradient
          colors={isDark ? [colors.primaryDark, colors.background] : [colors.primaryLight + '30', colors.background]}
          style={styles.banner}
        >
          <View style={styles.bannerRow}>
            <Text style={styles.bannerEmoji}>{user.avatarEmoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={[styles.bannerName, { color: colors.text }]}>Hey, {user.username}!</Text>
              <Text style={[styles.bannerLevel, { color: colors.xp }]}>Level {user.xpLevel}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/profile')}>
              <Text style={[styles.profileLink, { color: colors.primary }]}>Profile</Text>
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <Button
          title="Start New Quiz"
          onPress={() => router.push('/topic-input')}
          variant="primary"
          size="lg"
          style={styles.startButton}
          icon={<Text style={{ fontSize: 20 }}>{'\uD83D\uDE80'}</Text>}
        />

        {/* Play with Friends */}
        <Card elevated style={styles.challengeCard}>
          <Text style={[styles.challengeTitle, { color: colors.text }]}>
            {'\u2694\uFE0F'} Play with Friends
          </Text>
          <View style={styles.challengeBtns}>
            <TouchableOpacity
              onPress={() => router.push('/topic-input?challenge=true')}
              style={[styles.createBtn, { backgroundColor: colors.primary + '15', borderColor: colors.primary, borderRadius: borderRadius.sm }]}
            >
              <Text style={[styles.createBtnText, { color: colors.primary }]}>{'\u2795'} Create Challenge</Text>
            </TouchableOpacity>
          </View>
          <Text style={[styles.orText, { color: colors.textMuted }]}>or join with a code</Text>
          <View style={styles.challengeRow}>
            <TextInput
              style={[styles.challengeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: borderRadius.sm }]}
              placeholder="e.g. ch_abc123"
              placeholderTextColor={colors.textMuted}
              value={challengeCode}
              onChangeText={(t) => { setChallengeCode(t); setChallengeError(''); }}
              autoCapitalize="none"
            />
            <Button
              title={challengeLoading ? '' : 'Join'}
              onPress={handleJoinChallenge}
              variant="primary"
              size="md"
              style={styles.joinButton}
              disabled={challengeLoading || !challengeCode.trim()}
            />
          </View>
          {challengeError ? (
            <Text style={[styles.challengeErrorText, { color: colors.wrong }]}>{challengeError}</Text>
          ) : null}
        </Card>

        {/* Compact Stats */}
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Stats</Text>
        <View style={styles.statsRow}>
          {stats.map((stat, i) => (
            <View key={i} style={[styles.statItem, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.sm }]}>
              <Text style={styles.statEmoji}>{stat.icon}</Text>
              <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Bottom nav */}
        <View style={styles.bottomButtons}>
          <Button title="History" onPress={() => router.push('/history')} variant="outline" size="sm" style={{ flex: 1 }} icon={<Text>{'\uD83D\uDCDA'}</Text>} />
          <Button title="Leaderboard" onPress={() => router.push('/leaderboard')} variant="outline" size="sm" style={{ flex: 1 }} icon={<Text>{'\uD83C\uDFC5'}</Text>} />
        </View>

        <TouchableOpacity onPress={logout} style={styles.logoutBtn}>
          <Text style={[styles.logoutText, { color: colors.textMuted }]}>Log Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Main Index: decides what to show ───
export default function IndexScreen() {
  const hasCompletedOnboarding = useUserStore((s) => s.hasCompletedOnboarding);
  const lastActivity = useUserStore((s) => s.lastActivity);
  const setLastActivity = useUserStore((s) => s.setLastActivity);
  const logout = useUserStore((s) => s.logout);
  const { colors } = useTheme();
  const [ready, setReady] = useState(false);

  // Wait for store hydration on web
  useEffect(() => {
    if (Platform.OS === 'web') {
      const timer = setTimeout(() => setReady(true), 150);
      try {
        if (useUserStore.persist.hasHydrated()) {
          setReady(true);
          clearTimeout(timer);
        } else {
          const unsub = useUserStore.persist.onFinishHydration(() => {
            setReady(true);
            clearTimeout(timer);
            unsub();
          });
        }
      } catch {}
      return () => clearTimeout(timer);
    } else {
      setReady(true);
    }
  }, []);

  // Check session timeout
  useEffect(() => {
    if (!ready) return;
    if (hasCompletedOnboarding && lastActivity) {
      const elapsed = Date.now() - lastActivity;
      if (elapsed > SESSION_TIMEOUT_MS) {
        logout();
        return;
      }
    }
    // Update activity timestamp
    if (hasCompletedOnboarding) {
      setLastActivity(Date.now());
    }
  }, [ready]);

  // Track activity
  useEffect(() => {
    if (!hasCompletedOnboarding) return;
    const interval = setInterval(() => {
      setLastActivity(Date.now());
    }, 60000); // update every minute
    return () => clearInterval(interval);
  }, [hasCompletedOnboarding]);

  if (!ready) {
    return (
      <View style={[styles.loadingView, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 48 }}>{'\uD83E\uDDE0'}</Text>
        <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: 16 }} />
      </View>
    );
  }

  if (!hasCompletedOnboarding) {
    return <WelcomeView />;
  }

  return <DashboardView />;
}

const styles = StyleSheet.create({
  // Loading
  loadingView: { flex: 1, alignItems: 'center', justifyContent: 'center' },

  // Welcome
  welcomeContainer: { flex: 1 },
  welcomeContent: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { alignItems: 'center', paddingTop: 48 },
  iconCircle: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center', marginBottom: 20, backgroundColor: 'rgba(255,255,255,0.15)' },
  heroEmoji: { fontSize: 64 },
  appName: { fontSize: 36, fontWeight: '900', letterSpacing: -1, marginBottom: 8, color: '#FFFFFF' },
  tagline: { fontSize: 16, fontWeight: '500', textAlign: 'center', color: 'rgba(255,255,255,0.7)' },
  features: { gap: 12, marginVertical: 32 },
  featureRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, backgroundColor: 'rgba(255,255,255,0.12)' },
  featureIcon: { fontSize: 28 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '700', marginBottom: 2, color: '#FFFFFF' },
  featureDesc: { fontSize: 13, color: 'rgba(255,255,255,0.7)' },
  authButtons: { paddingBottom: 24 },
  signUpBtn: { backgroundColor: '#FFFFFF', height: 52, alignItems: 'center', justifyContent: 'center', marginBottom: 12 },
  signUpText: { fontSize: 17, fontWeight: '700' },
  loginBtn: { backgroundColor: 'transparent', borderWidth: 2, borderColor: '#FFFFFF', height: 52, alignItems: 'center', justifyContent: 'center' },
  loginText: { fontSize: 17, fontWeight: '700', color: '#FFFFFF' },

  // Dashboard
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },
  banner: { borderRadius: 16, padding: 16, marginBottom: 16 },
  bannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  bannerEmoji: { fontSize: 40 },
  bannerName: { fontSize: 18, fontWeight: '700' },
  bannerLevel: { fontSize: 13, fontWeight: '600', marginTop: 2 },
  profileLink: { fontSize: 14, fontWeight: '600' },
  startButton: { marginBottom: 16 },
  challengeCard: { marginBottom: 16 },
  challengeTitle: { fontSize: 16, fontWeight: '700', marginBottom: 10 },
  challengeBtns: { marginBottom: 10 },
  createBtn: { paddingVertical: 10, paddingHorizontal: 16, borderWidth: 1, alignItems: 'center' },
  createBtnText: { fontSize: 14, fontWeight: '700' },
  orText: { fontSize: 12, textAlign: 'center', marginBottom: 8 },
  challengeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  challengeInput: { flex: 1, height: 40, borderWidth: 1, paddingHorizontal: 10, fontSize: 14 },
  joinButton: { minWidth: 60 },
  challengeErrorText: { fontSize: 12, marginTop: 4 },
  sectionTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  statsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  statItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderWidth: 1 },
  statEmoji: { fontSize: 18, marginBottom: 2 },
  statValue: { fontSize: 16, fontWeight: '800' },
  statLabel: { fontSize: 10, fontWeight: '500', marginTop: 1 },
  bottomButtons: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  logoutBtn: { alignItems: 'center', paddingVertical: 12 },
  logoutText: { fontSize: 14, fontWeight: '600' },
});
