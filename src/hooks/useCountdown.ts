import { useEffect, useRef, useCallback } from 'react';
import { useQuizStore } from '../stores/useQuizStore';

export function useCountdown() {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const tickTimer = useQuizStore((s) => s.tickTimer);
  const status = useQuizStore((s) => s.status);
  const showExplanation = useQuizStore((s) => s.showExplanation);

  const start = useCallback(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      tickTimer();
    }, 1000);
  }, [tickTimer]);

  const stop = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    if (status === 'playing' && !showExplanation) {
      start();
    } else {
      stop();
    }
    return stop;
  }, [status, showExplanation, start, stop]);

  return { start, stop };
}
