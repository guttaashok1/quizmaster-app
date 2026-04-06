import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Alert,
  Platform,
  Switch,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../src/theme/ThemeContext';
import { Button } from '../src/components/ui/Button';
import { Card } from '../src/components/ui/Card';
import { TopicChip } from '../src/components/topic/TopicChip';
import { VoiceInputButton } from '../src/components/topic/VoiceInputButton';
import { useQuizStore } from '../src/stores/useQuizStore';
import { useUserStore } from '../src/stores/useUserStore';
import { useReviewStore } from '../src/stores/useReviewStore';
import { apiClient } from '../src/services/api';
import { Difficulty, QuestionType } from '../src/types/quiz';
import { SUGGESTED_TOPICS } from '../src/constants/topics';
import { QUESTIONS_PER_QUIZ } from '../src/constants/game';
import { haptics } from '../src/services/hapticService';

const DIFFICULTIES: { label: string; value: Difficulty; icon: string }[] = [
  { label: 'Easy', value: 'easy', icon: '\uD83C\uDF1F' },
  { label: 'Medium', value: 'medium', icon: '\u26A1' },
  { label: 'Hard', value: 'hard', icon: '\uD83D\uDD25' },
];

const QUESTION_TYPES: { label: string; value: QuestionType; icon: string }[] = [
  { label: 'MCQ', value: 'mcq', icon: '\uD83D\uDD20' },
  { label: 'True/False', value: 'true_false', icon: '\u2705' },
  { label: 'Fill Blank', value: 'fill_blank', icon: '\u270D\uFE0F' },
  { label: 'Matching', value: 'matching', icon: '\uD83D\uDD17' },
];

type InputMode = 'topic' | 'paste' | 'url';

export default function TopicInputScreen() {
  const router = useRouter();
  const { colors, spacing, borderRadius } = useTheme();
  const startQuiz = useQuizStore((s) => s.startQuiz);
  const username = useUserStore((s) => s.username);
  const reviewCards = useReviewStore((s) => s.cards);
  const today = new Date().toISOString().split('T')[0];
  const dueCount = reviewCards.filter((c) => c.nextReviewDate <= today).length;

  const [topic, setTopic] = useState('');
  const [difficulty, setDifficulty] = useState<Difficulty>('easy');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [selectedTypes, setSelectedTypes] = useState<QuestionType[]>(['mcq']);
  const [inputMode, setInputMode] = useState<InputMode>('topic');
  const [pasteContent, setPasteContent] = useState('');
  const [urlInput, setUrlInput] = useState('');
  const [questionCount, setQuestionCount] = useState(5);
  const [timePerQuestion, setTimePerQuestion] = useState(5);
  const [errorMessage, setErrorMessage] = useState('');
  const { challenge } = useLocalSearchParams<{ challenge?: string }>();
  const [challengeMode, setChallengeMode] = useState(challenge === 'true');
  const scrollRef = useRef<ScrollView>(null);

  const toggleType = (type: QuestionType) => {
    haptics.selection();
    setSelectedTypes((prev) => {
      if (prev.includes(type)) {
        if (prev.length === 1) return prev; // at least one
        return prev.filter((t) => t !== type);
      }
      return [...prev, type];
    });
  };

  const handleGenerate = useCallback(async () => {
    setErrorMessage('');
    const topicText = inputMode === 'topic' ? topic.trim() : inputMode === 'url' ? urlInput.trim() : 'Custom Content';
    const showError = (msg: string) => {
      setErrorMessage(msg);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    };

    if (inputMode === 'topic' && !topicText) {
      showError('Please enter a topic or select one from the suggestions below.');
      return;
    }
    if (inputMode === 'paste' && !pasteContent.trim()) {
      showError('Please paste some text to generate questions from.');
      return;
    }
    if (inputMode === 'url' && !urlInput.trim()) {
      showError('Please enter a URL to generate questions from.');
      return;
    }

    setLoading(true);
    try {
      const response = await apiClient.generateQuiz({
        topic: topicText,
        count: questionCount,
        difficulty,
        questionTypes: selectedTypes,
        contentSource: inputMode === 'paste' ? 'text' : inputMode === 'url' ? 'url' : 'prompt',
        sourceContent: inputMode === 'paste' ? pasteContent : inputMode === 'url' ? urlInput : undefined,
      });

      if (challengeMode) {
        try {
          const challenge = await apiClient.createChallenge({
            topic: topicText,
            difficulty,
            questions: response.questions,
            creatorName: username,
            creatorScore: 0,
          });
          startQuiz(response.questions, topicText, difficulty, true, timePerQuestion, challenge.id);
          const msg = `Challenge Created!\n\nShare this code with friends: ${challenge.id}\n\nThey can enter it on the home screen to play the same quiz!`;
          if (Platform.OS === 'web' && typeof window !== 'undefined') {
            window.alert(msg);
          } else {
            Alert.alert('Challenge Created!', `Share this code with friends: ${challenge.id}\n\nThey can enter it on their home screen to play the same quiz!`);
          }
          router.push('/quiz/play');
          return;
        } catch {
          // Fall through to normal quiz if challenge creation fails
        }
      }
      startQuiz(response.questions, topicText, difficulty, true, timePerQuestion);
      router.push('/quiz/play');
    } catch (error) {
      setErrorMessage('Could not generate quiz questions. Please check your connection and try again.');
      scrollRef.current?.scrollTo({ y: 0, animated: true });
    } finally {
      setLoading(false);
    }
  }, [topic, difficulty, startQuiz, router, selectedTypes, inputMode, pasteContent, urlInput, challengeMode, username]);

  const handleVoicePress = async () => {
    if (Platform.OS === 'web') {
      Alert.alert('Not Available', 'Voice input is not available on web.');
      return;
    }
    try {
      const ExpoSpeechRecognition = require('expo-speech-recognition');
      if (isRecording) {
        ExpoSpeechRecognition.ExpoSpeechRecognitionModule.stop();
        setIsRecording(false);
      } else {
        const { granted } = await ExpoSpeechRecognition.ExpoSpeechRecognitionModule.requestPermissionsAsync();
        if (!granted) { Alert.alert('Permission Required', 'Microphone permission is needed.'); return; }
        setIsRecording(true);
        ExpoSpeechRecognition.ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true });
        ExpoSpeechRecognition.addSpeechRecognitionListener('result', (event: any) => {
          if (event.results?.[0]?.transcript) setTopic(event.results[0].transcript);
        });
        ExpoSpeechRecognition.addSpeechRecognitionListener('end', () => setIsRecording(false));
        ExpoSpeechRecognition.addSpeechRecognitionListener('error', () => setIsRecording(false));
      }
    } catch {
      Alert.alert('Not Available', 'Speech recognition is not available on this device.');
      setIsRecording(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView ref={scrollRef} contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={[styles.backText, { color: colors.primary }]}>{'\u2190'} Back</Text>
        </TouchableOpacity>

        {/* Error message banner - shown at top for visibility */}
        {errorMessage !== '' && (
          <View style={[styles.errorBannerTop, { backgroundColor: colors.wrongLight, borderColor: colors.wrong, borderRadius: borderRadius.md }]}>
            <Text style={styles.errorIcon}>{'\u26A0\uFE0F'}</Text>
            <Text style={[styles.errorText, { color: colors.wrong }]}>{errorMessage}</Text>
            <TouchableOpacity onPress={() => setErrorMessage('')}>
              <Text style={[styles.errorClose, { color: colors.wrong }]}>{'\u2715'}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Review reminder */}
        {dueCount > 0 && (
          <View>
            <TouchableOpacity onPress={() => router.push('/review' as any)}>
              <Card elevated style={[styles.reviewBanner, { borderColor: colors.warning }]}>
                <Text style={styles.reviewIcon}>{'\uD83D\uDD04'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.reviewTitle, { color: colors.text }]}>
                    {dueCount} cards due for review
                  </Text>
                  <Text style={[styles.reviewSub, { color: colors.textMuted }]}>
                    Strengthen your knowledge with spaced repetition
                  </Text>
                </View>
              </Card>
            </TouchableOpacity>
          </View>
        )}

        <View>
          <Text style={[styles.title, { color: colors.text }]}>
            What do you want to learn?
          </Text>

          {/* Input mode tabs */}
          <View style={styles.inputModeTabs}>
            {([
              { mode: 'topic' as InputMode, label: 'Topic', icon: '\uD83D\uDCA1' },
              { mode: 'paste' as InputMode, label: 'Paste Text', icon: '\uD83D\uDCCB' },
              { mode: 'url' as InputMode, label: 'URL', icon: '\uD83C\uDF10' },
            ]).map((tab) => (
              <TouchableOpacity
                key={tab.mode}
                onPress={() => { haptics.selection(); setInputMode(tab.mode); setErrorMessage(''); }}
                style={[
                  styles.inputModeTab,
                  {
                    backgroundColor: inputMode === tab.mode ? colors.primary : colors.surface,
                    borderColor: inputMode === tab.mode ? colors.primary : colors.border,
                    borderRadius: borderRadius.full,
                  },
                ]}
              >
                <Text style={{ fontSize: 14, color: inputMode === tab.mode ? colors.textOnPrimary : colors.text, fontWeight: '600' }}>
                  {tab.icon} {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Topic input */}
          {inputMode === 'topic' && (
            <View style={styles.inputRow}>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, borderRadius: borderRadius.md }]}
                placeholder="e.g., Quantum Physics, World War II..."
                placeholderTextColor={colors.textMuted}
                value={topic}
                onChangeText={setTopic}
                autoFocus
              />
              <VoiceInputButton isRecording={isRecording} onPress={handleVoicePress} />
            </View>
          )}

          {/* Paste text input */}
          {inputMode === 'paste' && (
            <TextInput
              style={[styles.textArea, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, borderRadius: borderRadius.md }]}
              placeholder="Paste your study notes, article, or any text here..."
              placeholderTextColor={colors.textMuted}
              value={pasteContent}
              onChangeText={setPasteContent}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
            />
          )}

          {/* URL input */}
          {inputMode === 'url' && (
            <TextInput
              style={[styles.input, { backgroundColor: colors.surface, color: colors.text, borderColor: colors.border, borderRadius: borderRadius.md }]}
              placeholder="https://en.wikipedia.org/wiki/..."
              placeholderTextColor={colors.textMuted}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              keyboardType="url"
            />
          )}
        </View>

        {/* Options */}
        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Options</Text>

          {/* Difficulty - inline row */}
          <View style={styles.optionRow}>
            <Text style={[styles.optionLabel, { color: colors.textSecondary }]}>Difficulty</Text>
            <View style={styles.optionChips}>
              {DIFFICULTIES.map((d) => (
                <TouchableOpacity key={d.value} onPress={() => { haptics.selection(); setDifficulty(d.value); }}
                  style={[styles.miniChip, { backgroundColor: difficulty === d.value ? colors.primary : colors.surface, borderColor: difficulty === d.value ? colors.primary : colors.border, borderRadius: borderRadius.full }]}>
                  <Text style={{ color: difficulty === d.value ? colors.textOnPrimary : colors.text, fontSize: 12, fontWeight: '600' }}>{d.icon} {d.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Questions count - inline row */}
          <View style={styles.optionRow}>
            <Text style={[styles.optionLabel, { color: colors.textSecondary }]}>Questions</Text>
            <View style={styles.optionChips}>
              {[5, 10, 15, 20].map((count) => (
                <TouchableOpacity key={count} onPress={() => { haptics.selection(); setQuestionCount(count); }}
                  style={[styles.miniChip, { backgroundColor: questionCount === count ? colors.primary : colors.surface, borderColor: questionCount === count ? colors.primary : colors.border, borderRadius: borderRadius.full }]}>
                  <Text style={{ color: questionCount === count ? colors.textOnPrimary : colors.text, fontSize: 12, fontWeight: '600' }}>{count}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Time per question - inline row */}
          <View style={styles.optionRow}>
            <Text style={[styles.optionLabel, { color: colors.textSecondary }]}>Timer</Text>
            <View style={styles.optionChips}>
              {[5, 15, 30, 45, 60].map((secs) => (
                <TouchableOpacity key={secs} onPress={() => { haptics.selection(); setTimePerQuestion(secs); }}
                  style={[styles.miniChip, { backgroundColor: timePerQuestion === secs ? colors.primary : colors.surface, borderColor: timePerQuestion === secs ? colors.primary : colors.border, borderRadius: borderRadius.full }]}>
                  <Text style={{ color: timePerQuestion === secs ? colors.textOnPrimary : colors.text, fontSize: 12, fontWeight: '600' }}>{secs}s</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          {/* Question types - inline row */}
          <View style={styles.optionRow}>
            <Text style={[styles.optionLabel, { color: colors.textSecondary }]}>Types</Text>
            <View style={styles.optionChips}>
              {QUESTION_TYPES.map((qt) => {
                const selected = selectedTypes.includes(qt.value);
                return (
                  <TouchableOpacity key={qt.value} onPress={() => toggleType(qt.value)}
                    style={[styles.miniChip, { backgroundColor: selected ? colors.primary : colors.surface, borderColor: selected ? colors.primary : colors.border, borderRadius: borderRadius.full }]}>
                    <Text style={{ color: selected ? colors.textOnPrimary : colors.text, fontSize: 12, fontWeight: '600' }}>{qt.icon} {qt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>
        </View>

        <View>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Suggested Topics</Text>
          <View style={styles.chipsContainer}>
            {SUGGESTED_TOPICS.slice(0, 12).map((t) => (
              <TopicChip key={t} label={t} onPress={() => setTopic(t)} selected={topic === t} />
            ))}
          </View>
        </View>

        <View style={[styles.challengeToggle, { backgroundColor: colors.surface, borderColor: colors.border, borderRadius: borderRadius.md }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.challengeToggleTitle, { color: colors.text }]}>{'\u2694\uFE0F'} Challenge a Friend</Text>
            <Text style={[styles.challengeToggleHint, { color: colors.textMuted }]}>Create a code to share with friends</Text>
          </View>
          <Switch
            value={challengeMode}
            onValueChange={setChallengeMode}
            trackColor={{ false: colors.border, true: colors.primary + '60' }}
            thumbColor={challengeMode ? colors.primary : colors.textMuted}
          />
        </View>

        <View>
          <Button
            title={loading ? 'Generating Questions...' : challengeMode ? 'Create Challenge' : 'Generate Quiz'}
            onPress={handleGenerate}
            variant="primary"
            size="lg"
            loading={loading}
            disabled={loading}
            style={{ marginTop: spacing.sm }}
            icon={!loading ? <Text style={{ fontSize: 18 }}>{'\u2728'}</Text> : undefined}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  backBtn: { marginBottom: 16 },
  backText: { fontSize: 16, fontWeight: '600' },
  title: { fontSize: 28, fontWeight: '800', marginBottom: 16 },
  inputModeTabs: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  inputModeTab: { paddingHorizontal: 14, paddingVertical: 8, borderWidth: 1 },
  inputRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 24 },
  input: { flex: 1, fontSize: 16, padding: 16, borderWidth: 2 },
  textArea: { fontSize: 16, padding: 16, borderWidth: 2, minHeight: 140, marginBottom: 24 },
  sectionTitle: { fontSize: 18, fontWeight: '700', marginBottom: 12 },
  optionRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 },
  optionLabel: { fontSize: 13, fontWeight: '600', width: 70 },
  optionChips: { flexDirection: 'row', flexWrap: 'wrap', flex: 1, gap: 6 },
  miniChip: { paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1 },
  errorBannerTop: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, marginBottom: 16, gap: 10 },
  errorBanner: { flexDirection: 'row', alignItems: 'center', padding: 14, borderWidth: 1, marginBottom: 8, gap: 10 },
  errorIcon: { fontSize: 20 },
  errorText: { flex: 1, fontSize: 14, fontWeight: '600', lineHeight: 20 },
  errorClose: { fontSize: 18, fontWeight: '700', paddingLeft: 8 },
  challengeToggle: { flexDirection: 'row', alignItems: 'center', padding: 16, borderWidth: 1, marginBottom: 16 },
  challengeToggleTitle: { fontSize: 15, fontWeight: '700' },
  challengeToggleHint: { fontSize: 12, marginTop: 2 },
  chipsContainer: { flexDirection: 'row', flexWrap: 'wrap', marginBottom: 24 },
  reviewBanner: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20, borderWidth: 1 },
  reviewIcon: { fontSize: 28 },
  reviewTitle: { fontSize: 15, fontWeight: '700' },
  reviewSub: { fontSize: 12, marginTop: 2 },
});
