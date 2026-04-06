import React from 'react';
import { View, StyleSheet, ViewStyle, Platform } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

export function Card({ children, style, elevated = false }: CardProps) {
  const { colors, borderRadius, spacing } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: elevated
            ? (Platform.OS === 'web' ? colors.surface + 'E6' : colors.surface + 'E6')
            : colors.surface,
          borderRadius: borderRadius.xl,
          padding: elevated ? spacing.lg : spacing.md,
          borderColor: elevated ? 'rgba(255,255,255,0.1)' : colors.border,
          borderTopColor: elevated ? 'rgba(255,255,255,0.15)' : colors.border,
          borderLeftColor: colors.primary + '40',
          borderLeftWidth: 2,
        },
        elevated && {
          shadowColor: colors.primary,
          shadowOffset: { width: 0, height: 6 },
          shadowOpacity: 0.12,
          shadowRadius: 16,
          elevation: 6,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
  },
});
