import React from 'react';
import { View, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';

interface CardProps {
  children: React.ReactNode;
  style?: ViewStyle;
  elevated?: boolean;
}

/**
 * Duolingo-style brutalist card
 * - Thick 2px border
 * - Flat solid background (no gradients)
 * - Optional hard offset shadow when elevated (no blur)
 */
export function Card({ children, style, elevated = false }: CardProps) {
  const { colors } = useTheme();

  return (
    <View style={[styles.wrapper, style]}>
      {elevated && (
        <View
          style={[
            styles.shadow,
            { backgroundColor: colors.border },
          ]}
        />
      )}
      <View
        style={[
          styles.card,
          {
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
          elevated && { marginBottom: 4 },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'relative',
  },
  shadow: {
    position: 'absolute',
    top: 4,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 16,
  },
  card: {
    borderWidth: 2,
    borderRadius: 16,
    padding: 16,
  },
});
