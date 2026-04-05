import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { FadeInRight, FadeOutLeft } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../ui/Card';
import { Question } from '../../types/quiz';
import { AnswerOption } from './AnswerOption';

interface QuestionCardProps {
  question: Question;
  questionNumber: number;
  totalQuestions: number;
  selectedAnswer: number | null;
  onSelectAnswer: (index: number) => void;
  disabled: boolean;
  correctIndex: number;
  showResult: boolean;
}

export function QuestionCard({
  question,
  questionNumber,
  totalQuestions,
  selectedAnswer,
  onSelectAnswer,
  disabled,
  correctIndex,
  showResult,
}: QuestionCardProps) {
  const { colors, spacing } = useTheme();

  const getOptionState = (index: number) => {
    if (!showResult) return 'default';
    if (index === correctIndex) return selectedAnswer === index ? 'correct' : 'revealed';
    if (index === selectedAnswer) return 'wrong';
    return 'default';
  };

  return (
    <Animated.View
      entering={FadeInRight.duration(300)}
      exiting={FadeOutLeft.duration(200)}
      key={question.id}
    >
      <Card elevated style={{ marginBottom: spacing.md }}>
        <Text style={[styles.questionNumber, { color: colors.textSecondary }]}>
          Question {questionNumber} of {totalQuestions}
        </Text>
        <Text style={[styles.questionText, { color: colors.text }]}>
          {question.question}
        </Text>
      </Card>

      <View style={{ gap: 0 }}>
        {question.options.map((option, index) => (
          <AnswerOption
            key={index}
            text={option}
            index={index}
            onPress={() => onSelectAnswer(index)}
            disabled={disabled}
            state={getOptionState(index) as any}
          />
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  questionNumber: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  questionText: {
    fontSize: 18,
    fontWeight: '600',
    lineHeight: 26,
  },
});
