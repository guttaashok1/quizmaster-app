import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet } from 'react-native';
import Animated, { FadeInRight } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { FillBlankQuestion } from '../../types/quiz';

interface FillBlankCardProps {
  question: FillBlankQuestion;
  questionNumber: number;
  totalQuestions: number;
  onAnswer: (text: string) => void;
  disabled: boolean;
  showResult: boolean;
  userAnswer: string;
}

export function FillBlankCard({
  question,
  questionNumber,
  totalQuestions,
  onAnswer,
  disabled,
  showResult,
  userAnswer,
}: FillBlankCardProps) {
  const { colors, borderRadius, spacing } = useTheme();
  const [text, setText] = useState('');

  const isCorrect =
    showResult &&
    (text.trim().toLowerCase() === question.correctAnswer.toLowerCase() ||
      question.acceptableAnswers.some(
        (a) => a.toLowerCase() === text.trim().toLowerCase()
      ));

  const inputBorderColor = showResult
    ? isCorrect
      ? colors.correct
      : colors.wrong
    : colors.border;

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

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.input,
            {
              backgroundColor: colors.surface,
              color: colors.text,
              borderColor: inputBorderColor,
              borderRadius: borderRadius.md,
            },
          ]}
          placeholder="Type your answer..."
          placeholderTextColor={colors.textMuted}
          value={text}
          onChangeText={setText}
          editable={!disabled}
          autoCapitalize="none"
          returnKeyType="done"
          onSubmitEditing={() => {
            if (text.trim() && !disabled) onAnswer(text.trim());
          }}
        />
        {!disabled && (
          <Button
            title="Submit"
            onPress={() => onAnswer(text.trim())}
            variant="primary"
            size="md"
            disabled={!text.trim()}
            style={{ marginTop: 12 }}
          />
        )}
      </View>

      {showResult && !isCorrect && (
        <View style={[styles.correctAnswer, { backgroundColor: colors.correctLight, borderRadius: borderRadius.md }]}>
          <Text style={[styles.correctLabel, { color: colors.correct }]}>
            Correct answer: {question.correctAnswer}
          </Text>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  questionNumber: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  questionText: { fontSize: 18, fontWeight: '600', lineHeight: 26 },
  inputContainer: { marginBottom: 12 },
  input: { fontSize: 18, padding: 16, borderWidth: 2, textAlign: 'center' },
  correctAnswer: { padding: 12, marginTop: 8 },
  correctLabel: { fontSize: 16, fontWeight: '600', textAlign: 'center' },
});
