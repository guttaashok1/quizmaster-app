export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

export function isYesterday(dateStr: string): boolean {
  const date = new Date(dateStr);
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return date.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0];
}

export function isToday(dateStr: string): boolean {
  return dateStr === getToday();
}

export function calculateStreak(
  lastPlayedDate: string | null,
  currentStreak: number
): { newStreak: number; streakBroken: boolean } {
  if (!lastPlayedDate) {
    return { newStreak: 1, streakBroken: false };
  }

  if (isToday(lastPlayedDate)) {
    return { newStreak: currentStreak, streakBroken: false };
  }

  if (isYesterday(lastPlayedDate)) {
    return { newStreak: currentStreak + 1, streakBroken: false };
  }

  return { newStreak: 1, streakBroken: currentStreak > 0 };
}
