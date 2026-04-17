import React, { useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  ViewStyle,
  ActivityIndicator,
  View,
  Pressable,
} from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { haptics } from '../../services/hapticService';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'warning' | 'accent';
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  icon?: React.ReactNode;
}

/**
 * Duolingo-style brutalist button
 * - Solid color top layer sitting on a darker bottom "shadow" layer
 * - On press, top layer shifts down to meet the shadow (the 3D press-down effect)
 */
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
  const { colors } = useTheme();
  const [pressed, setPressed] = useState(false);

  const handlePress = () => {
    haptics.light();
    onPress();
  };

  // Color scheme for each variant
  const variantStyles = {
    primary: {
      bg: colors.primary,
      shadowBg: colors.shadowPrimary,
      text: '#FFFFFF',
      border: colors.shadowPrimary,
    },
    secondary: {
      bg: colors.secondary,
      shadowBg: colors.shadowSecondary,
      text: '#FFFFFF',
      border: colors.shadowSecondary,
    },
    accent: {
      bg: colors.accent,
      shadowBg: colors.shadowAccent,
      text: '#FFFFFF',
      border: colors.shadowAccent,
    },
    warning: {
      bg: colors.warning,
      shadowBg: colors.shadowWarning,
      text: '#FFFFFF',
      border: colors.shadowWarning,
    },
    outline: {
      bg: colors.surface,
      shadowBg: colors.border,
      text: colors.text,
      border: colors.border,
    },
    ghost: {
      bg: 'transparent',
      shadowBg: 'transparent',
      text: colors.primary,
      border: 'transparent',
    },
  }[variant];

  const padding = {
    sm: { paddingVertical: 10, paddingHorizontal: 16, minHeight: 40 },
    md: { paddingVertical: 14, paddingHorizontal: 22, minHeight: 48 },
    lg: { paddingVertical: 18, paddingHorizontal: 28, minHeight: 56 },
  }[size];

  const fontSize = { sm: 13, md: 15, lg: 17 }[size];
  const shadowDepth = size === 'sm' ? 3 : size === 'lg' ? 5 : 4;

  // Ghost variant: simple, no 3D effect
  if (variant === 'ghost') {
    return (
      <TouchableOpacity
        onPress={handlePress}
        disabled={disabled || loading}
        activeOpacity={0.6}
        style={[styles.ghost, padding, style]}
      >
        {loading ? (
          <ActivityIndicator color={variantStyles.text} />
        ) : (
          <>
            {icon}
            <Text style={[styles.ghostText, { color: variantStyles.text, fontSize }]}>
              {title}
            </Text>
          </>
        )}
      </TouchableOpacity>
    );
  }

  // Brutalist 3D button — two stacked layers
  return (
    <View style={[styles.wrapper, style]}>
      {/* Shadow layer (bottom) */}
      <View
        style={[
          styles.shadowLayer,
          {
            backgroundColor: variantStyles.shadowBg,
            top: shadowDepth,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      />
      {/* Top layer (button face) */}
      <Pressable
        onPress={handlePress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
        disabled={disabled || loading}
        style={[
          styles.topLayer,
          padding,
          {
            backgroundColor: variantStyles.bg,
            borderColor: variantStyles.border,
            transform: [{ translateY: pressed ? shadowDepth : 0 }],
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        {loading ? (
          <ActivityIndicator color={variantStyles.text} />
        ) : (
          <>
            {icon}
            <Text
              style={[
                styles.text,
                {
                  color: variantStyles.text,
                  fontSize,
                },
              ]}
            >
              {title}
            </Text>
          </>
        )}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  shadowLayer: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
    height: '100%',
  },
  topLayer: {
    borderRadius: 16,
    borderWidth: 2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  text: {
    fontWeight: '800',
    letterSpacing: 0.5,
    textTransform: 'uppercase' as const,
  },
  ghost: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  ghostText: {
    fontWeight: '700',
  },
});
