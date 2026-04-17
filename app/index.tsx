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
  RefreshControl,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, { FadeInDown, FadeInRight, FadeInUp, ZoomIn } from 'react-native-reanimated';
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
    <View style={[styles.welcomeContainer, { backgroundColor: colors.background }]}>
      <SafeAreaView style={{ flex: 1 }}>
        <View style={styles.welcomeContent}>
          <Animated.View entering={FadeInDown.duration(600)} style={styles.hero}>
            <View style={[styles.iconCircle, { backgroundColor: colors.primary, borderColor: colors.shadowPrimary }]}>
              <Text style={styles.heroEmoji}>{'\uD83E\uDDE0'}</Text>
            </View>
            <Text style={[styles.appName, { color: colors.text }]}>QUIZMASTER</Text>
            <Text style={[styles.tagline, { color: colors.textSecondary }]}>Learn anything, one question at a time</Text>
          </Animated.View>

          <Animated.View entering={FadeInDown.duration(600).delay(200)} style={styles.features}>
            {FEATURES.map((f, i) => (
              <Animated.View
                key={f.title}
                entering={FadeInDown.duration(400).delay(300 + i * 100)}
                style={styles.featureWrap}
              >
                <View style={[styles.featureShadow, { backgroundColor: colors.border }]} />
                <View style={[styles.featureRow, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Text style={styles.featureIcon}>{f.icon}</Text>
                  <View style={styles.featureText}>
                    <Text style={[styles.featureTitle, { color: colors.text }]}>{f.title}</Text>
                    <Text style={[styles.featureDesc, { color: colors.textSecondary }]}>{f.desc}</Text>
                  </View>
                </View>
              </Animated.View>
            ))}
          </Animated.View>

          <Animated.View entering={FadeInUp.duration(600).delay(600)} style={styles.authButtons}>
            <Button
              title="Sign Up"
              onPress={() => router.push('/onboarding')}
              variant="primary"
              size="lg"
              style={{ marginBottom: 16 }}
            />
            <Button
              title="Log In"
              onPress={() => router.push('/onboarding?mode=login')}
              variant="accent"
              size="lg"
            />
          </Animated.View>
        </View>
      </SafeAreaView>
    </View>
  );
}

// ─── Dashboard (logged in) ───
function DashboardView() {
  const router = useRouter();
  const { colors, isDark, borderRadius } = useTheme();
  const user = useUserStore();
  const startQuiz = useQuizStore((s) => s.startQuiz);
  const logout = useUserStore((s) => s.logout);

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      const [pub, mine] = await Promise.all([
        apiClient.getPublicChallenges().catch(() => []),
        apiClient.getMyChallenges(user.username).catch(() => []),
      ]);
      setPublicChallenges(pub);
      setMyChallenges(mine);
    } catch {}
    setRefreshing(false);
  };

  const [challengeCode, setChallengeCode] = useState('');
  const [challengeError, setChallengeError] = useState('');
  const [challengeLoading, setChallengeLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'live' | 'mine' | 'code'>('live');
  const [publicChallenges, setPublicChallenges] = useState<any[]>([]);
  const [myChallenges, setMyChallenges] = useState<any[]>([]);
  const [loadingChallenges, setLoadingChallenges] = useState(false);

  useEffect(() => {
    if (!user.username || user.username === 'Player') return;
    const loadChallenges = async () => {
      setLoadingChallenges(true);
      try {
        const [pub, mine] = await Promise.all([
          apiClient.getPublicChallenges().catch(() => []),
          apiClient.getMyChallenges(user.username).catch(() => []),
        ]);
        setPublicChallenges(pub);
        setMyChallenges(mine);
      } catch {}
      setLoadingChallenges(false);
    };
    loadChallenges();
  }, [user.username]);

  const handleJoinPublic = async (challengeId: string) => {
    try {
      await apiClient.joinChallenge(challengeId, { name: user.username });
      router.push(`/lobby?id=${challengeId}`);
    } catch {
      // silently fail
    }
  };

  const handleJoinChallenge = async () => {
    const code = challengeCode.trim();
    if (!code) return;
    setChallengeError('');
    setChallengeLoading(true);
    try {
      // Join the challenge on the server
      await apiClient.joinChallenge(code, { name: user.username });
      setChallengeCode('');
      // Navigate to lobby
      router.push(`/lobby?id=${code}`);
    } catch {
      setChallengeError('Challenge not found. Check the code and try again.');
    } finally {
      setChallengeLoading(false);
    }
  };

  const handleDeleteChallenge = async (challengeId: string) => {
    try {
      await apiClient.deleteChallenge(challengeId, user.username);
      setMyChallenges((prev) => prev.filter((c) => c.id !== challengeId));
    } catch {}
  };

  const stats = [
    { label: 'Score', value: user.totalScore.toLocaleString(), icon: '\u2B50' },
    { label: 'Played', value: user.gamesPlayed.toString(), icon: '\uD83C\uDFAE' },
    { label: 'Streak', value: `${user.currentStreak}d`, icon: '\uD83D\uDD25' },
    { label: 'Best', value: `${user.longestStreak}d`, icon: '\uD83C\uDFC6' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />}>

        {/* Brutalist hero banner */}
        <Animated.View entering={FadeInDown.duration(600)}>
          <View style={styles.heroWrap}>
            <View style={[styles.heroShadow, { backgroundColor: colors.shadowPrimary }]} />
            <View style={[styles.heroBanner, { backgroundColor: colors.primary, borderColor: colors.shadowPrimary }]}>
              <View style={styles.heroBannerRow}>
                <View style={[styles.heroAvatarWrap, { borderColor: '#FFFFFF' }]}>
                  <Text style={styles.heroAvatar}>{user.avatarEmoji}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroGreeting}>Hey, {user.username}!</Text>
                  <Text style={styles.heroSub}>LV.{user.xpLevel} · {user.totalScore} PTS · {user.gamesPlayed} GAMES</Text>
                </View>
                <TouchableOpacity onPress={() => router.push('/profile')} style={[styles.heroProfileBtn, { borderColor: '#FFFFFF' }]}>
                  <Text style={styles.heroProfileText}>{'\u2699\uFE0F'}</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Brutalist quick actions */}
        <Animated.View entering={FadeInDown.duration(500).delay(150)}>
          <View style={styles.quickActions}>
            {/* Main Start Quiz */}
            <View style={styles.quickActionMainWrap}>
              <View style={[styles.qaShadow, { backgroundColor: colors.shadowAccent }]} />
              <TouchableOpacity
                onPress={() => router.push('/topic-input')}
                activeOpacity={1}
                style={[styles.quickActionMain, { backgroundColor: colors.accent, borderColor: colors.shadowAccent }]}
              >
                <Text style={styles.quickActionEmoji}>{'\uD83D\uDE80'}</Text>
                <Text style={styles.quickActionTitle}>START QUIZ</Text>
              </TouchableOpacity>
            </View>
            <View style={styles.quickActionSide}>
              <View style={{ flex: 1, position: 'relative' }}>
                <View style={[styles.qaShadow, { backgroundColor: colors.shadowSecondary }]} />
                <TouchableOpacity
                  onPress={() => router.push('/topic-input?challenge=true')}
                  activeOpacity={1}
                  style={[styles.quickActionSmall, { backgroundColor: colors.secondary, borderColor: colors.shadowSecondary }]}
                >
                  <Text style={styles.quickActionSmallEmoji}>{'\u2694\uFE0F'}</Text>
                  <Text style={styles.quickActionSmallText}>CHALLENGE</Text>
                </TouchableOpacity>
              </View>
              <View style={{ flex: 1, position: 'relative' }}>
                <View style={[styles.qaShadow, { backgroundColor: colors.shadowWarning }]} />
                <TouchableOpacity
                  onPress={() => router.push('/leaderboard')}
                  activeOpacity={1}
                  style={[styles.quickActionSmall, { backgroundColor: colors.warning, borderColor: colors.shadowWarning }]}
                >
                  <Text style={styles.quickActionSmallEmoji}>{'\uD83C\uDFC6'}</Text>
                  <Text style={styles.quickActionSmallText}>RANKINGS</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Animated.View>

        {/* Challenges Section */}
        <Animated.View entering={FadeInDown.duration(500).delay(300)}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{'\uD83C\uDF0D'} Live Challenges</Text>
            <TouchableOpacity onPress={() => setActiveTab(activeTab === 'live' ? 'mine' : 'live')}>
              <Text style={[styles.sectionToggle, { color: colors.primary }]}>
                {activeTab === 'live' ? 'My Challenges' : 'Public'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Tab pills */}
          <View style={styles.tabRow}>
            {[
              { key: 'live', label: 'Public', icon: '\uD83C\uDF0D' },
              { key: 'mine', label: 'Mine', icon: '\uD83D\uDC51' },
              { key: 'code', label: 'Enter Code', icon: '\uD83D\uDD11' },
            ].map(tab => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveTab(tab.key as any)}
                style={[styles.tab, {
                  backgroundColor: activeTab === tab.key ? colors.primary : 'transparent',
                  borderColor: activeTab === tab.key ? colors.primary : colors.border,
                  borderRadius: borderRadius.full,
                }]}
              >
                <Text style={{ fontSize: 13, fontWeight: '700', color: activeTab === tab.key ? '#FFF' : colors.text }}>
                  {tab.icon} {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Live public challenges */}
        {activeTab === 'live' && (
          <View style={styles.challengeList}>
            {loadingChallenges ? (
              <ActivityIndicator size="small" color={colors.primary} style={{ padding: 24 }} />
            ) : publicChallenges.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
                <Text style={styles.emptyEmoji}>{'\uD83C\uDFAE'}</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No live challenges</Text>
                <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>Be the first — create a public challenge!</Text>
              </View>
            ) : (
              publicChallenges.map((ch, i) => (
                <Animated.View key={ch.id} entering={FadeInRight.duration(400).delay(i * 80)}>
                  <TouchableOpacity
                    onPress={() => handleJoinPublic(ch.id)}
                    style={[styles.challengeCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}
                  >
                    <View style={[styles.challengeDot, { backgroundColor: colors.correct }]} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.challengeCardTopic, { color: colors.text }]}>{ch.topic}</Text>
                      <Text style={[styles.challengeCardMeta, { color: colors.textMuted }]}>
                        {ch.difficulty} · {(ch.participants || []).length} player{(ch.participants || []).length !== 1 ? 's' : ''} · by {ch.creatorName}
                      </Text>
                    </View>
                    <View style={[styles.joinPill, { backgroundColor: colors.primary, borderRadius: borderRadius.full }]}>
                      <Text style={styles.joinPillText}>Join</Text>
                    </View>
                  </TouchableOpacity>
                </Animated.View>
              ))
            )}
          </View>
        )}

        {/* My challenges */}
        {activeTab === 'mine' && (
          <View style={styles.challengeList}>
            {myChallenges.length === 0 ? (
              <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
                <Text style={styles.emptyEmoji}>{'\uD83D\uDC51'}</Text>
                <Text style={[styles.emptyTitle, { color: colors.text }]}>No challenges yet</Text>
                <Text style={[styles.emptyDesc, { color: colors.textMuted }]}>Create your first challenge and invite friends!</Text>
              </View>
            ) : (
              myChallenges.map((ch, i) => (
                <Animated.View key={ch.id} entering={FadeInRight.duration(400).delay(i * 80)}>
                  <View style={[styles.challengeCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
                    <TouchableOpacity
                      onPress={() => router.push(`/lobby?id=${ch.id}&host=true`)}
                      style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}
                    >
                      <View style={[styles.challengeDot, { backgroundColor: ch.status === 'waiting' ? colors.warning : ch.status === 'started' ? colors.correct : colors.textMuted }]} />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.challengeCardTopic, { color: colors.text }]}>{ch.topic}</Text>
                        <Text style={[styles.challengeCardMeta, { color: colors.textMuted }]}>
                          {ch.difficulty} · {(ch.participants || []).length} players · {ch.id}
                        </Text>
                      </View>
                      <View style={[styles.statusPill, {
                        backgroundColor: ch.status === 'waiting' ? colors.warning + '20' : ch.status === 'started' ? colors.correct + '20' : colors.textMuted + '20',
                        borderRadius: borderRadius.full,
                      }]}>
                        <Text style={{ fontSize: 10, fontWeight: '800', color: ch.status === 'waiting' ? colors.warning : ch.status === 'started' ? colors.correct : colors.textMuted }}>
                          {ch.status === 'waiting' ? 'OPEN' : ch.status === 'started' ? 'LIVE' : 'DONE'}
                        </Text>
                      </View>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => handleDeleteChallenge(ch.id)}
                      style={{ paddingHorizontal: 8, paddingVertical: 8, marginLeft: 4 }}
                    >
                      <Text style={{ fontSize: 16, fontWeight: '700', color: colors.wrong }}>{'\u2715'}</Text>
                    </TouchableOpacity>
                  </View>
                </Animated.View>
              ))
            )}
          </View>
        )}

        {/* Join by code */}
        {activeTab === 'code' && (
          <View style={[styles.codeCard, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
            <Text style={[styles.codeCardTitle, { color: colors.text }]}>{'\uD83D\uDD11'} Enter a challenge code</Text>
            <View style={styles.challengeRow}>
              <TextInput
                style={[styles.challengeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.background, borderRadius: borderRadius.sm }]}
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
          </View>
        )}

        {/* Bottom row */}
        <Animated.View entering={FadeInUp.duration(400).delay(500)}>
          <View style={styles.bottomRow}>
            <TouchableOpacity onPress={() => router.push('/history')} style={[styles.bottomBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
              <Text style={styles.bottomBtnEmoji}>{'\uD83D\uDCDA'}</Text>
              <Text style={[styles.bottomBtnText, { color: colors.text }]}>History</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => router.push('/profile')} style={[styles.bottomBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
              <Text style={styles.bottomBtnEmoji}>{'\uD83D\uDC64'}</Text>
              <Text style={[styles.bottomBtnText, { color: colors.text }]}>Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={logout} style={[styles.bottomBtn, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.lg }]}>
              <Text style={styles.bottomBtnEmoji}>{'\uD83D\uDEAA'}</Text>
              <Text style={[styles.bottomBtnText, { color: colors.textMuted }]}>Logout</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>

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

  // Welcome (brutalist)
  welcomeContainer: { flex: 1 },
  welcomeContent: { flex: 1, padding: 24, justifyContent: 'space-between' },
  hero: { alignItems: 'center', paddingTop: 48 },
  iconCircle: { width: 128, height: 128, borderRadius: 64, borderWidth: 4, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  heroEmoji: { fontSize: 64 },
  appName: { fontSize: 40, fontWeight: '900', letterSpacing: 1, marginBottom: 8 },
  tagline: { fontSize: 15, fontWeight: '600', textAlign: 'center' },
  features: { gap: 14, marginVertical: 32 },
  featureWrap: { position: 'relative' },
  featureShadow: { position: 'absolute', top: 4, left: 0, right: 0, bottom: 0, borderRadius: 14 },
  featureRow: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14, borderWidth: 2, borderRadius: 14 },
  featureIcon: { fontSize: 32 },
  featureText: { flex: 1 },
  featureTitle: { fontSize: 15, fontWeight: '900', marginBottom: 2, textTransform: 'uppercase' as const, letterSpacing: 0.3 },
  featureDesc: { fontSize: 13, fontWeight: '600' },
  authButtons: { paddingBottom: 24 },

  // Dashboard
  container: { flex: 1 },
  scroll: { padding: 16, paddingBottom: 32 },

  // Hero banner (brutalist)
  heroWrap: { position: 'relative', marginBottom: 20 },
  heroShadow: { position: 'absolute', top: 5, left: 0, right: 0, bottom: 0, borderRadius: 20 },
  heroBanner: { borderRadius: 20, borderWidth: 3, paddingHorizontal: 16, paddingVertical: 14 },
  heroBannerRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  heroAvatarWrap: { width: 48, height: 48, borderRadius: 24, borderWidth: 3, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  heroAvatar: { fontSize: 24 },
  heroProfileBtn: { width: 40, height: 40, borderRadius: 20, borderWidth: 3, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  heroProfileText: { fontSize: 18 },
  heroGreeting: { fontSize: 18, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  heroSub: { fontSize: 11, color: 'rgba(255,255,255,0.9)', marginTop: 3, fontWeight: '700', letterSpacing: 0.5 },

  // Quick actions (brutalist)
  quickActions: { flexDirection: 'row', gap: 12, marginBottom: 24 },
  quickActionMainWrap: { flex: 2, position: 'relative' },
  qaShadow: { position: 'absolute', top: 5, left: 0, right: 0, bottom: 0, borderRadius: 18 },
  quickActionMain: { height: 100, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderRadius: 18 },
  quickActionEmoji: { fontSize: 32, marginBottom: 4 },
  quickActionTitle: { fontSize: 14, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5, textTransform: 'uppercase' as const },
  quickActionSide: { flex: 1, gap: 8 },
  quickActionSmall: { flex: 1, alignItems: 'center', justifyContent: 'center', borderWidth: 3, borderRadius: 16 },
  quickActionSmallEmoji: { fontSize: 18, marginBottom: 1 },
  quickActionSmallText: { fontSize: 10, fontWeight: '900', color: '#FFFFFF', letterSpacing: 0.5, textTransform: 'uppercase' as const },

  // Section
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  sectionTitle: { fontSize: 16, fontWeight: '900', textTransform: 'uppercase' as const, letterSpacing: 0.8 },
  sectionToggle: { fontSize: 12, fontWeight: '800', textTransform: 'uppercase' as const, letterSpacing: 0.5 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  tab: { flex: 1, paddingVertical: 10, alignItems: 'center', borderWidth: 2 },

  // Challenge cards
  challengeList: { marginBottom: 20 },
  challengeCard: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 2, marginBottom: 10, gap: 12 },
  challengeDot: { width: 8, height: 8, borderRadius: 4 },
  challengeCardTopic: { fontSize: 15, fontWeight: '700' },
  challengeCardMeta: { fontSize: 11, marginTop: 3 },
  joinPill: { paddingHorizontal: 16, paddingVertical: 7 },
  joinPillText: { color: '#FFF', fontSize: 13, fontWeight: '800' },
  statusPill: { paddingHorizontal: 10, paddingVertical: 4 },

  // Empty states
  emptyCard: { alignItems: 'center', padding: 32, borderWidth: 2, marginBottom: 12 },
  emptyEmoji: { fontSize: 40, marginBottom: 8 },
  emptyTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  emptyDesc: { fontSize: 13, textAlign: 'center' },

  // Code input
  codeCard: { padding: 16, borderWidth: 2, marginBottom: 20 },
  codeCardTitle: { fontSize: 15, fontWeight: '700', marginBottom: 12 },
  challengeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  challengeInput: { flex: 1, height: 44, borderWidth: 1.5, paddingHorizontal: 12, fontSize: 15 },
  joinButton: { minWidth: 70 },
  challengeErrorText: { fontSize: 12, marginTop: 6 },

  // Bottom
  bottomRow: { flexDirection: 'row', gap: 10 },
  bottomBtn: { flex: 1, alignItems: 'center', paddingVertical: 14, borderWidth: 2 },
  bottomBtnEmoji: { fontSize: 22, marginBottom: 4 },
  bottomBtnText: { fontSize: 12, fontWeight: '600' },
});
