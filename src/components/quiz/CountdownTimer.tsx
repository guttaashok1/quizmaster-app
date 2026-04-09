import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ProgressBar } from '../ui/ProgressBar';
import { TIME_PER_QUESTION } from '../../constants/game';
import { Difficulty } from '../../types/quiz';

interface CountdownTimerProps {
  timeRemaining: number;
  difficulty: Difficulty;
  customTime?: number | null;
}

export function CountdownTimer({
  timeRemaining,
  difficulty,
  customTime,
}: CountdownTimerProps) {
  const { colors } = useTheme();
  const totalTime = customTime ?? TIME_PER_QUESTION[difficulty];
  const progress = totalTime > 0 ? timeRemaining / totalTime : 0;

  const getTimeColor = () => {
    if (progress > 0.5) return colors.correct;
    if (progress > 0.25) return colors.warning;
    return colors.wrong;
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.time, { color: getTimeColor() }]}>
        {timeRemaining}s
      </Text>
      <View style={styles.barContainer}>
        <ProgressBar progress={progress} height={6} showWarningColors />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  time: {
    fontSize: 18,
    fontWeight: '800',
    width: 40,
  },
  barContainer: {
    flex: 1,
  },
});
