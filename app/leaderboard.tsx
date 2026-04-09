import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  SafeAreaView,
  FlatList,
  TouchableOpacity,
} from 'react-native';
import { useRouter } from 'expo-router';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { useTheme } from '../src/theme/ThemeContext';
import { Card } from '../src/components/ui/Card';
import { useLeaderboardStore } from '../src/stores/useLeaderboardStore';
import { useUserStore } from '../src/stores/useUserStore';

const MEDALS = ['\uD83E\uDD47', '\uD83E\uDD48', '\uD83E\uDD49'];

export default function LeaderboardScreen() {
  const router = useRouter();
  const { colors, spacing, borderRadius } = useTheme();
  const entries = useLeaderboardStore((s) => s.entries);
  const username = useUserStore((s) => s.username);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backText, { color: colors.primary }]}>
            {'\u2190'} Back
          </Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: colors.text }]}>
          {'\uD83C\uDFC6'} Leaderboard
        </Text>
      </View>

      {entries.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyIcon}>{'\uD83C\uDFC5'}</Text>
          <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
            No scores yet. Play a quiz to get on the board!
          </Text>
        </View>
      ) : (
        <FlatList
          data={entries.slice(0, 50)}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ padding: spacing.md }}
          renderItem={({ item, index }) => {
            const isCurrentUser = item.username === username;
            return (
              <Animated.View entering={FadeInDown.duration(300).delay(index * 50)}>
                <Card
                  elevated={isCurrentUser}
                  style={[
                    styles.entry,
                    isCurrentUser && {
                      borderColor: colors.primary,
                      borderWidth: 2,
                    },
                  ]}
                >
                  <Text style={[styles.rank, { color: colors.textSecondary }]}>
                    {index < 3 ? MEDALS[index] : `#${index + 1}`}
                  </Text>
                  <View style={styles.entryInfo}>
                    <Text style={[styles.entryName, { color: colors.text }]}>
                      {item.username}
                      {isCurrentUser ? ' (You)' : ''}
                    </Text>
                    <Text
                      style={[
                        styles.entryMeta,
                        { color: colors.textMuted },
                      ]}
                    >
                      {item.gamesPlayed} games | {'\uD83D\uDD25'} {item.streak} streak
                    </Text>
                  </View>
                  <Text style={[styles.entryScore, { color: colors.xp }]}>
                    {item.score.toLocaleString()}
                  </Text>
                </Card>
              </Animated.View>
            );
          }}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    padding: 24,
    paddingBottom: 16,
  },
  backText: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
  },
  empty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 16,
    textAlign: 'center',
    lineHeight: 24,
  },
  entry: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    paddingVertical: 14,
  },
  rank: {
    fontSize: 20,
    fontWeight: '800',
    width: 44,
    textAlign: 'center',
  },
  entryInfo: {
    flex: 1,
  },
  entryName: {
    fontSize: 16,
    fontWeight: '600',
  },
  entryMeta: {
    fontSize: 12,
    marginTop: 2,
  },
  entryScore: {
    fontSize: 18,
    fontWeight: '800',
  },
});
