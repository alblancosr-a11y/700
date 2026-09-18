import type { AppState, AppSettings, PoemStats, VerseStats } from './types';

const STORAGE_KEY = 'diwan_hafiz_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  fontSize: 2,
  requireTashkeel: false,
  showVerseNumbers: true,
  speechRate: 0.85,
  speechPitch: 1.0,
};

function defaultVerseStats(verseIndex: number): VerseStats {
  return {
    verseIndex,
    attempts: 0,
    correct: 0,
    errors: 0,
    lastReviewed: null,
    memory: {
      standalone: 'new',
      contextual: 'new',
      transition: 'new',
      positional: 'new',
    },
    easeFactor: 2.5,
    interval: 1,
    repetitions: 0,
    nextReviewAt: Date.now(),
    sessionCorrect: 0,
    sessionErrors: 0,
    exerciseHistory: {},
  };
}

export function defaultPoemStats(poemId: string): PoemStats {
  return {
    poemId,
    verses: {},
    totalSessions: 0,
    totalCorrect: 0,
    totalErrors: 0,
    lastSession: null,
  };
}

function getDefaultState(): AppState {
  return {
    poems: [],
    stats: {},
    settings: DEFAULT_SETTINGS,
    activeSessionPoemId: null,
  };
}

export function loadState(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return getDefaultState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      ...getDefaultState(),
      ...parsed,
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) },
    };
  } catch {
    return getDefaultState();
  }
}

export function saveState(state: AppState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save state', e);
  }
}

export { defaultVerseStats };
