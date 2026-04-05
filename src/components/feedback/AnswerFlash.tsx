import React, { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';

interface Props {
  color: string | null;
  onFinish?: () => void;
}

export function AnswerFlash({ color, onFinish }: Props) {
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (color) {
      opacity.value = 0.45;
      opacity.value = withTiming(0, { duration: 600 }, (finished) => {
        if (finished && onFinish) runOnJS(onFinish)();
      });
    }
  }, [color]);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    backgroundColor: color || 'transparent',
  }));

  if (!color) return null;

  return (
    <Animated.View
      style={[StyleSheet.absoluteFillObject, { zIndex: 998, pointerEvents: 'none' }, animatedStyle]}
    />
  );
}
