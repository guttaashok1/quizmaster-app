import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeContext';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { useReviewStore } from '../src/stores/useReviewStore';
import { haptics } from '../src/services/hapticService';
import { MCQQuestion, TrueFalseQuestion, FillBlankQuestion, ReviewCard } from '../src/types/quiz';

export default function ReviewScreen() {
  const router = useRouter();
  const { colors, spacing, borderRadius } = useTheme();
  const dueCards = useReviewStore((s) => s.getDueCards());
  const reviewCard = useReviewStore((s) => s.reviewCard);
  const removeCard = useReviewStore((s) => s.removeCard);

  const [currentIdx, setCurrentIdx] = useState(0);
  const [showAnswer, setShowAnswer] = useState(false);
  const [completed, setCompleted] = useState(0);

  const card = dueCards[currentIdx];

  const handleReveal = () => {
    setShowAnswer(true);
  };

  const handleRate = (correct: boolean) => {
    if (!card) return;
    reviewCard(card.questionId, correct);
    if (correct) haptics.success();
    else haptics.error();

    setCompleted((c) => c + 1);
    setShowAnswer(false);

    if (currentIdx + 1 >= dueCards.length) {
      setCurrentIdx(0); // show completion
    } else {
      setCurrentIdx((i) => i + 1);
    }
  };

  const handleRemove = () => {
    if (!card) return;
    removeCard(card.questionId);
    if (currentIdx >= dueCards.length - 1) {
      setCurrentIdx(0);
    }
  };

  const getCorrectAnswerText = (card: ReviewCard): string => {
    const q = card.question;
    switch (q.type) {
      case 'mcq':
        return (q as MCQQuestion).options[(q as MCQQuestion).correctIndex];
      case 'true_false':
        return (q as TrueFalseQuestion).correctAnswer ? 'True' : 'False';
      case 'fill_blank':
        return (q as FillBlankQuestion).correctAnswer;
      default:
        return '';
    }
  };

  if (dueCards.length === 0 || completed >= dueCards.length) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.emptyState}>
          <Text style={styles.emptyIcon}>{completed > 0 ? '\uD83C\uDF89' : '\u2705'}</Text>
          <Text style={[styles.emptyTitle, { color: colors.text }]}>
            {completed > 0 ? 'Review Complete!' : 'All caught up!'}
          </Text>
          <Text style={[styles.emptySub, { color: colors.textSecondary }]}>
            {completed > 0
              ? `You reviewed ${completed} card${completed > 1 ? 's' : ''}. Great job!`
              : 'No cards due for review right now.'}
          </Text>
          <Button title="Back to Home" onPress={() => router.replace('/')} variant="primary" size="lg" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>{'\u2190'} Back</Text>
        </TouchableOpacity>
        <Text style={[styles.counter, { color: colors.textMuted }]}>
          {currentIdx + 1} / {dueCards.length}
        </Text>
      </View>

      <View style={styles.content}>
        <Animated.View entering={FadeInUp.duration(300)} key={card.questionId}>
          <Card elevated style={styles.flashcard}>
            <Text style={[styles.topicLabel, { color: colors.primary }]}>{card.topic}</Text>
            <Text style={[styles.questionText, { color: colors.text }]}>
              {card.question.question}
            </Text>

            {showAnswer && (
              <Animated.View entering={FadeInDown.duration(300)}>
                <View style={[styles.answerDivider, { backgroundColor: colors.divider }]} />
                <Text style={[styles.answerLabel, { color: colors.correct }]}>Answer:</Text>
                <Text style={[styles.answerText, { color: colors.text }]}>
                  {getCorrectAnswerText(card)}
                </Text>
                <Text style={[styles.explanation, { color: colors.textSecondary }]}>
                  {card.question.explanation}
                </Text>
              </Animated.View>
            )}
          </Card>
        </Animated.View>

        {!showAnswer ? (
          <Button title="Show Answer" onPress={handleReveal} variant="primary" size="lg" />
        ) : (
          <View style={styles.ratingRow}>
            <Button
              title="Got it Wrong"
              onPress={() => handleRate(false)}
              variant="outline"
              size="md"
              style={{ flex: 1, borderColor: colors.wrong }}
            />
            <Button
              title="Got it Right"
              onPress={() => handleRate(true)}
              variant="primary"
              size="md"
              style={{ flex: 1, backgroundColor: colors.correct }}
            />
          </View>
        )}

        <TouchableOpacity onPress={handleRemove} style={styles.removeBtn}>
          <Text style={[styles.removeText, { color: colors.textMuted }]}>Remove from review</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 24, paddingBottom: 0 },
  backText: { fontSize: 16, fontWeight: '600' },
  counter: { fontSize: 14, fontWeight: '600' },
  content: { flex: 1, padding: 24, justifyContent: 'center' },
  flashcard: { marginBottom: 32, paddingVertical: 32 },
  topicLabel: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 12 },
  questionText: { fontSize: 20, fontWeight: '600', lineHeight: 28 },
  answerDivider: { height: 1, marginVertical: 20 },
  answerLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  answerText: { fontSize: 18, fontWeight: '600', marginBottom: 12 },
  explanation: { fontSize: 14, lineHeight: 20 },
  ratingRow: { flexDirection: 'row', gap: 12 },
  removeBtn: { alignItems: 'center', marginTop: 16 },
  removeText: { fontSize: 13 },
  emptyState: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 48, gap: 16 },
  emptyIcon: { fontSize: 64 },
  emptyTitle: { fontSize: 24, fontWeight: '800' },
  emptySub: { fontSize: 16, textAlign: 'center', lineHeight: 24, marginBottom: 16 },
});
