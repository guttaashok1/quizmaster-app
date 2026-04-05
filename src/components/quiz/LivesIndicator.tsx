import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withSpring,
} from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { INITIAL_LIVES } from '../../constants/game';

interface LivesIndicatorProps {
  lives: number;
}

function Heart({ filled, index }: { filled: boolean; index: number }) {
  const { colors } = useTheme();
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  React.useEffect(() => {
    if (!filled) {
      scale.value = withSequence(withSpring(1.3), withSpring(0.8));
    }
  }, [filled]);

  return (
    <Animated.Text
      style={[
        styles.heart,
        { color: filled ? colors.heart : colors.textMuted },
        animatedStyle,
      ]}
    >
      {filled ? '\u2764\uFE0F' : '\uD83E\uDD0D'}
    </Animated.Text>
  );
}

export function LivesIndicator({ lives }: LivesIndicatorProps) {
  return (
    <View style={styles.container}>
      {Array.from({ length: INITIAL_LIVES }, (_, i) => (
        <Heart key={i} filled={i < lives} index={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    gap: 4,
  },
  heart: {
    fontSize: 22,
  },
});
