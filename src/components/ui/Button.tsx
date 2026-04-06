import React from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  View,
} from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../../theme/ThemeContext';
import { haptics } from '../../services/hapticService';

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'md',
  disabled = false,
  loading = false,
  style,
  icon,
}: ButtonProps) {
  const { colors, borderRadius } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96);
  };

  const handlePressOut = () => {
    scale.value = withSpring(1);
  };

  const handlePress = () => {
    haptics.light();
    onPress();
  };

  const textColor = {
    primary: colors.textOnPrimary,
    secondary: colors.textOnPrimary,
    outline: colors.primary,
    ghost: colors.primary,
  }[variant];

  const borderColor = variant === 'outline' ? colors.primary : 'transparent';

  const padding = {
    sm: { paddingVertical: 8, paddingHorizontal: 16 },
    md: { paddingVertical: 14, paddingHorizontal: 24 },
    lg: { paddingVertical: 18, paddingHorizontal: 32 },
  }[size];

  const fontSize = { sm: 14, md: 16, lg: 18 }[size];

  const useGradient = variant === 'primary' || variant === 'secondary';
  const gradientColors = variant === 'primary'
    ? colors.gradientPrimary
    : colors.gradientSecondary;

  const pillRadius = borderRadius.full;

  if (useGradient) {
    return (
      <Animated.View style={[animatedStyle, style]}>
        <LinearGradient
          colors={gradientColors as [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
          style={[
            {
              borderRadius: pillRadius,
              overflow: 'hidden' as const,
              shadowColor: colors.primary,
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.3,
              shadowRadius: 8,
              elevation: 6,
              opacity: disabled ? 0.5 : 1,
            },
          ]}
        >
          <TouchableOpacity
            onPress={handlePress}
            onPressIn={handlePressIn}
            onPressOut={handlePressOut}
            disabled={disabled || loading}
            activeOpacity={0.8}
            style={[
              styles.button,
              {
                borderColor: 'transparent',
                borderRadius: pillRadius,
                ...padding,
              },
            ]}
          >
            {loading ? (
              <ActivityIndicator color={textColor} />
            ) : (
              <>
                {icon}
                <Text style={[styles.text, { color: textColor, fontSize }]}>
                  {title}
                </Text>
              </>
            )}
          </TouchableOpacity>
        </LinearGradient>
      </Animated.View>
    );
  }

  const bgColor = {
    outline: 'transparent',
    ghost: 'transparent',
  }[variant as 'outline' | 'ghost'];

  return (
    <AnimatedTouchable
      onPress={handlePress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[
        styles.button,
        {
          backgroundColor: bgColor,
          borderColor,
          borderRadius: borderRadius.md,
          opacity: disabled ? 0.5 : 1,
          ...padding,
        },
        animatedStyle,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={textColor} />
      ) : (
        <>
          {icon}
          <Text style={[styles.text, { color: textColor, fontSize }]}>
            {title}
          </Text>
        </>
      )}
    </AnimatedTouchable>
  );
}

const styles = StyleSheet.create({
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    gap: 8,
  },
  text: {
    fontWeight: '700',
  },
});
