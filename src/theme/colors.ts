export const lightColors = {
  // Duolingo-style palette
  primary: '#58CC02',        // Duolingo green
  primaryLight: '#89E219',
  primaryDark: '#58A700',    // Darker shade for button bottom border
  secondary: '#CE82FF',      // purple
  secondaryLight: '#E5B5FF',
  accent: '#1CB0F6',         // bright blue
  accentLight: '#84D8F7',

  background: '#FFFFFF',
  surface: '#FFFFFF',
  surfaceElevated: '#FFFFFF',
  card: '#FFFFFF',

  text: '#3C3C3C',           // Duolingo dark gray
  textSecondary: '#777777',
  textMuted: '#AFAFAF',
  textOnPrimary: '#FFFFFF',

  correct: '#58CC02',
  correctLight: '#D7FFB8',
  wrong: '#FF4B4B',
  wrongLight: '#FFDFE0',
  warning: '#FFC800',        // Duolingo gold
  warningLight: '#FFF4C2',

  border: '#E5E5E5',         // Neutral border for cards
  divider: '#E5E5E5',
  overlay: 'rgba(0, 0, 0, 0.5)',

  heart: '#FF4B4B',
  star: '#FFC800',
  streak: '#FF9600',         // Duolingo orange
  xp: '#58CC02',

  // Brutalist shadow colors (solid dark colors for offset shadows)
  shadowPrimary: '#58A700',   // darker green
  shadowSecondary: '#A560E2', // darker purple
  shadowAccent: '#0E87C7',    // darker blue
  shadowWarning: '#E5B100',   // darker gold
  shadowWrong: '#E74040',     // darker red
  shadowBorder: '#3C3C3C',    // dark gray for neutral shadows

  // Keep gradient arrays for compatibility (but prefer solid colors)
  gradientPrimary: ['#58CC02', '#58A700'],
  gradientSecondary: ['#CE82FF', '#A560E2'],
  gradientAccent: ['#1CB0F6', '#0E87C7'],
  gradientHero: ['#58CC02', '#58A700'],
  gradientCard: ['#FFFFFF', '#F7F7F7'],
};

export const darkColors: typeof lightColors = {
  primary: '#58CC02',
  primaryLight: '#89E219',
  primaryDark: '#3F8E00',
  secondary: '#CE82FF',
  secondaryLight: '#E5B5FF',
  accent: '#1CB0F6',
  accentLight: '#84D8F7',

  background: '#131F24',      // Duolingo dark mode background
  surface: '#1F2C33',
  surfaceElevated: '#2B3A42',
  card: '#1F2C33',

  text: '#F7F7F7',
  textSecondary: '#AFAFAF',
  textMuted: '#6D7276',
  textOnPrimary: '#FFFFFF',

  correct: '#58CC02',
  correctLight: '#1F4220',
  wrong: '#FF4B4B',
  wrongLight: '#4D1919',
  warning: '#FFC800',
  warningLight: '#4D3F00',

  border: '#37464F',
  divider: '#37464F',
  overlay: 'rgba(0, 0, 0, 0.7)',

  heart: '#FF4B4B',
  star: '#FFC800',
  streak: '#FF9600',
  xp: '#58CC02',

  shadowPrimary: '#3F8E00',
  shadowSecondary: '#A560E2',
  shadowAccent: '#0E87C7',
  shadowWarning: '#E5B100',
  shadowWrong: '#E74040',
  shadowBorder: '#000000',

  gradientPrimary: ['#58CC02', '#3F8E00'],
  gradientSecondary: ['#CE82FF', '#A560E2'],
  gradientAccent: ['#1CB0F6', '#0E87C7'],
  gradientHero: ['#1F2C33', '#131F24'],
  gradientCard: ['#1F2C33', '#131F24'],
};

export type Colors = typeof lightColors;
