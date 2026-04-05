export const lightColors = {
  primary: '#6C63FF',
  primaryLight: '#8B85FF',
  primaryDark: '#4A42E0',
  secondary: '#FF6584',
  secondaryLight: '#FF8FA3',
  accent: '#00D4AA',
  accentLight: '#33DDBB',

  background: '#F8F9FE',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',

  text: '#1A1A2E',
  textSecondary: '#6B7280',
  textMuted: '#9CA3AF',
  textOnPrimary: '#FFFFFF',

  correct: '#10B981',
  correctLight: '#D1FAE5',
  wrong: '#EF4444',
  wrongLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',

  border: '#E5E7EB',
  divider: '#F3F4F6',
  overlay: 'rgba(0, 0, 0, 0.5)',

  heart: '#EF4444',
  star: '#F59E0B',
  streak: '#FF6B35',
  xp: '#6C63FF',
};

export const darkColors: typeof lightColors = {
  primary: '#8B85FF',
  primaryLight: '#A5A0FF',
  primaryDark: '#6C63FF',
  secondary: '#FF8FA3',
  secondaryLight: '#FFB3C1',
  accent: '#33DDBB',
  accentLight: '#66E6CC',

  background: '#0F0F23',
  surface: '#1A1A2E',
  surfaceElevated: '#252540',
  card: '#1A1A2E',

  text: '#F8F9FE',
  textSecondary: '#9CA3AF',
  textMuted: '#6B7280',
  textOnPrimary: '#FFFFFF',

  correct: '#34D399',
  correctLight: '#064E3B',
  wrong: '#F87171',
  wrongLight: '#7F1D1D',
  warning: '#FBBF24',
  warningLight: '#78350F',

  border: '#374151',
  divider: '#1F2937',
  overlay: 'rgba(0, 0, 0, 0.7)',

  heart: '#F87171',
  star: '#FBBF24',
  streak: '#FF8C5A',
  xp: '#8B85FF',
};

export type Colors = typeof lightColors;
