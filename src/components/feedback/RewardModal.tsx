import React from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../ui/Button';
import { Confetti } from './Confetti';

interface RewardModalProps {
  visible: boolean;
  milestone: number;
  onDismiss: () => void;
}

export function RewardModal({ visible, milestone, onDismiss }: RewardModalProps) {
  const { colors, borderRadius, spacing } = useTheme();

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
        <Confetti active={visible} />
        <Animated.View
          entering={SlideInDown.duration(300).springify()}
          style={[
            styles.modal,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              padding: spacing.lg,
            },
          ]}
        >
          <Text style={styles.trophy}>{'\uD83C\uDFC6'}</Text>
          <Text style={[styles.title, { color: colors.text }]}>
            {'\uD83C\uDF89'} {milestone} Points!
          </Text>
          <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
            You've reached a milestone! Keep learning!
          </Text>
          <Button
            title="Awesome!"
            onPress={onDismiss}
            variant="primary"
            size="lg"
            style={{ marginTop: spacing.md, width: '100%' }}
          />
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modal: {
    alignItems: 'center',
    width: '85%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
  trophy: { fontSize: 80, marginBottom: 16 },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 8 },
  subtitle: { fontSize: 16, fontWeight: '500', textAlign: 'center' },
});
