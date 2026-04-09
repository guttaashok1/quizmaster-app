import React, { useEffect } from 'react';
import { TouchableOpacity, Text, StyleSheet, Platform } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
  withSequence,
  cancelAnimation,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { haptics } from '../../services/hapticService';

interface VoiceInputButtonProps {
  isRecording: boolean;
  onPress: () => void;
}

export function VoiceInputButton({
  isRecording,
  onPress,
}: VoiceInputButtonProps) {
  const { colors, borderRadius } = useTheme();
  const pulseScale = useSharedValue(1);
  const pulseOpacity = useSharedValue(0);

  useEffect(() => {
    if (isRecording) {
      pulseScale.value = withRepeat(
        withSequence(
          withTiming(1.5, { duration: 800 }),
          withTiming(1, { duration: 800 })
        ),
        -1,
        false
      );
      pulseOpacity.value = withRepeat(
        withSequence(
          withTiming(0.3, { duration: 800 }),
          withTiming(0, { duration: 800 })
        ),
        -1,
        false
      );
    } else {
      cancelAnimation(pulseScale);
      cancelAnimation(pulseOpacity);
      pulseScale.value = withTiming(1);
      pulseOpacity.value = withTiming(0);
    }
  }, [isRecording]);

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pulseScale.value }],
    opacity: pulseOpacity.value,
  }));

  const handlePress = () => {
    haptics.medium();
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={styles.wrapper}
    >
      <Animated.View
        style={[
          styles.pulse,
          { backgroundColor: colors.secondary, borderRadius: borderRadius.full },
          pulseStyle,
        ]}
      />
      <Animated.View
        style={[
          styles.button,
          {
            backgroundColor: isRecording ? colors.secondary : colors.primary,
            borderRadius: borderRadius.full,
          },
        ]}
      >
        <Text style={styles.icon}>{isRecording ? '\uD83D\uDD34' : '\uD83C\uDF99\uFE0F'}</Text>
      </Animated.View>
      <Text style={[styles.label, { color: colors.textSecondary }]}>
        {isRecording ? 'Listening...' : 'Tap to speak'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    alignItems: 'center',
    gap: 8,
  },
  pulse: {
    position: 'absolute',
    width: 56,
    height: 56,
    top: 0,
  },
  button: {
    width: 56,
    height: 56,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
  },
  label: {
    fontSize: 12,
    fontWeight: '500',
  },
});
