import React, { useEffect } from 'react';
import { Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';

interface ScoreDisplayProps {
  score: number;
}

export function ScoreDisplay({ score }: ScoreDisplayProps) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);
  const prevScore = React.useRef(score);

  useEffect(() => {
    if (score > prevScore.current) {
      scale.value = withSequence(withSpring(1.3), withSpring(1));
    }
    prevScore.current = score;
  }, [score]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={[styles.container, animatedStyle]}>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        Score
      </Text>
      <Text style={[styles.score, { color: colors.xp }]}>{score}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  label: {
    fontSize: 12,
    fontWeight: '600',
  },
  score: {
    fontSize: 22,
    fontWeight: '800',
  },
});
