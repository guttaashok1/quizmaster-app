import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeContext';
import { Button } from '../src/components/ui/Button';
import { useUserStore } from '../src/stores/useUserStore';
import { AVATAR_OPTIONS } from '../src/types/user';

export default function OnboardingScreen() {
  const router = useRouter();
  const { colors, spacing, borderRadius } = useTheme();
  const { setUsername, setAvatar, completeOnboarding } = useUserStore();

  const [name, setName] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);

  const canSubmit = name.trim().length >= 2;

  const handleGetStarted = () => {
    if (!canSubmit) return;
    setUsername(name.trim());
    setAvatar(selectedAvatar);
    completeOnboarding();
    router.replace('/');
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>Welcome to QuizMaster!</Text>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Your Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Enter a username"
            placeholderTextColor={colors.textMuted}
            style={[
              styles.nameInput,
              {
                color: colors.text,
                borderColor: name.trim().length >= 2 ? colors.primary : colors.border,
                borderRadius: borderRadius.sm,
                backgroundColor: colors.surface,
              },
            ]}
            autoFocus
          />
          {name.length > 0 && name.trim().length < 2 && (
            <Text style={[styles.hint, { color: colors.wrong }]}>Minimum 2 characters</Text>
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(200)}>
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.lg }]}>
            Choose an Avatar
          </Text>
          <View style={styles.avatarGrid}>
            {AVATAR_OPTIONS.map((emoji) => (
              <TouchableOpacity
                key={emoji}
                onPress={() => setSelectedAvatar(emoji)}
                style={[
                  styles.avatarOption,
                  {
                    backgroundColor:
                      selectedAvatar === emoji ? colors.primary + '30' : 'transparent',
                    borderColor: selectedAvatar === emoji ? colors.primary : 'transparent',
                    borderRadius: borderRadius.md,
                  },
                ]}
              >
                <Text style={styles.avatarOptionEmoji}>{emoji}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={{ marginTop: spacing.xl }}>
          <Button
            title="Get Started"
            onPress={handleGetStarted}
            variant="primary"
            size="lg"
            disabled={!canSubmit}
            style={{ width: '100%' }}
          />
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  header: { alignItems: 'center', marginBottom: 32, paddingTop: 48 },
  title: { fontSize: 28, fontWeight: '800', textAlign: 'center' },
  label: { fontSize: 16, fontWeight: '600', marginBottom: 8 },
  nameInput: {
    fontSize: 18,
    fontWeight: '600',
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  hint: { fontSize: 12, marginTop: 4 },
  avatarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 8,
  },
  avatarOption: { padding: 8, borderWidth: 2 },
  avatarOptionEmoji: { fontSize: 32 },
});
