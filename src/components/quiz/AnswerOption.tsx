import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface AnswerOptionProps {
  text: string;
  index: number;
  onPress: () => void;
  disabled: boolean;
  state: 'default' | 'correct' | 'wrong' | 'revealed';
}

const LABELS = ['A', 'B', 'C', 'D'];

export function AnswerOption({
  text,
  index,
  onPress,
  disabled,
  state,
}: AnswerOptionProps) {
  const { colors, borderRadius, spacing } = useTheme();
  const scale = useSharedValue(1);
  const translateX = useSharedValue(0);

  useEffect(() => {
    if (state === 'wrong') {
      translateX.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 50 }),
        withTiming(0, { duration: 50 })
      );
    } else if (state === 'correct') {
      scale.value = withSequence(
        withSpring(1.05),
        withSpring(1)
      );
    }
  }, [state]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateX: translateX.value }],
  }));

  const getBgColor = () => {
    switch (state) {
      case 'correct':
        return colors.correctLight;
      case 'wrong':
        return colors.wrongLight;
      case 'revealed':
        return colors.correctLight;
      default:
        return colors.surface;
    }
  };

  const getBorderColor = () => {
    switch (state) {
      case 'correct':
        return colors.correct;
      case 'wrong':
        return colors.wrong;
      case 'revealed':
        return colors.correct;
      default:
        return colors.border;
    }
  };

  const getLabelColor = () => {
    switch (state) {
      case 'correct':
      case 'revealed':
        return colors.correct;
      case 'wrong':
        return colors.wrong;
      default:
        return colors.primary;
    }
  };

  return (
    <AnimatedTouchable
      onPress={onPress}
      disabled={disabled}
      activeOpacity={0.7}
      style={[
        styles.container,
        {
          backgroundColor: getBgColor(),
          borderColor: getBorderColor(),
          borderRadius: borderRadius.md,
          padding: spacing.md,
        },
        animatedStyle,
      ]}
    >
      <Text style={[styles.label, { color: getLabelColor() }]}>
        {LABELS[index]}
      </Text>
      <Text
        style={[styles.text, { color: colors.text }]}
        numberOfLines={3}
      >
        {text}
      </Text>
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 2,
    marginBottom: 12,
  },
  label: {
    fontSize: 18,
    fontWeight: '800',
    marginRight: 12,
    width: 28,
    textAlign: 'center',
  },
  text: {
    fontSize: 16,
    fontWeight: '500',
    flex: 1,
  },
});
