import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../src/theme/ThemeContext';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { ProgressBar } from '../src/components/ui/ProgressBar';
import { useUserStore } from '../src/stores/useUserStore';
import { useReviewStore } from '../src/stores/useReviewStore';
import { useChallengeStore } from '../src/stores/useChallengeStore';
import { useQuizStore } from '../src/stores/useQuizStore';
import { apiClient } from '../src/services/api';

export default function HomeScreen() {
  const router = useRouter();
  const { colors, spacing, isDark } = useTheme();
  const user = useUserStore();
  const reviewCards = useReviewStore((s) => s.cards);
  const dailyChallenge = useChallengeStore((s) => s.dailyChallenge);
  const startQuiz = useQuizStore((s) => s.startQuiz);

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

  const today = new Date().toISOString().split('T')[0];
  const dueCount = reviewCards.filter((c) => c.nextReviewDate <= today).length;
  const isDailyDone = dailyChallenge?.date === today && dailyChallenge?.completed === true;

  const stats = [
    { label: 'Total Score', value: user.totalScore.toLocaleString(), icon: '\u2B50' },
    { label: 'Games Played', value: user.gamesPlayed.toString(), icon: '\uD83C\uDFAE' },
    { label: 'Current Streak', value: `${user.currentStreak} days`, icon: '\uD83D\uDD25' },
    { label: 'Best Streak', value: `${user.longestStreak} days`, icon: '\uD83C\uDFC6' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>

        <View style={styles.header}>
          <LinearGradient
            colors={isDark ? [colors.primaryDark, colors.background] : [colors.primaryLight + '30', colors.background]}
            style={styles.gradient}
          >
            <Text style={styles.logo}>{user.avatarEmoji}</Text>
            <Text style={[styles.title, { color: colors.text }]}>QuizMaster</Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              Learn anything, one question at a time
            </Text>

            <View style={styles.xpContainer}>
              <View style={styles.xpHeader}>
                <Text style={[styles.xpLevel, { color: colors.xp }]}>Level {user.xpLevel}</Text>
                <Text style={[styles.xpText, { color: colors.textMuted }]}>
                  {user.xpCurrent}/{user.xpToNextLevel} XP
                </Text>
              </View>
              <ProgressBar progress={user.xpCurrent / user.xpToNextLevel} height={6} />
            </View>

            {user.streakFreezes > 0 && (
              <Text style={[styles.freezeText, { color: colors.accent }]}>
                {'\u2744\uFE0F'} {user.streakFreezes} streak freeze{user.streakFreezes > 1 ? 's' : ''}
              </Text>
            )}
          </LinearGradient>
        </View>

        <View>
          <Button
            title="Start New Quiz"
            onPress={() => router.push('/topic-input')}
            variant="primary"
            size="lg"
            style={styles.startButton}
            icon={<Text style={{ fontSize: 20 }}>{'\uD83D\uDE80'}</Text>}
          />
        </View>

        <View>
          <Card elevated style={styles.challengeCard}>
            <Text style={[styles.challengeTitle, { color: colors.text }]}>
              {'\u2694\uFE0F'} Play with Friends
            </Text>
            <Text style={[styles.challengeHint, { color: colors.textMuted }]}>
              To create a challenge: finish a quiz, then tap "Challenge" on the results screen. Share the code with friends!
            </Text>
            <View style={styles.challengeRow}>
              <TextInput
                style={[styles.challengeInput, { color: colors.text, borderColor: colors.border, backgroundColor: colors.surface }]}
                placeholder="Enter challenge code (e.g. ch_abc123)"
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
              {challengeLoading && <ActivityIndicator style={{ position: 'absolute', right: 24 }} />}
            </View>
            {challengeError ? (
              <Text style={[styles.challengeErrorText, { color: colors.incorrect }]}>{challengeError}</Text>
            ) : null}
          </Card>
        </View>

        <View>
          <TouchableOpacity
            onPress={() => { if (!isDailyDone) router.push('/topic-input'); }}
            disabled={isDailyDone}
          >
            <Card elevated style={[styles.dailyCard, { borderColor: isDailyDone ? colors.correct : colors.warning }]}>
              <View style={styles.dailyHeader}>
                <Text style={styles.dailyIcon}>{isDailyDone ? '\u2705' : '\uD83C\uDFAF'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.dailyTitle, { color: colors.text }]}>Daily Challenge</Text>
                  <Text style={[styles.dailySub, { color: colors.textMuted }]}>
                    {isDailyDone ? 'Completed! Come back tomorrow.' : '+150 bonus points'}
                  </Text>
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        </View>

        {dueCount > 0 && (
          <View>
            <TouchableOpacity onPress={() => router.push('/review' as any)}>
              <Card elevated style={[styles.reviewCard, { borderColor: colors.secondary }]}>
                <Text style={styles.reviewIcon}>{'\uD83E\uDDE0'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reviewTitle, { color: colors.text }]}>{dueCount} cards to review</Text>
                  <Text style={[styles.reviewSub, { color: colors.textMuted }]}>Spaced repetition strengthens memory</Text>
                </View>
              </Card>
            </TouchableOpacity>
          </View>
        )}

        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Your Stats</Text>
          <View style={styles.statsGrid}>
            {stats.map((stat, i) => (
              <Card key={i} elevated style={styles.statCard}>
                <Text style={styles.statIcon}>{stat.icon}</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{stat.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{stat.label}</Text>
              </Card>
            ))}
          </View>
        </View>

        <View style={styles.bottomButtons}>
          <Button title="History" onPress={() => router.push('/history')} variant="outline" size="md" style={{ flex: 1 }} icon={<Text>{'\uD83D\uDCDA'}</Text>} />
          <Button title="Leaderboard" onPress={() => router.push('/leaderboard')} variant="outline" size="md" style={{ flex: 1 }} icon={<Text>{'\uD83C\uDFC5'}</Text>} />
          <Button title="Profile" onPress={() => router.push('/profile')} variant="outline" size="md" style={{ flex: 1 }} icon={<Text>{'\uD83D\uDC64'}</Text>} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 24 },
  gradient: { width: '100%', alignItems: 'center', paddingTop: 32, paddingBottom: 24, borderRadius: 24 },
  logo: { fontSize: 64, marginBottom: 16 },
  title: { fontSize: 36, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '500', textAlign: 'center', marginBottom: 16 },
  xpContainer: { width: '80%', marginBottom: 8 },
  xpHeader: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  xpLevel: { fontSize: 14, fontWeight: '800' },
  xpText: { fontSize: 12, fontWeight: '500' },
  freezeText: { fontSize: 13, fontWeight: '600', marginTop: 4 },
  startButton: { marginBottom: 16 },
  dailyCard: { marginBottom: 12, borderWidth: 1 },
  dailyHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  dailyIcon: { fontSize: 32 },
  dailyTitle: { fontSize: 16, fontWeight: '700' },
  dailySub: { fontSize: 13, marginTop: 2 },
  reviewCard: { marginBottom: 16, borderWidth: 1 },
  reviewIcon: { fontSize: 28 },
  reviewTitle: { fontSize: 15, fontWeight: '700' },
  reviewSub: { fontSize: 12, marginTop: 2 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
  statCard: { width: '47%', alignItems: 'center', paddingVertical: 20 },
  statIcon: { fontSize: 28, marginBottom: 8 },
  statValue: { fontSize: 22, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 13, fontWeight: '500' },
  challengeCard: { marginBottom: 16 },
  challengeTitle: { fontSize: 16, fontWeight: '700', marginBottom: 4 },
  challengeHint: { fontSize: 12, lineHeight: 17, marginBottom: 12 },
  challengeRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  challengeInput: { flex: 1, height: 44, borderWidth: 1, borderRadius: 10, paddingHorizontal: 12, fontSize: 15 },
  joinButton: { minWidth: 70 },
  challengeErrorText: { fontSize: 13, marginTop: 6 },
  bottomButtons: { flexDirection: 'row', gap: 12 },
});
