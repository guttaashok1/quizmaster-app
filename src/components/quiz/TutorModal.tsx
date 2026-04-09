import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import Animated, { FadeIn, SlideInDown } from 'react-native-reanimated';
import { useTheme } from '../../theme/ThemeContext';
import { Button } from '../ui/Button';
import { apiClient } from '../../services/api';

interface TutorModalProps {
  visible: boolean;
  onClose: () => void;
  question: string;
  userAnswer: string;
  correctAnswer: string;
  topic: string;
  explanation: string;
}

export function TutorModal({
  visible,
  onClose,
  question,
  userAnswer,
  correctAnswer,
  topic,
  explanation,
}: TutorModalProps) {
  const { colors, borderRadius, spacing } = useTheme();
  const [loading, setLoading] = useState(false);
  const [tutorResponse, setTutorResponse] = useState<{
    deepExplanation: string;
    relatedConcepts: string[];
    followUpQuestion?: string;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleAskTutor = async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.askTutor({
        question,
        userAnswer,
        correctAnswer,
        topic,
        explanation,
      });
      setTutorResponse(result);
    } catch (e) {
      setError('Could not reach the tutor. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setTutorResponse(null);
    setError(null);
    onClose();
  };

  if (!visible) return null;

  return (
    <Modal transparent visible={visible} animationType="none">
      <Animated.View entering={FadeIn.duration(200)} style={styles.overlay}>
        <Animated.View
          entering={SlideInDown.duration(300).springify()}
          style={[
            styles.modal,
            {
              backgroundColor: colors.surface,
              borderRadius: borderRadius.xl,
              maxHeight: '80%',
            },
          ]}
        >
          <ScrollView contentContainerStyle={{ padding: spacing.lg }}>
            <Text style={[styles.title, { color: colors.primary }]}>
              {'\uD83E\uDDD1\u200D\uD83C\uDFEB'} AI Tutor
            </Text>

            {!tutorResponse && !loading && (
              <View>
                <Text style={[styles.desc, { color: colors.textSecondary }]}>
                  Want a deeper explanation? The AI tutor can help you understand
                  this concept better.
                </Text>
                <Button
                  title="Explain This to Me"
                  onPress={handleAskTutor}
                  variant="primary"
                  size="lg"
                  icon={<Text style={{ fontSize: 18 }}>{'\uD83D\uDCA1'}</Text>}
                />
              </View>
            )}

            {loading && (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                  Thinking...
                </Text>
              </View>
            )}

            {error && (
              <View>
                <Text style={[styles.error, { color: colors.wrong }]}>{error}</Text>
                <Button title="Retry" onPress={handleAskTutor} variant="outline" size="md" />
              </View>
            )}

            {tutorResponse && (
              <View>
                <Text style={[styles.explanation, { color: colors.text }]}>
                  {tutorResponse.deepExplanation}
                </Text>

                {tutorResponse.relatedConcepts.length > 0 && (
                  <View style={styles.conceptsSection}>
                    <Text style={[styles.conceptsTitle, { color: colors.primary }]}>
                      Related Concepts
                    </Text>
                    {tutorResponse.relatedConcepts.map((concept, i) => (
                      <Text key={i} style={[styles.concept, { color: colors.textSecondary }]}>
                        {'\u2022'} {concept}
                      </Text>
                    ))}
                  </View>
                )}

                {tutorResponse.followUpQuestion && (
                  <View style={[styles.followUp, { backgroundColor: colors.primaryLight + '20', borderRadius: borderRadius.md }]}>
                    <Text style={[styles.followUpLabel, { color: colors.primary }]}>
                      Think About This:
                    </Text>
                    <Text style={[styles.followUpText, { color: colors.text }]}>
                      {tutorResponse.followUpQuestion}
                    </Text>
                  </View>
                )}
              </View>
            )}
          </ScrollView>

          <View style={{ padding: spacing.md }}>
            <Button title="Close" onPress={handleClose} variant="ghost" size="md" />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' },
  modal: { shadowColor: '#000', shadowOffset: { width: 0, height: -4 }, shadowOpacity: 0.15, shadowRadius: 16, elevation: 8 },
  title: { fontSize: 22, fontWeight: '800', marginBottom: 12 },
  desc: { fontSize: 15, lineHeight: 22, marginBottom: 20 },
  loadingContainer: { alignItems: 'center', paddingVertical: 32 },
  loadingText: { marginTop: 12, fontSize: 14 },
  error: { fontSize: 14, marginBottom: 12, textAlign: 'center' },
  explanation: { fontSize: 15, lineHeight: 24, marginBottom: 16 },
  conceptsSection: { marginBottom: 16 },
  conceptsTitle: { fontSize: 16, fontWeight: '700', marginBottom: 8 },
  concept: { fontSize: 14, lineHeight: 22, marginLeft: 8 },
  followUp: { padding: 16, marginTop: 8 },
  followUpLabel: { fontSize: 14, fontWeight: '700', marginBottom: 4 },
  followUpText: { fontSize: 15, lineHeight: 22 },
});
