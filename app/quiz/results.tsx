import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Share,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { Button } from '../../src/components/ui/Button';
import { Card } from '../../src/components/ui/Card';
import { Confetti } from '../../src/components/feedback/Confetti';
import { useQuizStore } from '../../src/stores/useQuizStore';
import { useUserStore } from '../../src/stores/useUserStore';
import { useLeaderboardStore } from '../../src/stores/useLeaderboardStore';
import { useChallengeStore } from '../../src/stores/useChallengeStore';
import { useQuizHistoryStore } from '../../src/stores/useQuizHistoryStore';
import { haptics } from '../../src/services/hapticService';

function AnimatedScore({ targetScore }: { targetScore: number }) {
  const { colors } = useTheme();
  const [displayScore, setDisplayScore] = React.useState(0);

  useEffect(() => {
    let current = 0;
    const step = Math.max(1, Math.ceil(targetScore / 40));
    const interval = setInterval(() => {
      current += step;
      if (current >= targetScore) {
        setDisplayScore(targetScore);
        clearInterval(interval);
      } else {
        setDisplayScore(current);
      }
    }, 30);
    return () => clearInterval(interval);
  }, [targetScore]);

  return (
    <Text style={[styles.scoreValue, { color: colors.xp }]}>
      {displayScore.toLocaleString()}
    </Text>
  );
}

export default function ResultsScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const getResult = useQuizStore((s) => s.getResult);
  const resetQuiz = useQuizStore((s) => s.resetQuiz);
  const topic = useQuizStore((s) => s.topic);
  const difficulty = useQuizStore((s) => s.difficulty);
  const questions = useQuizStore((s) => s.questions);
  const answers = useQuizStore((s) => s.answers);
  const updateAfterQuiz = useUserStore((s) => s.updateAfterQuiz);
  const username = useUserStore((s) => s.username);
  const totalScore = useUserStore((s) => s.totalScore);
  const currentStreak = useUserStore((s) => s.currentStreak);
  const updateLeaderboard = useLeaderboardStore((s) => s.updateEntry);
  const createChallenge = useChallengeStore((s) => s.createChallenge);
  const saveDeck = useChallengeStore((s) => s.saveDeck);
  const saveQuiz = useQuizHistoryStore((s) => s.saveQuiz);
  const hasUpdated = useRef(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [newAchievements, setNewAchievements] = useState<string[]>([]);
  const [historyId, setHistoryId] = useState<string | null>(null);

  const result = getResult();

  useEffect(() => {
    if (!hasUpdated.current) {
      hasUpdated.current = true;
      updateAfterQuiz(result, topic);
      updateLeaderboard(username, totalScore + result.score, currentStreak);
      haptics.heavy();

      // Save to history
      const id = saveQuiz({ topic, difficulty, questions, answers, result });
      setHistoryId(id);

      if (result.stars === 3) {
        setShowConfetti(true);
        setTimeout(() => setShowConfetti(false), 3000);
      }

      const achievements = useUserStore.getState().checkAchievements();
      if (achievements.length > 0) {
        setNewAchievements(achievements.map((a) => `${a.icon} ${a.title}`));
      }
    }
  }, []);

  const handleShare = async () => {
    try {
      await Share.share({
        message: `I scored ${result.score} points on "${result.topic}" quiz in QuizMaster! ${result.stars === 3 ? 'Perfect score!' : ''} Can you beat me?`,
      });
    } catch {}
  };

  const handleCreateChallenge = () => {
    const challenge = createChallenge(topic, result.difficulty, questions, username, result.score);
    Alert.alert(
      'Challenge Created!',
      `Share code: ${challenge.id}\nYour friends can use this to play the same quiz and try to beat your score of ${result.score}!`
    );
  };

  const handleSaveDeck = () => {
    saveDeck(topic, questions);
    Alert.alert('Deck Saved!', 'You can replay this quiz anytime from your saved decks.');
  };

  const handleReviewQuiz = () => {
    if (historyId) {
      router.push(`/quiz-review/${historyId}` as any);
    }
  };

  const starsText =
    result.stars === 3 ? '\u2B50\u2B50\u2B50' : result.stars === 2 ? '\u2B50\u2B50' : '\u2B50';

  const percentage = Math.round((result.correctAnswers / result.totalQuestions) * 100);

  const statItems = [
    { label: 'Correct', value: `${result.correctAnswers}/${result.totalQuestions}`, icon: '\u2705' },
    { label: 'Accuracy', value: `${percentage}%`, icon: '\uD83C\uDFAF' },
    { label: 'Time', value: `${result.timeTaken}s`, icon: '\u23F1\uFE0F' },
    { label: 'Streak Bonus', value: `+${result.streakBonus}`, icon: '\uD83D\uDD25' },
  ];

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Confetti active={showConfetti} />

      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <Text style={styles.starsText}>{starsText}</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {percentage >= 90 ? 'Amazing!' : percentage >= 70 ? 'Great Job!' : percentage >= 50 ? 'Good Effort!' : 'Keep Learning!'}
          </Text>
          <Text style={[styles.topicLabel, { color: colors.textSecondary }]}>
            {result.topic} - {result.difficulty}
          </Text>
        </View>

        {newAchievements.length > 0 && (
          <View>
            <Card elevated style={[styles.achievementCard, { borderColor: colors.star }]}>
              <Text style={[styles.achievementTitle, { color: colors.star }]}>
                {'\uD83C\uDFC6'} New Achievement{newAchievements.length > 1 ? 's' : ''}!
              </Text>
              {newAchievements.map((a, i) => (
                <Text key={i} style={[styles.achievementItem, { color: colors.text }]}>{a}</Text>
              ))}
            </Card>
          </View>
        )}

        <View>
          <Card elevated style={styles.scoreCard}>
            <Text style={[styles.scoreLabel, { color: colors.textSecondary }]}>Total Score</Text>
            <AnimatedScore targetScore={result.score} />
          </Card>
        </View>

        <View>
          <View style={styles.statsGrid}>
            {statItems.map((item, i) => (
              <Card key={i} style={styles.statItem}>
                <Text style={styles.statIcon}>{item.icon}</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{item.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{item.label}</Text>
              </Card>
            ))}
          </View>
        </View>

        <View style={styles.buttons}>
          <Button
            title="Review Answers"
            onPress={handleReviewQuiz}
            variant="secondary"
            size="lg"
            style={{ marginBottom: 12 }}
            icon={<Text style={{ fontSize: 18 }}>{'\uD83D\uDD0D'}</Text>}
          />
          <Button
            title="Play Again"
            onPress={() => { resetQuiz(); router.replace('/topic-input'); }}
            variant="primary"
            size="lg"
            style={{ marginBottom: 12 }}
            icon={<Text style={{ fontSize: 18 }}>{'\uD83D\uDD01'}</Text>}
          />
          <View style={styles.actionRow}>
            <Button title="Share" onPress={handleShare} variant="outline" size="md" style={{ flex: 1 }} icon={<Text>{'\uD83D\uDCE4'}</Text>} />
            <Button title="Challenge" onPress={handleCreateChallenge} variant="outline" size="md" style={{ flex: 1 }} icon={<Text>{'\u2694\uFE0F'}</Text>} />
          </View>
          <View style={styles.actionRow}>
            <Button title="Save Deck" onPress={handleSaveDeck} variant="ghost" size="md" style={{ flex: 1 }} icon={<Text>{'\uD83D\uDCBE'}</Text>} />
            <Button title="Home" onPress={() => { resetQuiz(); router.replace('/'); }} variant="ghost" size="md" style={{ flex: 1 }} icon={<Text>{'\uD83C\uDFE0'}</Text>} />
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 24, paddingTop: 24 },
  starsText: { fontSize: 48, marginBottom: 16 },
  title: { fontSize: 32, fontWeight: '800', marginBottom: 8 },
  topicLabel: { fontSize: 16, fontWeight: '500', textTransform: 'capitalize' },
  achievementCard: { marginBottom: 20, borderWidth: 1 },
  achievementTitle: { fontSize: 16, fontWeight: '800', marginBottom: 8 },
  achievementItem: { fontSize: 15, fontWeight: '600', marginBottom: 4 },
  scoreCard: { alignItems: 'center', paddingVertical: 24, marginBottom: 24 },
  scoreLabel: { fontSize: 14, fontWeight: '600', marginBottom: 4 },
  scoreValue: { fontSize: 48, fontWeight: '800' },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  statItem: { width: '47%', alignItems: 'center', paddingVertical: 16 },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 13, fontWeight: '500' },
  buttons: { gap: 0 },
  actionRow: { flexDirection: 'row', gap: 12, marginBottom: 12 },
});
