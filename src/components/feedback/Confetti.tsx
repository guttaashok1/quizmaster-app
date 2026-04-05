import React, { useEffect } from 'react';
import { StyleSheet, Dimensions } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  withDelay,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { CONFETTI_PIECE_COUNT, CONFETTI_DURATION } from '../../constants/game';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const COLORS = ['#FF6584', '#6C63FF', '#00D4AA', '#F59E0B', '#10B981', '#8B85FF', '#FF8FA3'];

interface ConfettiPieceProps {
  index: number;
  onComplete?: () => void;
}

function ConfettiPiece({ index, onComplete }: ConfettiPieceProps) {
  const translateY = useSharedValue(-20);
  const translateX = useSharedValue(Math.random() * SCREEN_WIDTH);
  const rotate = useSharedValue(0);
  const opacity = useSharedValue(1);
  const scale = useSharedValue(0);

  const color = COLORS[index % COLORS.length];
  const size = 8 + Math.random() * 8;
  const startX = Math.random() * SCREEN_WIDTH;
  const drift = (Math.random() - 0.5) * 200;
  const delay = Math.random() * 400;

  useEffect(() => {
    translateX.value = startX;
    scale.value = withDelay(delay, withTiming(1, { duration: 200 }));
    translateY.value = withDelay(
      delay,
      withTiming(SCREEN_HEIGHT + 50, {
        duration: CONFETTI_DURATION + Math.random() * 1000,
        easing: Easing.out(Easing.quad),
      })
    );
    translateX.value = withDelay(
      delay,
      withTiming(startX + drift, { duration: CONFETTI_DURATION })
    );
    rotate.value = withDelay(
      delay,
      withTiming(360 * (2 + Math.random() * 3), { duration: CONFETTI_DURATION })
    );
    opacity.value = withDelay(
      CONFETTI_DURATION - 300,
      withTiming(0, { duration: 500 })
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
      { scale: scale.value },
    ],
    opacity: opacity.value,
  }));

  const isSquare = index % 3 === 0;
  const borderRadius = isSquare ? 2 : size / 2;

  return (
    <Animated.View
      style={[
        styles.piece,
        {
          width: size,
          height: isSquare ? size : size * 0.6,
          backgroundColor: color,
          borderRadius,
        },
        animatedStyle,
      ]}
    />
  );
}

interface ConfettiProps {
  active: boolean;
  onComplete?: () => void;
}

export function Confetti({ active, onComplete }: ConfettiProps) {
  if (!active) return null;

  return (
    <Animated.View style={styles.container} pointerEvents="none">
      {Array.from({ length: CONFETTI_PIECE_COUNT }, (_, i) => (
        <ConfettiPiece
          key={i}
          index={i}
          onComplete={i === 0 ? onComplete : undefined}
        />
      ))}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 999,
    pointerEvents: 'none',
  },
  piece: {
    position: 'absolute',
  },
});
