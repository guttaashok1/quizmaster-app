import React from 'react';
import { TouchableOpacity, Text, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import { haptics } from '../../services/hapticService';

interface TopicChipProps {
  label: string;
  onPress: () => void;
  selected?: boolean;
}

export function TopicChip({ label, onPress, selected = false }: TopicChipProps) {
  const { colors, borderRadius } = useTheme();

  const handlePress = () => {
    haptics.selection();
    onPress();
  };

  return (
    <TouchableOpacity
      onPress={handlePress}
      activeOpacity={0.7}
      style={[
        styles.chip,
        {
          backgroundColor: selected ? colors.primary : colors.surface,
          borderColor: selected ? colors.primary : colors.border,
          borderRadius: borderRadius.full,
        },
      ]}
    >
      <Text
        style={[
          styles.label,
          { color: selected ? colors.textOnPrimary : colors.text },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    marginRight: 8,
    marginBottom: 8,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
  },
});
