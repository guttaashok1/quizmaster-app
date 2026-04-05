import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { useQuizHistoryStore, QuizHistoryEntry } from '../src/stores/useQuizHistoryStore';

function HistoryCard({ entry, onPress }: { entry: QuizHistoryEntry; onPress: () => void }) {
  const { colors, borderRadius } = useTheme();
  const percentage = Math.round((entry.result.correctAnswers / entry.result.totalQuestions) * 100);
  const date = new Date(entry.completedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  const starsText =
    entry.result.stars === 3 ? '\u2B50\u2B50\u2B50' : entry.result.stars === 2 ? '\u2B50\u2B50' : '\u2B50';

  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.7}>
      <Card elevated style={styles.card}>
        <View style={styles.cardHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.cardTopic, { color: colors.text }]} numberOfLines={1}>
              {entry.topic}
            </Text>
            <Text style={[styles.cardMeta, { color: colors.textMuted }]}>
              {entry.difficulty} | {date}
            </Text>
          </View>
          <Text style={styles.stars}>{starsText}</Text>
        </View>

        <View style={styles.cardStats}>
          <View style={[styles.statBadge, { backgroundColor: colors.correct + '20' }]}>
            <Text style={[styles.statBadgeText, { color: colors.correct }]}>
              {entry.result.correctAnswers}/{entry.result.totalQuestions}
            </Text>
          </View>
          <View style={[styles.statBadge, { backgroundColor: colors.xp + '20' }]}>
            <Text style={[styles.statBadgeText, { color: colors.xp }]}>
              {entry.result.score} pts
            </Text>
          </View>
          <View style={[styles.statBadge, { backgroundColor: percentage >= 70 ? colors.correct + '20' : colors.warning + '20' }]}>
            <Text style={[styles.statBadgeText, { color: percentage >= 70 ? colors.correct : colors.warning }]}>
              {percentage}%
            </Text>
          </View>
        </View>

        <Text style={[styles.reviewHint, { color: colors.primary }]}>
          Tap to review answers {'\u2192'}
        </Text>
      </Card>
    </TouchableOpacity>
  );
}

export default function HistoryScreen() {
  const router = useRouter();
  const { colors } = useTheme();
  const entries = useQuizHistoryStore((s) => s.entries);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>{'\u2190'} Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>{'\uD83D\uDCDA'} Quiz History</Text>
        {entries.length > 0 && (
          <Text style={[styles.subtitle, { color: colors.textMuted }]}>
            {entries.length} completed quiz{entries.length !== 1 ? 'zes' : ''}
          </Text>
        )}
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>{'\uD83D\uDCDA'}</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No quizzes yet</Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            Complete a quiz to see your history here.
          </Text>
          <Button
            title="Start a Quiz"
            onPress={() => router.push('/topic-input')}
            variant="primary"
            size="lg"
          />
        </View>
      ) : (
        <FlatList
          data={entries}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: 16, paddingBottom: 48 }}
          renderItem={({ item }) => (
            <HistoryCard
              entry={item}
              onPress={() => router.push(`/quiz-review/${item.id}` as any)}
            />
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { padding: 24, paddingBottom: 8 },
  backText: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 4 },
  subtitle: { fontSize: 14, fontWeight: '500' },
  card: { marginBottom: 12 },
  cardHeader: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  cardTopic: { fontSize: 17, fontWeight: '700' },
  cardMeta: { fontSize: 13, marginTop: 2 },
  stars: { fontSize: 16, marginLeft: 8 },
  cardStats: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  statBadge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
  statBadgeText: { fontSize: 13, fontWeight: '700' },
  reviewHint: { fontSize: 13, fontWeight: '600' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48, gap: 16 },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { fontSize: 24, fontWeight: '800' },
  emptySub: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 8 },
});
