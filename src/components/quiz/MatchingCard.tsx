import React, { useState, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { MatchingQuestion } from '../../types/quiz';

interface MatchingCardProps {
  question: MatchingQuestion;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (order: number[]) => void;
  disabled: boolean;
  showResult: boolean;
}

export function MatchingCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  disabled,
  showResult,
}: MatchingCardProps) {
  const { colors, borderRadius, spacing } = useTheme();
  const [selectedLeft, setSelectedLeft] = useState<number | null>(null);
  const [matches, setMatches] = useState<Map<number, number>>(new Map());

  // Shuffle right side once
  const shuffledRight = useMemo(() => {
    const indices = question.pairs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices;
  }, [question.id]);

  const handleLeftPress = (index: number) => {
    if (disabled) return;
    setSelectedLeft(index);
  };

  const handleRightPress = (shuffledIndex: number) => {
    if (disabled || selectedLeft === null) return;
    const realRightIndex = shuffledRight[shuffledIndex];
    const newMatches = new Map(matches);
    newMatches.set(selectedLeft, realRightIndex);
    setMatches(newMatches);
    setSelectedLeft(null);
  };

  const handleSubmit = () => {
    const order = question.pairs.map((_, i) => matches.get(i) ?? -1);
    onAnswer(order);
  };

  const allMatched = matches.size === question.pairs.length;

  const getMatchColor = (leftIdx: number, rightRealIdx: number) => {
    if (!showResult) return null;
    return leftIdx === rightRealIdx ? colors.correct : colors.wrong;
  };

  return (
    <Animated.View entering={FadeInRight.duration(300)} key={question.id}>
      <Card elevated style={{ marginBottom: spacing.md }}>
        <Text style={[styles.questionNumber, { color: colors.textSecondary }]}>
          Question {questionNumber} of {totalQuestions}
        </Text>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {question.question}
        </Text>
      </Card>

      <View style={styles.matchingContainer}>
        <View style={styles.column}>
          {question.pairs.map((pair, i) => {
            const isSelected = selectedLeft === i;
            const isMatched = matches.has(i);
            const matchedTo = matches.get(i);
            const matchColor = showResult && matchedTo !== undefined
              ? getMatchColor(i, matchedTo)
              : null;

            return (
              <TouchableOpacity
                key={`l_${i}`}
                onPress={() => handleLeftPress(i)}
                disabled={disabled}
                style={[
                  styles.matchItem,
                  {
                    backgroundColor: isSelected
                      ? colors.primaryLight + '40'
                      : isMatched
                      ? (matchColor || colors.primary) + '20'
                      : colors.surface,
                    borderColor: isSelected
                      ? colors.primary
                      : matchColor || (isMatched ? colors.primary : colors.border),
                    borderRadius: borderRadius.sm,
                  },
                ]}
              >
                <Text style={[styles.matchText, { color: colors.text }]} numberOfLines={2}>
                  {pair.left}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={styles.column}>
          {shuffledRight.map((realIdx, displayIdx) => {
            const isMatchedTo = Array.from(matches.values()).includes(realIdx);

            return (
              <TouchableOpacity
                key={`r_${displayIdx}`}
                onPress={() => handleRightPress(displayIdx)}
                disabled={disabled || selectedLeft === null}
                style={[
                  styles.matchItem,
                  {
                    backgroundColor: isMatchedTo
                      ? colors.primary + '20'
                      : colors.surface,
                    borderColor: isMatchedTo ? colors.primary : colors.border,
                    borderRadius: borderRadius.sm,
                  },
                ]}
              >
                <Text style={[styles.matchText, { color: colors.text }]} numberOfLines={2}>
                  {question.pairs[realIdx].right}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {!disabled && (
        <Button
          title="Submit Match"
          onPress={handleSubmit}
          variant="primary"
          size="md"
          disabled={!allMatched}
          style={{ marginTop: 12 }}
        />
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  questionNumber: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  questionText: { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  matchingContainer: { flexDirection: 'row', gap: 12 },
  column: { flex: 1, gap: 8 },
  matchItem: { padding: 12, borderWidth: 2, minHeight: 48, justifyContent: 'center' },
  matchText: { fontSize: 14, fontWeight: '500', textAlign: 'center' },
});
