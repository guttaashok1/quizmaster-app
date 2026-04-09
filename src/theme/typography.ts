import { TextStyle } from 'react-native';

export const typography = {
  h1: {
    fontSize: 32,
    fontWeight: '800' as TextStyle['fontWeight'],
    lineHeight: 40,
  },
  h2: {
    fontSize: 24,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 32,
  },
  h3: {
    fontSize: 20,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 28,
  },
  body: {
    fontSize: 16,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  bodyBold: {
    fontSize: 16,
    fontWeight: '600' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  caption: {
    fontSize: 14,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 20,
  },
  small: {
    fontSize: 12,
    fontWeight: '400' as TextStyle['fontWeight'],
    lineHeight: 16,
  },
  button: {
    fontSize: 16,
    fontWeight: '700' as TextStyle['fontWeight'],
    lineHeight: 24,
  },
  score: {
    fontSize: 48,
    fontWeight: '800' as TextStyle['fontWeight'],
    lineHeight: 56,
  },
};
