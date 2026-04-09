import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useSettingsStore } from '../stores/useSettingsStore';

function isEnabled(): boolean {
  return Platform.OS !== 'web' && useSettingsStore.getState().hapticsEnabled;
}

export const haptics = {
  light: () => {
    if (isEnabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  },
  medium: () => {
    if (isEnabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  },
  heavy: () => {
    if (isEnabled()) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  },
  success: () => {
    if (isEnabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  },
  error: () => {
    if (isEnabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
  },
  warning: () => {
    if (isEnabled()) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  },
  selection: () => {
    if (isEnabled()) Haptics.selectionAsync();
  },
};
