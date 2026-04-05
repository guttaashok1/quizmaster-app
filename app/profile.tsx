import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
  Modal,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeContext';
import { Card } from '../src/components/ui/Card';
import { Button } from '../src/components/ui/Button';
import { ProgressBar } from '../src/components/ui/ProgressBar';
import { useUserStore, ACHIEVEMENT_DEFS } from '../src/stores/useUserStore';
import { useSettingsStore } from '../src/stores/useSettingsStore';
import { getNextUnlockThreshold } from '../src/utils/difficulty';
import { UNLOCK_MEDIUM_THRESHOLD, UNLOCK_HARD_THRESHOLD, STREAK_FREEZE_COST, MAX_STREAK_FREEZES } from '../src/constants/game';
import { AVATAR_OPTIONS } from '../src/types/user';
import { haptics } from '../src/services/hapticService';

export default function ProfileScreen() {
  const router = useRouter();
  const { colors, spacing, borderRadius } = useTheme();
  const user = useUserStore();
  const settings = useSettingsStore();
  const [editingName, setEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user.username);
  const [showAvatarPicker, setShowAvatarPicker] = useState(false);

  const accuracy = user.totalAnswers > 0 ? Math.round((user.correctAnswers / user.totalAnswers) * 100) : 0;

  const nextUnlock = getNextUnlockThreshold(user.totalScore);
  const progressToNext = nextUnlock
    ? nextUnlock.difficulty === 'medium'
      ? user.totalScore / UNLOCK_MEDIUM_THRESHOLD
      : (user.totalScore - UNLOCK_MEDIUM_THRESHOLD) / (UNLOCK_HARD_THRESHOLD - UNLOCK_MEDIUM_THRESHOLD)
    : 1;

  const stats = [
    { icon: '\uD83C\uDFAE', label: 'Games Played', value: user.gamesPlayed },
    { icon: '\u2705', label: 'Correct Answers', value: user.correctAnswers },
    { icon: '\uD83C\uDFAF', label: 'Accuracy', value: `${accuracy}%` },
    { icon: '\uD83D\uDD25', label: 'Current Streak', value: `${user.currentStreak} days` },
    { icon: '\uD83C\uDFC6', label: 'Best Streak', value: `${user.longestStreak} days` },
    { icon: '\u2B50', label: 'Total Score', value: user.totalScore.toLocaleString() },
  ];

  const handleBuyFreeze = () => {
    if (user.streakFreezes >= MAX_STREAK_FREEZES) {
      Alert.alert('Max Reached', `You can hold at most ${MAX_STREAK_FREEZES} streak freezes.`);
      return;
    }
    if (user.totalScore < STREAK_FREEZE_COST) {
      Alert.alert('Not Enough Points', `You need ${STREAK_FREEZE_COST} points to buy a streak freeze.`);
      return;
    }
    const success = user.buyStreakFreeze();
    if (success) {
      haptics.success();
      Alert.alert('Purchased!', 'Streak freeze added. It will auto-activate if you miss a day.');
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>{'\u2190'} Back</Text>
        </TouchableOpacity>

        {/* Profile header with avatar */}
        <Animated.View entering={FadeInDown.duration(400)} style={styles.profileHeader}>
          <TouchableOpacity onPress={() => setShowAvatarPicker(true)}>
            <View style={[styles.avatar, { backgroundColor: colors.primaryLight + '40', borderRadius: borderRadius.full }]}>
              <Text style={styles.avatarEmoji}>{user.avatarEmoji}</Text>
            </View>
            <Text style={[styles.changeAvatar, { color: colors.primary }]}>Change</Text>
          </TouchableOpacity>

          {editingName ? (
            <TextInput
              value={nameInput}
              onChangeText={setNameInput}
              style={[styles.nameInput, { color: colors.text, borderColor: colors.primary, borderRadius: borderRadius.sm }]}
              autoFocus
              onSubmitEditing={() => { if (nameInput.trim()) user.setUsername(nameInput.trim()); setEditingName(false); }}
            />
          ) : (
            <TouchableOpacity onPress={() => setEditingName(true)}>
              <Text style={[styles.username, { color: colors.text }]}>{user.username} {'\u270F\uFE0F'}</Text>
            </TouchableOpacity>
          )}

          {/* XP Level */}
          <View style={styles.xpRow}>
            <Text style={[styles.levelBadge, { color: colors.xp }]}>Level {user.xpLevel}</Text>
            <View style={{ flex: 1, marginLeft: 12 }}>
              <ProgressBar progress={user.xpCurrent / user.xpToNextLevel} height={6} />
              <Text style={[styles.xpSubtext, { color: colors.textMuted }]}>
                {user.xpCurrent}/{user.xpToNextLevel} XP
              </Text>
            </View>
          </View>
        </Animated.View>

        {/* Streak Freeze Shop */}
        <Animated.View entering={FadeInDown.duration(400).delay(150)}>
          <Card elevated style={{ marginBottom: spacing.lg }}>
            <View style={styles.freezeRow}>
              <View>
                <Text style={[styles.freezeTitle, { color: colors.text }]}>{'\u2744\uFE0F'} Streak Freeze</Text>
                <Text style={[styles.freezeSub, { color: colors.textMuted }]}>
                  {user.streakFreezes}/{MAX_STREAK_FREEZES} owned | Cost: {STREAK_FREEZE_COST} pts
                </Text>
              </View>
              <Button title="Buy" onPress={handleBuyFreeze} variant="primary" size="sm" />
            </View>
          </Card>
        </Animated.View>

        {/* Difficulty progress */}
        {nextUnlock && (
          <Animated.View entering={FadeInDown.duration(400).delay(200)}>
            <Card elevated style={{ marginBottom: spacing.lg }}>
              <Text style={[styles.progressLabel, { color: colors.textSecondary }]}>Progress to {nextUnlock.difficulty}</Text>
              <ProgressBar progress={Math.min(1, progressToNext)} height={8} />
              <Text style={[styles.progressHint, { color: colors.textMuted }]}>{nextUnlock.pointsNeeded} points to go</Text>
            </Card>
          </Animated.View>
        )}

        {/* Achievements */}
        <Animated.View entering={FadeInDown.duration(400).delay(300)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Achievements</Text>
          <View style={styles.achievementsGrid}>
            {ACHIEVEMENT_DEFS.map((def) => {
              const unlocked = user.achievements.some((a) => a.id === def.id);
              return (
                <View
                  key={def.id}
                  style={[
                    styles.achievementItem,
                    {
                      backgroundColor: unlocked ? colors.star + '20' : colors.surface,
                      borderColor: unlocked ? colors.star : colors.border,
                      borderRadius: borderRadius.md,
                      opacity: unlocked ? 1 : 0.4,
                    },
                  ]}
                >
                  <Text style={styles.achievementIcon}>{def.icon}</Text>
                  <Text style={[styles.achievementName, { color: colors.text }]} numberOfLines={1}>{def.title}</Text>
                  <Text style={[styles.achievementDesc, { color: colors.textMuted }]} numberOfLines={2}>{def.description}</Text>
                </View>
              );
            })}
          </View>
        </Animated.View>

        {/* Stats */}
        <Animated.View entering={FadeInDown.duration(400).delay(400)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Statistics</Text>
          <View style={styles.statsGrid}>
            {stats.map((s, i) => (
              <Card key={i} style={styles.statCard}>
                <Text style={styles.statIcon}>{s.icon}</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{s.value}</Text>
                <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{s.label}</Text>
              </Card>
            ))}
          </View>
        </Animated.View>

        {/* Settings */}
        <Animated.View entering={FadeInDown.duration(400).delay(500)}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>Settings</Text>
          <Card>
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Dark Mode</Text>
              <Switch value={settings.themeMode === 'dark'} onValueChange={(v) => settings.setThemeMode(v ? 'dark' : 'light')} trackColor={{ true: colors.primary }} />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Haptic Feedback</Text>
              <Switch value={settings.hapticsEnabled} onValueChange={settings.setHapticsEnabled} trackColor={{ true: colors.primary }} />
            </View>
            <View style={[styles.divider, { backgroundColor: colors.divider }]} />
            <View style={styles.settingRow}>
              <Text style={[styles.settingLabel, { color: colors.text }]}>Sound Effects</Text>
              <Switch value={settings.soundEnabled} onValueChange={settings.setSoundEnabled} trackColor={{ true: colors.primary }} />
            </View>
          </Card>
        </Animated.View>
      </ScrollView>

      {/* Avatar picker modal */}
      <Modal visible={showAvatarPicker} transparent animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={[styles.avatarModal, { backgroundColor: colors.surface, borderRadius: borderRadius.xl }]}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>Choose Avatar</Text>
            <View style={styles.avatarGrid}>
              {AVATAR_OPTIONS.map((emoji) => (
                <TouchableOpacity
                  key={emoji}
                  onPress={() => { user.setAvatar(emoji); haptics.selection(); setShowAvatarPicker(false); }}
                  style={[
                    styles.avatarOption,
                    {
                      backgroundColor: user.avatarEmoji === emoji ? colors.primary + '30' : 'transparent',
                      borderColor: user.avatarEmoji === emoji ? colors.primary : 'transparent',
                      borderRadius: borderRadius.md,
                    },
                  ]}
                >
                  <Text style={styles.avatarOptionEmoji}>{emoji}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Button title="Close" onPress={() => setShowAvatarPicker(false)} variant="ghost" size="md" />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { padding: 24, paddingBottom: 48 },
  backText: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  profileHeader: { alignItems: 'center', marginBottom: 24 },
  avatar: { width: 80, height: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  avatarEmoji: { fontSize: 40 },
  changeAvatar: { fontSize: 12, fontWeight: '600', textAlign: 'center', marginBottom: 8 },
  username: { fontSize: 24, fontWeight: '800', marginBottom: 12 },
  nameInput: { fontSize: 20, fontWeight: '700', borderWidth: 2, paddingHorizontal: 12, paddingVertical: 6, minWidth: 150, textAlign: 'center', marginBottom: 12 },
  xpRow: { flexDirection: 'row', alignItems: 'center', width: '100%', paddingHorizontal: 16 },
  levelBadge: { fontSize: 16, fontWeight: '800' },
  xpSubtext: { fontSize: 11, marginTop: 2 },
  freezeRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  freezeTitle: { fontSize: 16, fontWeight: '700' },
  freezeSub: { fontSize: 12, marginTop: 2 },
  progressLabel: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  progressHint: { fontSize: 12, marginTop: 4 },
  sectionTitle: { fontSize: 20, fontWeight: '700', marginBottom: 16 },
  achievementsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 32 },
  achievementItem: { width: '31%', padding: 10, borderWidth: 1, alignItems: 'center' },
  achievementIcon: { fontSize: 24, marginBottom: 4 },
  achievementName: { fontSize: 11, fontWeight: '700', textAlign: 'center' },
  achievementDesc: { fontSize: 9, textAlign: 'center', marginTop: 2 },
  statsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 32 },
  statCard: { width: '47%', alignItems: 'center', paddingVertical: 16 },
  statIcon: { fontSize: 24, marginBottom: 8 },
  statValue: { fontSize: 20, fontWeight: '800', marginBottom: 4 },
  statLabel: { fontSize: 12, fontWeight: '500', textAlign: 'center' },
  settingRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12 },
  settingLabel: { fontSize: 16, fontWeight: '500' },
  divider: { height: 1 },
  modalOverlay: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: 'rgba(0,0,0,0.5)' },
  avatarModal: { padding: 24, width: '85%' },
  modalTitle: { fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  avatarGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8, marginBottom: 16 },
  avatarOption: { padding: 8, borderWidth: 2 },
  avatarOptionEmoji: { fontSize: 32 },
});
