import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { Card } from '../../src/components/ui/Card';
import { Button } from '../../src/components/ui/Button';
import { useQuizHistoryStore, QuizHistoryEntry } from '../../src/stores/useQuizHistoryStore';
import {
  MCQQuestion,
  TrueFalseQuestion,
  FillBlankQuestion,
  MatchingQuestion,
  Question,
  Answer,
} from '../../src/types/quiz';

function getCorrectAnswerText(q: Question): string {
  switch (q.type) {
    case 'mcq':
      return (q as MCQQuestion).options[(q as MCQQuestion).correctIndex];
    case 'true_false':
      return (q as TrueFalseQuestion).correctAnswer ? 'True' : 'False';
    case 'fill_blank':
      return (q as FillBlankQuestion).correctAnswer;
    case 'matching':
      return (q as MatchingQuestion).pairs.map((p) => `${p.left} \u2192 ${p.right}`).join(', ');
    default:
      return '';
  }
}

function getUserAnswerText(q: Question, a: Answer | undefined): string {
  if (!a) return 'Not answered';
  if (a.selectedIndex === -1 && !a.selectedBool && !a.textAnswer) return 'Time expired';

  switch (q.type) {
    case 'mcq':
      return a.selectedIndex >= 0
        ? (q as MCQQuestion).options[a.selectedIndex]
        : 'Not answered';
    case 'true_false':
      return a.selectedBool !== undefined
        ? a.selectedBool ? 'True' : 'False'
        : 'Not answered';
    case 'fill_blank':
      return a.textAnswer || 'Not answered';
    case 'matching':
      return a.matchingOrder ? 'Submitted match' : 'Not answered';
    default:
      return 'Not answered';
  }
}

function QuestionTypeLabel({ type }: { type: string }) {
  const { colors, borderRadius } = useTheme();
  const labels: Record<string, { text: string; icon: string }> = {
    mcq: { text: 'MCQ', icon: '\uD83D\uDD20' },
    true_false: { text: 'True/False', icon: '\u2705' },
    fill_blank: { text: 'Fill Blank', icon: '\u270D\uFE0F' },
    matching: { text: 'Matching', icon: '\uD83D\uDD17' },
  };
  const label = labels[type] || { text: type, icon: '' };
  return (
    <View style={[styles.typeLabel, { backgroundColor: colors.primary + '20', borderRadius: borderRadius.full }]}>
      <Text style={[styles.typeLabelText, { color: colors.primary }]}>
        {label.icon} {label.text}
      </Text>
    </View>
  );
}

function ReviewQuestionCard({
  question,
  answer,
  index,
}: {
  question: Question;
  answer: Answer | undefined;
  index: number;
}) {
  const { colors, borderRadius, spacing } = useTheme();
  const correct = answer?.correct ?? false;
  const borderColor = correct ? colors.correct : colors.wrong;

  return (
    <Card
      elevated
      style={[styles.questionCard, { borderLeftWidth: 4, borderLeftColor: borderColor }]}
    >
      <View style={styles.questionHeader}>
        <View style={styles.questionNumberRow}>
          <Text style={[styles.questionNumber, { color: colors.textSecondary }]}>
            Q{index + 1}
          </Text>
          <Text style={styles.resultIcon}>{correct ? '\u2705' : '\u274C'}</Text>
          <QuestionTypeLabel type={question.type} />
        </View>
        {answer && (
          <Text style={[styles.pointsText, { color: correct ? colors.correct : colors.textMuted }]}>
            {correct ? `+${answer.pointsEarned} pts` : '0 pts'}
          </Text>
        )}
      </View>

      <Text style={[styles.questionText, { color: colors.text }]}>
        {question.question}
      </Text>

      <View style={styles.answerSection}>
        <View style={styles.answerRow}>
          <Text style={[styles.answerLabel, { color: colors.textMuted }]}>Your answer:</Text>
          <Text
            style={[
              styles.answerText,
              { color: correct ? colors.correct : colors.wrong },
            ]}
          >
            {getUserAnswerText(question, answer)}
          </Text>
        </View>

        {!correct && (
          <View style={styles.answerRow}>
            <Text style={[styles.answerLabel, { color: colors.textMuted }]}>Correct answer:</Text>
            <Text style={[styles.answerText, { color: colors.correct }]}>
              {getCorrectAnswerText(question)}
            </Text>
          </View>
        )}
      </View>

      <View style={[styles.explanationBox, { backgroundColor: colors.divider, borderRadius: borderRadius.sm }]}>
        <Text style={[styles.explanationLabel, { color: colors.primary }]}>Explanation</Text>
        <Text style={[styles.explanationText, { color: colors.textSecondary }]}>
          {question.explanation}
        </Text>
      </View>

      {answer && answer.timeSpent > 0 && (
        <Text style={[styles.timeText, { color: colors.textMuted }]}>
          Answered in {answer.timeSpent}s
        </Text>
      )}
    </Card>
  );
}

export default function QuizReviewScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { colors, spacing } = useTheme();
  const entry = useQuizHistoryStore((s) => s.getEntry(id));

  if (!entry) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>{'\uD83D\uDD0D'}</Text>
          <Text style={[styles.emptyText, { color: colors.text }]}>Quiz not found</Text>
          <Button title="Go Home" onPress={() => router.replace('/')} variant="primary" size="md" />
        </View>
      </SafeAreaView>
    );
  }

  const percentage = Math.round((entry.result.correctAnswers / entry.result.totalQuestions) * 100);
  const date = new Date(entry.completedAt).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>{'\u2190'} Back</Text>
        </TouchableOpacity>

        {/* Summary header */}
        <View style={styles.summaryHeader}>
          <Text style={[styles.title, { color: colors.text }]}>{entry.topic}</Text>
          <Text style={[styles.meta, { color: colors.textSecondary }]}>
            {entry.difficulty} | {date}
          </Text>
          <View style={styles.summaryStats}>
            <View style={[styles.summaryBadge, { backgroundColor: colors.correct + '20' }]}>
              <Text style={[styles.summaryBadgeText, { color: colors.correct }]}>
                {entry.result.correctAnswers}/{entry.result.totalQuestions} correct
              </Text>
            </View>
            <View style={[styles.summaryBadge, { backgroundColor: colors.xp + '20' }]}>
              <Text style={[styles.summaryBadgeText, { color: colors.xp }]}>
                {entry.result.score} points
              </Text>
            </View>
            <View style={[styles.summaryBadge, { backgroundColor: colors.star + '20' }]}>
              <Text style={[styles.summaryBadgeText, { color: colors.star }]}>
                {percentage}% accuracy
              </Text>
            </View>
          </View>
        </View>

        {/* Questions list */}
        {entry.questions.map((question, index) => {
          const answer = entry.answers.find((a) => a.questionId === question.id);
          return (
            <ReviewQuestionCard
              key={question.id}
              question={question}
              answer={answer}
              index={index}
            />
          );
        })}

        <View style={styles.bottomActions}>
          <Button
            title="Back to Home"
            onPress={() => { router.replace('/'); }}
            variant="primary"
            size="lg"
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  backText: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  meta: { fontSize: 14, fontWeight: '500', marginBottom: 12 },
  summaryHeader: { marginBottom: 24 },
  summaryStats: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  summaryBadge: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  summaryBadgeText: { fontSize: 13, fontWeight: '700' },
  questionCard: { marginBottom: 16 },
  questionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  questionNumberRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  questionNumber: { fontSize: 14, fontWeight: '800' },
  resultIcon: { fontSize: 16 },
  typeLabel: { paddingHorizontal: 8, paddingVertical: 2 },
  typeLabelText: { fontSize: 11, fontWeight: '700' },
  pointsText: { fontSize: 14, fontWeight: '700' },
  questionText: { fontSize: 16, fontWeight: '600', lineHeight: 24, marginBottom: 12 },
  answerSection: { marginBottom: 12 },
  answerRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 6 },
  answerLabel: { fontSize: 13, fontWeight: '600', width: 110 },
  answerText: { fontSize: 14, fontWeight: '600', flex: 1 },
  explanationBox: { padding: 12, marginBottom: 8 },
  explanationLabel: { fontSize: 12, fontWeight: '700', marginBottom: 4 },
  explanationText: { fontSize: 13, lineHeight: 20 },
  timeText: { fontSize: 12, textAlign: 'right' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48, gap: 16 },
  emptyIcon: { fontSize: 64 },
  emptyText: { fontSize: 20, fontWeight: '700' },
  bottomActions: { marginTop: 16 },
});
