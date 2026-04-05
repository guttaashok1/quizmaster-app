import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../ui/Button';
import { TutorModal } from './TutorModal';

interface ExplanationModalProps {
  visible: boolean;
  correct: boolean;
  explanation: string;
  pointsEarned: number;
  onContinue: () => void;
  isLastQuestion: boolean;
  questionText: string;
  userAnswer: string;
  correctAnswer: string;
  topic: string;
  adaptiveDifficultyChanged?: string | null;
}

export function ExplanationModal({
  visible,
  correct,
  explanation,
  pointsEarned,
  onContinue,
  isLastQuestion,
  questionText,
  userAnswer,
  correctAnswer,
  topic,
  adaptiveDifficultyChanged,
}: ExplanationModalProps) {
  const { colors, borderRadius, spacing } = useTheme();
  const [showTutor, setShowTutor] = useState(false);

  if (!visible) return null;

  return (
    <>
      <Modal transparent visible={visible && !showTutor} animationType="none">
        <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
          <Animated.View
            entering={SlideInDown.duration(300).springify()}
            style={[
              styles.modal,
              {
                backgroundColor: colors.surface,
                borderRadius: borderRadius.xl,
                padding: spacing.lg,
              },
            ]}
          >
            <Text style={styles.emoji}>
              {correct ? '\u2705' : '\u274C'}
            </Text>
            <Text
              style={[
                styles.title,
                { color: correct ? colors.correct : colors.wrong },
              ]}
            >
              {correct ? 'Correct!' : 'Wrong!'}
            </Text>

            {correct && pointsEarned > 0 && (
              <Text style={[styles.points, { color: colors.xp }]}>
                +{pointsEarned} points
              </Text>
            )}

            {adaptiveDifficultyChanged && (
              <Text style={[styles.adaptiveHint, { color: colors.warning }]}>
                {adaptiveDifficultyChanged === 'up'
                  ? '\u26A1 Difficulty increased!'
                  : '\uD83D\uDCA8 Difficulty decreased'}
              </Text>
            )}

            <Text style={[styles.explanation, { color: colors.textSecondary }]}>
              {explanation}
            </Text>

            {!correct && (
              <Button
                title="Ask AI Tutor"
                onPress={() => setShowTutor(true)}
                variant="outline"
                size="md"
                style={{ marginTop: spacing.sm, width: '100%' }}
                icon={<Text>{'\uD83E\uDDD1\u200D\uD83C\uDFEB'}</Text>}
              />
            )}

            <Button
              title={isLastQuestion ? 'See Results' : 'Next Question'}
              onPress={onContinue}
              variant="primary"
              size="lg"
              style={{ marginTop: spacing.md, width: '100%' }}
            />
          </Animated.View>
        </Animated.View>
      </Modal>

      <TutorModal
        visible={showTutor}
        onClose={() => setShowTutor(false)}
        question={questionText}
        userAnswer={userAnswer}
        correctAnswer={correctAnswer}
        topic={topic}
        explanation={explanation}
      />
    </>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: { alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
  emoji: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 24, fontWeight: '800', marginBottom: 4 },
  points: { fontSize: 18, fontWeight: '700', marginBottom: 8 },
  adaptiveHint: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  explanation: { fontSize: 15, lineHeight: 22, textAlign: 'center' },
});
