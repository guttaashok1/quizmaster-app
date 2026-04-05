import {
  GenerateQuizRequest,
  GenerateQuizResponse,
  AskTutorRequest,
  AskTutorResponse,
  ApiError,
} from '../types/api';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

function getApiBaseUrl(): string {
  // Allow explicit override via env var
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }

  // On web, localhost works fine
  if (Platform.OS === 'web') {
    return 'http://localhost:3001/api';
  }

  // On mobile (Expo Go), extract the dev server IP from the manifest
  const debuggerHost =
    Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoGo?.debuggerHost;
  if (debuggerHost) {
    const ip = debuggerHost.split(':')[0];
    return `http://${ip}:3001/api`;
  }

  // Fallback
  return 'http://localhost:3001/api';
}

const API_BASE_URL = getApiBaseUrl();

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private async request<T>(path: string, options: RequestInit = {}): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers },
    });

    if (!response.ok) {
      const error: ApiError = await response.json().catch(() => ({
        message: 'Network error',
        code: 'NETWORK_ERROR',
      }));
      throw new Error(error.message);
    }

    return response.json();
  }

  async generateQuiz(params: GenerateQuizRequest): Promise<GenerateQuizResponse> {
    return this.request<GenerateQuizResponse>('/quiz/generate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async askTutor(params: AskTutorRequest): Promise<AskTutorResponse> {
    return this.request<AskTutorResponse>('/quiz/tutor', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
