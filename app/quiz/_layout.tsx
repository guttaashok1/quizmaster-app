import { Stack } from 'expo-router';
import { useTheme } from '../../src/theme/ThemeContext';

export default function QuizLayout() {
  const { colors } = useTheme();

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: 'slide_from_right',
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="play" />
      <Stack.Screen name="results" />
    </Stack>
  );
}
