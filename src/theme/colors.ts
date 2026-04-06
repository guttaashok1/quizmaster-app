export const lightColors = {
  primary: '#7C3AED',        // vibrant purple
  primaryLight: '#A78BFA',
  primaryDark: '#5B21B6',
  secondary: '#F43F5E',      // rose/pink
  secondaryLight: '#FB7185',
  accent: '#06D6A0',         // emerald green
  accentLight: '#34D399',

  background: '#F5F3FF',     // light purple tint
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',

  text: '#1E1B4B',           // deep indigo
  textSecondary: '#6366F1',  // indigo for secondary text
  textMuted: '#9CA3AF',
  textOnPrimary: '#FFFFFF',

  correct: '#10B981',
  correctLight: '#D1FAE5',
  wrong: '#EF4444',
  wrongLight: '#FEE2E2',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',

  border: '#E0E7FF',         // light indigo border
  divider: '#EEF2FF',
  overlay: 'rgba(0, 0, 0, 0.5)',

  heart: '#EF4444',
  star: '#FBBF24',
  streak: '#F97316',
  xp: '#7C3AED',

  // Gradient arrays for LinearGradient
  gradientPrimary: ['#7C3AED', '#5B21B6'],
  gradientSecondary: ['#F43F5E', '#E11D48'],
  gradientAccent: ['#06D6A0', '#059669'],
  gradientHero: ['#7C3AED', '#4338CA', '#312E81'],
  gradientCard: ['#F5F3FF', '#EDE9FE'],
};

export const darkColors: typeof lightColors = {
  primary: '#A78BFA',
  primaryLight: '#C4B5FD',
  primaryDark: '#7C3AED',
  secondary: '#FB7185',
  secondaryLight: '#FDA4AF',
  accent: '#34D399',
  accentLight: '#6EE7B7',

  background: '#0F0A1F',     // deep purple-black
  surface: '#1A1533',
  surfaceElevated: '#252040',
  card: '#1A1533',

  text: '#F5F3FF',
  textSecondary: '#A5B4FC',
  textMuted: '#6B7280',
  textOnPrimary: '#FFFFFF',

  correct: '#34D399',
  correctLight: '#064E3B',
  wrong: '#F87171',
  wrongLight: '#7F1D1D',
  warning: '#FBBF24',
  warningLight: '#78350F',

  border: '#312E81',
  divider: '#1E1B4B',
  overlay: 'rgba(0, 0, 0, 0.7)',

  heart: '#F87171',
  star: '#FBBF24',
  streak: '#FB923C',
  xp: '#A78BFA',

  gradientPrimary: ['#A78BFA', '#7C3AED'],
  gradientSecondary: ['#FB7185', '#F43F5E'],
  gradientAccent: ['#34D399', '#06D6A0'],
  gradientHero: ['#1E1B4B', '#312E81', '#3B0764'],
  gradientCard: ['#1A1533', '#252040'],
};

export type Colors = typeof lightColors;
