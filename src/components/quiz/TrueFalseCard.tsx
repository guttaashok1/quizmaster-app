import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Animated, {
  FadeInRight,
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../ui/Card';
import { TrueFalseQuestion } from '../../types/quiz';

interface TrueFalseCardProps {
  question: TrueFalseQuestion;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: boolean | null;
  onAnswer: (answer: boolean) => void;
  disabled: boolean;
  showResult: boolean;
}

export function TrueFalseCard({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onAnswer,
  disabled,
  showResult,
}: TrueFalseCardProps) {
  const { colors, borderRadius, spacing } = useTheme();

  const getButtonStyle = (value: boolean) => {
    if (!showResult) {
      return {
        bg: selectedAnswer === value ? colors.primary : colors.surface,
        border: selectedAnswer === value ? colors.primary : colors.border,
        text: selectedAnswer === value ? colors.textOnPrimary : colors.text,
      };
    }
    if (value === question.correctAnswer) {
      return { bg: colors.correctLight, border: colors.correct, text: colors.correct };
    }
    if (selectedAnswer === value && value !== question.correctAnswer) {
      return { bg: colors.wrongLight, border: colors.wrong, text: colors.wrong };
    }
    return { bg: colors.surface, border: colors.border, text: colors.textMuted };
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

      <View style={styles.buttonRow}>
        {[true, false].map((value) => {
          const style = getButtonStyle(value);
          return (
            <TouchableOpacity
              key={String(value)}
              onPress={() => onAnswer(value)}
              disabled={disabled}
              activeOpacity={0.7}
              style={[
                styles.tfButton,
                {
                  backgroundColor: style.bg,
                  borderColor: style.border,
                  borderRadius: borderRadius.lg,
                },
              ]}
            >
              <Text style={[styles.tfEmoji]}>{value ? '\u2705' : '\u274C'}</Text>
              <Text style={[styles.tfLabel, { color: style.text }]}>
                {value ? 'True' : 'False'}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  questionNumber: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  questionText: { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  buttonRow: { flexDirection: 'row', gap: 16 },
  tfButton: {
    flex: 1,
    paddingVertical: 28,
    alignItems: 'center',
    borderWidth: 2,
  },
  tfEmoji: { fontSize: 36, marginBottom: 8 },
  tfLabel: { fontSize: 18, fontWeight: '700' },
});
