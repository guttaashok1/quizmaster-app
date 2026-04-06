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

  // On web: detect if we're on the deployed site or localhost
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const hostname = window.location.hostname;
    if (hostname.includes('onrender.com')) {
      // Deployed on Render — use the production API
      return 'https://quizmaster-api-2os8.onrender.com/api';
    }
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

  async getPublicChallenges(): Promise<any[]> {
    return this.request('/challenge/public');
  }

  async getMyChallenges(username: string): Promise<any[]> {
    return this.request(`/challenge/mine/${encodeURIComponent(username)}`);
  }

  async createChallenge(data: { topic: string; difficulty: string; questions: any[]; creatorName: string; creatorScore: number; visibility?: string }): Promise<{ id: string }> {
    return this.request('/challenge', { method: 'POST', body: JSON.stringify(data) });
  }

  async getChallenge(id: string): Promise<any> {
    return this.request(`/challenge/${id}`);
  }

  async submitChallengeResult(id: string, data: { name: string; score: number }): Promise<any> {
    return this.request(`/challenge/${id}/result`, { method: 'POST', body: JSON.stringify(data) });
  }

  async joinChallenge(id: string, data: { name: string }): Promise<any> {
    return this.request(`/challenge/${id}/join`, { method: 'POST', body: JSON.stringify(data) });
  }

  async startChallenge(id: string): Promise<any> {
    return this.request(`/challenge/${id}/start`, { method: 'POST' });
  }

  async getChallengeStatus(id: string): Promise<{ status: string; participants: string[] }> {
    return this.request(`/challenge/${id}/status`);
  }

  async register(data: { username: string; password: string; avatarEmoji: string }): Promise<any> {
    return this.request('/auth/register', { method: 'POST', body: JSON.stringify(data) });
  }

  async login(data: { username: string; password: string }): Promise<any> {
    return this.request('/auth/login', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateScore(data: { username: string; score: number }): Promise<any> {
    return this.request('/auth/score', { method: 'POST', body: JSON.stringify(data) });
  }

  async healthCheck(): Promise<{ status: string }> {
    return this.request('/health');
  }
}

export const apiClient = new ApiClient(API_BASE_URL);
