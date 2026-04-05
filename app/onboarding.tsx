import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeContext';
import { Button } from '../src/components/ui/Button';
import { useUserStore } from '../src/stores/useUserStore';
import { AVATAR_OPTIONS } from '../src/types/user';
import { apiClient } from '../src/services/api';

export default function OnboardingScreen() {
  const router = useRouter();
  const { mode } = useLocalSearchParams<{ mode?: string }>();
  const { colors, spacing, borderRadius } = useTheme();
  const { setUsername, setPassword: setStorePassword, setAvatar, completeOnboarding } = useUserStore();

  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [isLoginMode, setIsLoginMode] = useState(mode === 'login');

  const canSubmitRegister = name.trim().length >= 2 && password.length >= 4 && password === confirmPassword;
  const canSubmitLogin = name.trim().length >= 2 && password.length >= 4;
  const canSubmit = isLoginMode ? canSubmitLogin : canSubmitRegister;

  const handleGetStarted = async () => {
    if (!canSubmit) return;
    setError('');
    setLoading(true);

    try {
      if (isLoginMode) {
        const userData = await apiClient.login({ username: name.trim(), password });
        setUsername(userData.username);
        setStorePassword(password);
        setAvatar(userData.avatarEmoji);
        completeOnboarding();
        router.replace('/');
      } else {
        const userData = await apiClient.register({
          username: name.trim(),
          password,
          avatarEmoji: selectedAvatar,
        });
        setUsername(userData.username);
        setStorePassword(password);
        setAvatar(userData.avatarEmoji);
        completeOnboarding();
        router.replace('/');
      }
    } catch (err: any) {
      const message = err?.message || '';
      if (message === 'Username already taken') {
        setError('Username already taken, please choose another');
      } else if (message === 'Invalid username or password') {
        setError('Invalid username or password');
      } else {
        setError(message || 'Something went wrong. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>{'\u2190'} Back</Text>
        </TouchableOpacity>

        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={[styles.title, { color: colors.text }]}>
            {isLoginMode ? 'Welcome Back!' : 'Welcome to QuizMaster!'}
          </Text>
        </Animated.View>

        {error !== '' && (
          <Animated.View entering={FadeInDown.duration(300)}>
            <View style={[styles.errorBanner, { backgroundColor: colors.wrong + '20', borderColor: colors.wrong, borderRadius: borderRadius.sm }]}>
              <Text style={[styles.errorText, { color: colors.wrong }]}>{error}</Text>
            </View>
          </Animated.View>
        )}

        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>Username</Text>
          <TextInput
            value={name}
            onChangeText={(text) => { setName(text); setError(''); }}
            placeholder="Enter a username"
            placeholderTextColor={colors.textMuted}
            autoCapitalize="none"
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

        <Animated.View entering={FadeInDown.duration(400).delay(150)}>
          <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>Password</Text>
          <TextInput
            value={password}
            onChangeText={(text) => { setPassword(text); setError(''); }}
            placeholder="Enter a password"
            placeholderTextColor={colors.textMuted}
            secureTextEntry
            style={[
              styles.nameInput,
              {
                color: colors.text,
                borderColor: password.length >= 4 ? colors.primary : colors.border,
                borderRadius: borderRadius.sm,
                backgroundColor: colors.surface,
              },
            ]}
          />
          {password.length > 0 && password.length < 4 && (
            <Text style={[styles.hint, { color: colors.wrong }]}>Minimum 4 characters</Text>
          )}
        </Animated.View>

        {!isLoginMode && (
          <Animated.View entering={FadeInDown.duration(400).delay(175)}>
            <Text style={[styles.label, { color: colors.textSecondary, marginTop: spacing.md }]}>Confirm Password</Text>
            <TextInput
              value={confirmPassword}
              onChangeText={(text) => { setConfirmPassword(text); setError(''); }}
              placeholder="Confirm your password"
              placeholderTextColor={colors.textMuted}
              secureTextEntry
              style={[
                styles.nameInput,
                {
                  color: colors.text,
                  borderColor: confirmPassword.length > 0 && confirmPassword === password ? colors.primary : colors.border,
                  borderRadius: borderRadius.sm,
                  backgroundColor: colors.surface,
                },
              ]}
            />
            {confirmPassword.length > 0 && confirmPassword !== password && (
              <Text style={[styles.hint, { color: colors.wrong }]}>Passwords do not match</Text>
            )}
          </Animated.View>
        )}

        {!isLoginMode && (
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
        )}

        <Animated.View entering={FadeInDown.duration(400).delay(300)} style={{ marginTop: spacing.xl }}>
          <Button
            title={loading ? (isLoginMode ? 'Logging in...' : 'Creating account...') : (isLoginMode ? 'Log In' : 'Get Started')}
            onPress={handleGetStarted}
            variant="primary"
            size="lg"
            disabled={!canSubmit || loading}
            style={{ width: '100%' }}
          />
          {loading && (
            <ActivityIndicator size="small" color={colors.primary} style={{ marginTop: spacing.sm }} />
          )}
        </Animated.View>

        <Animated.View entering={FadeInDown.duration(400).delay(350)} style={styles.switchMode}>
          <TouchableOpacity onPress={() => { setIsLoginMode(!isLoginMode); setError(''); }}>
            <Text style={[styles.switchText, { color: colors.primary }]}>
              {isLoginMode ? "Don't have an account? Register" : 'Already have an account? Log in'}
            </Text>
          </TouchableOpacity>
        </Animated.View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  backBtn: { marginBottom: 8 },
  backText: { fontSize: 16, fontWeight: '600' },
  header: { alignItems: 'center', marginBottom: 32, paddingTop: 16 },
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
  errorBanner: {
    padding: 12,
    borderWidth: 1,
    marginBottom: 16,
  },
  errorText: { fontSize: 14, fontWeight: '600', textAlign: 'center' },
  switchMode: { alignItems: 'center', marginTop: 20 },
  switchText: { fontSize: 15, fontWeight: '600' },
});
