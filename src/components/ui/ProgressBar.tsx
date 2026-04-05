import React, { useEffect } from 'react';
import { View, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  interpolateColor,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';

interface ProgressBarProps {
  progress: number; // 0 to 1
  height?: number;
  showWarningColors?: boolean;
}

export function ProgressBar({
  progress,
  height = 8,
  showWarningColors = false,
}: ProgressBarProps) {
  const { colors, borderRadius } = useTheme();
  const animatedProgress = useSharedValue(progress);

  useEffect(() => {
    animatedProgress.value = withTiming(progress, { duration: 300 });
  }, [progress]);

  const barStyle = useAnimatedStyle(() => {
    const backgroundColor = showWarningColors
      ? interpolateColor(
          animatedProgress.value,
          [0, 0.3, 0.6, 1],
          [colors.wrong, colors.warning, colors.accent, colors.correct]
        )
      : colors.primary;

    return {
      width: `${animatedProgress.value * 100}%` as any,
      backgroundColor,
    };
  });

  return (
    <View
      style={[
        styles.track,
        {
          height,
          borderRadius: borderRadius.full,
          backgroundColor: colors.divider,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.bar,
          { height, borderRadius: borderRadius.full },
          barStyle,
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: '100%',
    overflow: 'hidden',
  },
  bar: {
    position: 'absolute',
    left: 0,
    top: 0,
  },
});
