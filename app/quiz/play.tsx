import React, { useState, useCallback, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity } from 'react-native';
import Animated, { FadeInRight, FadeInUp } from 'react-native-reanimated';
import { useRouter } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';
import { useQuizStore } from '../../src/stores/useQuizStore';
import { useReviewStore } from '../../src/stores/useReviewStore';
import { apiClient } from '../../src/services/api';
import { useUserStore } from '../../src/stores/useUserStore';
import { useCountdown } from '../../src/hooks/useCountdown';
import { QuestionCard } from '../../src/components/quiz/QuestionCard';
import { TrueFalseCard } from '../../src/components/quiz/TrueFalseCard';
import { FillBlankCard } from '../../src/components/quiz/FillBlankCard';
import { MatchingCard } from '../../src/components/quiz/MatchingCard';
import { CountdownTimer } from '../../src/components/quiz/CountdownTimer';
import { ScoreDisplay } from '../../src/components/quiz/ScoreDisplay';
import { ExplanationModal } from '../../src/components/quiz/ExplanationModal';
import { Confetti } from '../../src/components/feedback/Confetti';
import { AnswerFlash } from '../../src/components/feedback/AnswerFlash';
import { ProgressBar } from '../../src/components/ui/ProgressBar';
import { haptics } from '../../src/services/hapticService';
import {
  MCQQuestion,
  TrueFalseQuestion,
  FillBlankQuestion,
  MatchingQuestion,
} from '../../src/types/quiz';

export default function QuizPlayScreen() {
  const router = useRouter();
  const { colors, spacing } = useTheme();
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [selectedBool, setSelectedBool] = useState<boolean | null>(null);
  const [textAnswer, setTextAnswer] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [flashColor, setFlashColor] = useState<string | null>(null);
  const prevAdaptiveDiff = useRef<string | null>(null);
  const [diffChange, setDiffChange] = useState<string | null>(null);
  const [mpToast, setMpToast] = useState<string | null>(null);
  const submittedRef = useRef<number>(-1);

  const {
    questions,
    currentIndex,
    score,
    timeRemaining,
    difficulty,
    status,
    showExplanation,
    lastAnswerCorrect,
    answers,
    topic,
    currentAdaptiveDifficulty,
    customTimePerQuestion,
    answerQuestion,
    nextQuestion,
    dismissExplanation,
    resetQuiz,
  } = useQuizStore();

  const challengeId = useQuizStore((s) => s.challengeId);
  const isMultiplayer = useQuizStore((s) => s.isMultiplayer);
  const username = useUserStore((s) => s.username);

  const addWrongAnswer = useReviewStore((s) => s.addWrongAnswer);

  useCountdown();

  const currentQuestion = questions[currentIndex];
  const isLastQuestion = currentIndex >= questions.length - 1;

  useEffect(() => {
    if (status === 'idle' || questions.length === 0) {
      router.replace('/');
    }
  }, [status, questions.length]);

  useEffect(() => {
    if (status === 'finished' && !showExplanation) {
      router.replace('/quiz/results');
    }
  }, [status, showExplanation]);

  // Track adaptive difficulty changes
  useEffect(() => {
    if (prevAdaptiveDiff.current && prevAdaptiveDiff.current !== currentAdaptiveDifficulty) {
      const levels = ['easy', 'medium', 'hard'];
      setDiffChange(
        levels.indexOf(currentAdaptiveDifficulty) > levels.indexOf(prevAdaptiveDiff.current)
          ? 'up'
          : 'down'
      );
    }
    prevAdaptiveDiff.current = currentAdaptiveDifficulty;
  }, [currentAdaptiveDifficulty]);

  // Show confetti on correct answer + flash
  useEffect(() => {
    if (lastAnswerCorrect === true) {
      setShowConfetti(true);
      setFlashColor('#22c55e');
      setTimeout(() => setShowConfetti(false), 2500);
    } else if (lastAnswerCorrect === false) {
      setFlashColor('#ef4444');
    }
    if (lastAnswerCorrect !== null) {
      setTimeout(() => setFlashColor(null), 700);
    }
  }, [lastAnswerCorrect, answers.length]);

  // Add wrong answers to spaced repetition
  useEffect(() => {
    if (lastAnswerCorrect === false && currentQuestion) {
      addWrongAnswer(currentQuestion, topic);
    }
  }, [lastAnswerCorrect, answers.length]);

  // Multiplayer polling effect
  useEffect(() => {
    if (!isMultiplayer || !challengeId || status !== 'playing') return;

    const poll = setInterval(async () => {
      try {
        const progress = await apiClient.getChallengeProgress(challengeId);
        if (!progress) return;

        const serverQ = progress.currentQuestion;
        const localQ = useQuizStore.getState().currentIndex;

        // Server is ahead — someone else answered. Auto-advance.
        if (serverQ > localQ && !useQuizStore.getState().showExplanation) {
          const key = String(localQ);
          const answer = progress.questionAnswers[key];
          if (answer && answer.answeredBy !== username) {
            setMpToast(`\u26A1 ${answer.answeredBy} answered first!`);
            setTimeout(() => setMpToast(null), 2000);
          }
          // Force advance to next question
          useQuizStore.getState().nextQuestion();
        }

        // Check if quiz is done (server advanced past all questions)
        if (serverQ >= progress.totalQuestions) {
          clearInterval(poll);
        }
      } catch {}
    }, 2000);

    return () => clearInterval(poll);
  }, [isMultiplayer, challengeId, status]);

  // Submit answer to server in multiplayer mode
  useEffect(() => {
    if (!isMultiplayer || !challengeId) return;
    if (answers.length === 0) return;

    const lastAnswer = answers[answers.length - 1];
    const qIndex = answers.length - 1;

    // Don't submit the same question twice
    if (qIndex <= submittedRef.current) return;
    submittedRef.current = qIndex;

    apiClient.answerChallengeQuestion(challengeId, {
      questionIndex: qIndex,
      username,
      correct: lastAnswer.correct,
      timeMs: lastAnswer.timeSpent * 1000,
    }).catch(() => {});
  }, [answers.length, isMultiplayer, challengeId]);

  // In multiplayer, auto-advance after answering (skip explanation modal)
  useEffect(() => {
    if (!isMultiplayer || !showExplanation) return;
    const timer = setTimeout(() => {
      setSelectedAnswer(null);
      setSelectedBool(null);
      setTextAnswer('');
      setDiffChange(null);
      dismissExplanation();
      if (status === 'finished' || isLastQuestion) {
        router.replace('/quiz/results');
      } else {
        nextQuestion();
      }
    }, 1500);
    return () => clearTimeout(timer);
  }, [isMultiplayer, showExplanation]);

  const handleMCQAnswer = useCallback(
    (index: number) => {
      if (showExplanation || selectedAnswer !== null) return;
      setSelectedAnswer(index);
      const correct = index === (currentQuestion as MCQQuestion).correctIndex;
      if (correct) haptics.success();
      else haptics.error();
      answerQuestion({ selectedIndex: index });
    },
    [showExplanation, selectedAnswer, currentQuestion, answerQuestion]
  );

  const handleTrueFalseAnswer = useCallback(
    (answer: boolean) => {
      if (showExplanation || selectedBool !== null) return;
      setSelectedBool(answer);
      const correct = answer === (currentQuestion as TrueFalseQuestion).correctAnswer;
      if (correct) haptics.success();
      else haptics.error();
      answerQuestion({ selectedBool: answer });
    },
    [showExplanation, selectedBool, currentQuestion, answerQuestion]
  );

  const handleFillBlankAnswer = useCallback(
    (text: string) => {
      if (showExplanation) return;
      setTextAnswer(text);
      answerQuestion({ textAnswer: text });
    },
    [showExplanation, answerQuestion]
  );

  const handleMatchingAnswer = useCallback(
    (order: number[]) => {
      if (showExplanation) return;
      answerQuestion({ matchingOrder: order });
    },
    [showExplanation, answerQuestion]
  );

  const handleContinue = useCallback(() => {
    setSelectedAnswer(null);
    setSelectedBool(null);
    setTextAnswer('');
    setDiffChange(null);
    dismissExplanation();

    if (status === 'finished' || isLastQuestion) {
      router.replace('/quiz/results');
    } else {
      nextQuestion();
    }
  }, [status, isLastQuestion, dismissExplanation, nextQuestion, router]);

  if (!currentQuestion) return null;

  const latestAnswer = answers[answers.length - 1];
  const progress = (currentIndex + 1) / questions.length;

  // Get correct answer text for tutor
  const getCorrectAnswerText = (): string => {
    switch (currentQuestion.type) {
      case 'mcq':
        return (currentQuestion as MCQQuestion).options[(currentQuestion as MCQQuestion).correctIndex];
      case 'true_false':
        return (currentQuestion as TrueFalseQuestion).correctAnswer ? 'True' : 'False';
      case 'fill_blank':
        return (currentQuestion as FillBlankQuestion).correctAnswer;
      case 'matching':
        return (currentQuestion as MatchingQuestion).pairs.map((p) => `${p.left} → ${p.right}`).join(', ');
      default:
        return '';
    }
  };

  const getUserAnswerText = (): string => {
    if (!latestAnswer) return '';
    switch (currentQuestion.type) {
      case 'mcq':
        return latestAnswer.selectedIndex >= 0
          ? (currentQuestion as MCQQuestion).options[latestAnswer.selectedIndex]
          : 'No answer';
      case 'true_false':
        return latestAnswer.selectedBool !== undefined
          ? latestAnswer.selectedBool ? 'True' : 'False'
          : 'No answer';
      case 'fill_blank':
        return latestAnswer.textAnswer || 'No answer';
      case 'matching':
        return 'Matching attempt';
      default:
        return '';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <Confetti active={showConfetti} />
      <AnswerFlash color={flashColor} />
      {mpToast && (
        <View style={styles.mpToast}>
          <Text style={styles.mpToastText}>{mpToast}</Text>
        </View>
      )}

      <View style={[styles.topBar, { paddingHorizontal: spacing.md }]}>
        <TouchableOpacity
          onPress={() => {
            resetQuiz();
            router.replace('/');
          }}
          style={styles.exitBtn}
        >
          <Text style={[styles.exitText, { color: colors.textMuted }]}>{'\u2715'}</Text>
        </TouchableOpacity>
        <Text style={[styles.questionCounter, { color: colors.textSecondary }]}>Q {currentIndex + 1}/{questions.length}</Text>
        <View style={styles.diffBadge}>
          <Text style={[styles.diffText, { color: colors.textMuted }]}>
            {currentAdaptiveDifficulty.toUpperCase()}
          </Text>
        </View>
        <ScoreDisplay score={score} />
      </View>

      <View style={{ paddingHorizontal: spacing.md, marginBottom: spacing.sm }}>
        <ProgressBar progress={progress} height={4} />
      </View>

      <View style={[{ paddingHorizontal: spacing.md, marginBottom: spacing.md }, timeRemaining <= 5 && timeRemaining > 0 && { shadowColor: '#EF4444', shadowOffset: { width: 0, height: 0 }, shadowOpacity: 0.5, shadowRadius: 12 }]}>
        <CountdownTimer timeRemaining={timeRemaining} difficulty={currentAdaptiveDifficulty} customTime={customTimePerQuestion} />
      </View>

      <View style={[styles.content, { paddingHorizontal: spacing.md }]}>
        <Animated.View key={`q_${currentIndex}`} entering={FadeInRight.duration(300)}>
          {currentQuestion.type === 'mcq' && (
            <QuestionCard
              question={currentQuestion as MCQQuestion}
              questionNumber={currentIndex + 1}
              totalQuestions={questions.length}
              selectedAnswer={selectedAnswer}
              onSelectAnswer={handleMCQAnswer}
              disabled={showExplanation || selectedAnswer !== null}
              correctIndex={(currentQuestion as MCQQuestion).correctIndex}
              showResult={showExplanation}
            />
          )}
          {currentQuestion.type === 'true_false' && (
            <TrueFalseCard
              question={currentQuestion as TrueFalseQuestion}
              questionNumber={currentIndex + 1}
              totalQuestions={questions.length}
              selectedAnswer={selectedBool}
              onAnswer={handleTrueFalseAnswer}
              disabled={showExplanation || selectedBool !== null}
              showResult={showExplanation}
            />
          )}
          {currentQuestion.type === 'fill_blank' && (
            <FillBlankCard
              question={currentQuestion as FillBlankQuestion}
              questionNumber={currentIndex + 1}
              totalQuestions={questions.length}
              onAnswer={handleFillBlankAnswer}
              disabled={showExplanation}
              showResult={showExplanation}
              userAnswer={textAnswer}
            />
          )}
          {currentQuestion.type === 'matching' && (
            <MatchingCard
              question={currentQuestion as MatchingQuestion}
              questionNumber={currentIndex + 1}
              totalQuestions={questions.length}
              onAnswer={handleMatchingAnswer}
              disabled={showExplanation}
              showResult={showExplanation}
            />
          )}
        </Animated.View>
      </View>

      <ExplanationModal
        visible={showExplanation}
        correct={lastAnswerCorrect === true}
        explanation={currentQuestion.explanation}
        pointsEarned={latestAnswer?.pointsEarned ?? 0}
        onContinue={handleContinue}
        isLastQuestion={isLastQuestion || status === 'finished'}
        questionText={currentQuestion.question}
        userAnswer={getUserAnswerText()}
        correctAnswer={getCorrectAnswerText()}
        topic={topic}
        adaptiveDifficultyChanged={diffChange}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  topBar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  diffBadge: { paddingHorizontal: 8, paddingVertical: 2 },
  diffText: { fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  content: { flex: 1 },
  exitBtn: { padding: 4 },
  exitText: { fontSize: 22, fontWeight: '700' },
  questionCounter: { fontSize: 14, fontWeight: '700' },
  mpToast: { position: 'absolute', top: 80, left: 20, right: 20, backgroundColor: 'rgba(0,0,0,0.8)', borderRadius: 12, padding: 12, zIndex: 999, alignItems: 'center' } as any,
  mpToastText: { color: '#FFFFFF', fontSize: 15, fontWeight: '700' },
});
