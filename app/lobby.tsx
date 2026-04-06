import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  Platform,
  ActivityIndicator,
  TouchableOpacity,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import Animated, { FadeInDown, FadeInRight, ZoomIn } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeContext';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { useQuizStore } from '../src/stores/useQuizStore';
import { useUserStore } from '../src/stores/useUserStore';
import { apiClient } from '../src/services/api';

export default function LobbyScreen() {
  const router = useRouter();
  const { id, host } = useLocalSearchParams<{ id: string; host?: string }>();
  const { colors, spacing, borderRadius } = useTheme();
  const username = useUserStore((s) => s.username);
  const startQuiz = useQuizStore((s) => s.startQuiz);

  const isHost = host === 'true';
  const [participants, setParticipants] = useState<string[]>([]);
  const [status, setStatus] = useState<string>('waiting');
  const [challenge, setChallenge] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [error, setError] = useState('');
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load challenge data on mount
  useEffect(() => {
    if (!id) {
      router.replace('/');
      return;
    }

    const loadChallenge = async () => {
      try {
        const data = await apiClient.getChallenge(id);
        setChallenge(data);
        setParticipants(data.participants || [data.creatorName]);
        setStatus(data.status || 'waiting');
        setLoading(false);
      } catch {
        setError('Challenge not found');
        setLoading(false);
      }
    };

    loadChallenge();
  }, [id]);

  // Poll for status updates every 3 seconds
  useEffect(() => {
    if (!id || status === 'started') return;

    pollingRef.current = setInterval(async () => {
      try {
        const data = await apiClient.getChallengeStatus(id);
        setParticipants(data.participants || []);
        setStatus(data.status);

        // If host started, begin quiz for everyone
        if (data.status === 'started' && !isHost) {
          clearInterval(pollingRef.current!);
          setCountdown(3);
          setTimeout(() => setCountdown(2), 1000);
          setTimeout(() => setCountdown(1), 2000);
          setTimeout(async () => {
            setCountdown(0);
            await handleStartQuiz();
          }, 3000);
        }
      } catch {
        // Silently ignore polling errors
      }
    }, 3000);

    return () => {
      if (pollingRef.current) clearInterval(pollingRef.current);
    };
  }, [id, status, isHost, challenge]);

  const handleStartQuiz = async () => {
    try {
      // Always fetch fresh challenge data to ensure we have questions
      const freshData = await apiClient.getChallenge(id!);
      if (!freshData || !freshData.questions || freshData.questions.length === 0) {
        setError('No questions found. Try creating a new challenge.');
        return;
      }
      startQuiz(freshData.questions, freshData.topic, freshData.difficulty, false, null, freshData.id);
      router.replace('/quiz/play');
    } catch {
      setError('Failed to load quiz. Try again.');
    }
  };

  const handleHostStart = async () => {
    if (!id) return;
    setStarting(true);
    setError('');
    try {
      await apiClient.startChallenge(id);
      // Countdown before starting quiz
      setCountdown(3);
      setTimeout(() => setCountdown(2), 1000);
      setTimeout(() => setCountdown(1), 2000);
      setTimeout(async () => {
        setCountdown(0);
        await handleStartQuiz();
      }, 3000);
    } catch (err: any) {
      setError('Failed to start: ' + (err?.message || 'Unknown error'));
      setStarting(false);
    }
  };

  const handleLeave = () => {
    if (pollingRef.current) clearInterval(pollingRef.current);
    router.replace('/');
  };

  const copyCode = () => {
    if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(id || '');
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={[styles.loadingText, { color: colors.textMuted }]}>Loading lobby...</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error && !challenge) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
        <View style={styles.center}>
          <Text style={{ fontSize: 48 }}>{'\u274C'}</Text>
          <Text style={[styles.errorText, { color: colors.wrong }]}>{error}</Text>
          <Button title="Go Home" onPress={() => router.replace('/')} variant="primary" size="md" style={{ marginTop: 20 }} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.content}>
        {/* Header */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.header}>
          <Text style={{ fontSize: 48 }}>{'\u2694\uFE0F'}</Text>
          <Text style={[styles.title, { color: colors.text }]}>Challenge Lobby</Text>
          <Text style={[styles.topicText, { color: colors.textSecondary }]}>
            {challenge?.topic} - {challenge?.difficulty}
          </Text>
          {challenge?.visibility && (
            <View style={[styles.visibilityBadge, {
              backgroundColor: challenge.visibility === 'public' ? colors.correct + '20' : colors.primary + '20',
              borderRadius: borderRadius.full
            }]}>
              <Text style={{ fontSize: 12, fontWeight: '600', color: challenge.visibility === 'public' ? colors.correct : colors.primary }}>
                {challenge.visibility === 'public' ? '\uD83C\uDF0D Public' : '\uD83D\uDD12 Private'}
              </Text>
            </View>
          )}
        </Animated.View>

        {/* Challenge Code */}
        <Animated.View entering={FadeInDown.duration(400).delay(100)}>
          <Card elevated style={[styles.codeCard, { borderColor: colors.primary }]}>
            <Text style={[styles.codeLabel, { color: colors.textMuted }]}>Share this code with friends</Text>
            <TouchableOpacity onPress={copyCode} activeOpacity={0.7}>
              <Text style={[styles.codeText, { color: colors.primary }]}>{id}</Text>
            </TouchableOpacity>
            <Text style={[styles.copyHint, { color: colors.textMuted }]}>Tap to copy</Text>
          </Card>
        </Animated.View>

        {/* Participants */}
        <Animated.View entering={FadeInDown.duration(400).delay(200)} style={styles.participantsSection}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Players ({participants.length})
          </Text>
          {participants.map((name, i) => (
            <Animated.View
              key={name + i}
              entering={FadeInRight.duration(400).delay(i * 100)}
              style={[styles.participantRow, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.sm }]}
            >
              <Text style={styles.participantEmoji}>
                {name === challenge?.creatorName ? '\uD83D\uDC51' : '\uD83D\uDC64'}
              </Text>
              <Text style={[styles.participantName, { color: colors.text }]}>
                {name}{name === username ? ' (You)' : ''}{name === challenge?.creatorName ? ' - Host' : ''}
              </Text>
            </Animated.View>
          ))}

          {status === 'waiting' && (
            <View style={styles.waitingDots}>
              <ActivityIndicator size="small" color={colors.textMuted} />
              <Text style={[styles.waitingText, { color: colors.textMuted }]}>
                Waiting for more players...
              </Text>
            </View>
          )}
        </Animated.View>

        {countdown !== null && (
          <View style={styles.countdownOverlay}>
            <Animated.View entering={ZoomIn.duration(300)}>
              <Text style={styles.countdownText}>
                {countdown === 0 ? 'GO!' : countdown}
              </Text>
            </Animated.View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {error ? <Text style={[styles.errorSmall, { color: colors.wrong }]}>{error}</Text> : null}

          {isHost ? (
            <Button
              title={starting ? 'Starting...' : `Start Quiz (${participants.length} player${participants.length > 1 ? 's' : ''})`}
              onPress={handleHostStart}
              variant="primary"
              size="lg"
              disabled={starting}
              style={{ marginBottom: 12 }}
              icon={<Text style={{ fontSize: 18 }}>{'\uD83D\uDE80'}</Text>}
            />
          ) : (
            <View style={[styles.waitingBanner, { backgroundColor: colors.primary + '15', borderRadius: borderRadius.md }]}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={[styles.waitingBannerText, { color: colors.primary }]}>
                Waiting for host to start the quiz...
              </Text>
            </View>
          )}

          <Button
            title="Leave Lobby"
            onPress={handleLeave}
            variant="ghost"
            size="md"
          />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, padding: 24, justifyContent: 'space-between' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingText: { fontSize: 16, marginTop: 12 },
  errorText: { fontSize: 18, fontWeight: '700', marginTop: 12, textAlign: 'center' },
  errorSmall: { fontSize: 13, textAlign: 'center', marginBottom: 8 },
  header: { alignItems: 'center', paddingTop: 16 },
  title: { fontSize: 28, fontWeight: '800', marginTop: 8 },
  topicText: { fontSize: 16, fontWeight: '500', marginTop: 4, textTransform: 'capitalize' },
  codeCard: { alignItems: 'center', paddingVertical: 20, marginTop: 20, borderWidth: 2 },
  codeLabel: { fontSize: 13, fontWeight: '500', marginBottom: 8 },
  codeText: { fontSize: 40, fontWeight: '900', letterSpacing: 2, textShadowColor: 'rgba(108,99,255,0.3)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 },
  copyHint: { fontSize: 11, marginTop: 4 },
  participantsSection: { flex: 1, marginTop: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  participantRow: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12, marginBottom: 8, borderWidth: 1 },
  participantEmoji: { fontSize: 24 },
  participantName: { fontSize: 16, fontWeight: '600' },
  waitingDots: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8, justifyContent: 'center' },
  waitingText: { fontSize: 13 },
  actions: { paddingBottom: 8 },
  waitingBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 16, marginBottom: 12 },
  waitingBannerText: { fontSize: 15, fontWeight: '600' },
  visibilityBadge: { paddingHorizontal: 12, paddingVertical: 4, marginTop: 8 },
  countdownOverlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', zIndex: 999 },
  countdownText: { fontSize: 120, fontWeight: '900', color: '#FFFFFF' },
});
