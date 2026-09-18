import type { VerseStats, StabilityLevel, ExerciseType, AnswerQuality, SessionItem, Verse } from './types';
import { defaultVerseStats } from './storage';

const REPS_TO_PROMOTE: Record<StabilityLevel, number> = {
  new: 1, learning: 2, weak: 3, medium: 4, strong: 5, mastered: 999,
};

export function getStabilityLabel(level: StabilityLevel): string {
  const labels: Record<StabilityLevel, string> = {
    new: 'جديد', learning: 'قيد الحفظ', weak: 'ضعيف', medium: 'متوسط', strong: 'ثابت', mastered: 'متقن',
  };
  return labels[level];
}

export function getStabilityOrder(level: StabilityLevel): number {
  const order: Record<StabilityLevel, number> = {
    new: 0, learning: 1, weak: 2, medium: 3, strong: 4, mastered: 5,
  };
  return order[level];
}

function qualityToNumber(quality: AnswerQuality): number {
  switch (quality) {
    case 'mastered': return 5;
    case 'correct': return 4;
    case 'review': return 2;
    case 'wrong': return 0;
  }
}

function promoteLevel(level: StabilityLevel): StabilityLevel {
  const levels: StabilityLevel[] = ['new', 'learning', 'weak', 'medium', 'strong', 'mastered'];
  const idx = levels.indexOf(level);
  return levels[Math.min(idx + 1, levels.length - 1)];
}

function demoteLevel(level: StabilityLevel, steps: number): StabilityLevel {
  const levels: StabilityLevel[] = ['new', 'learning', 'weak', 'medium', 'strong', 'mastered'];
  const idx = levels.indexOf(level);
  return levels[Math.max(idx - steps, 0)];
}

export function applySM2(stats: VerseStats, quality: AnswerQuality): VerseStats {
  const qualityNum = qualityToNumber(quality);
  let { easeFactor, interval, repetitions } = stats;

  if (qualityNum < 3) {
    repetitions = 0;
    interval = 1;
  } else {
    if (repetitions === 0) interval = 1;
    else if (repetitions === 1) interval = 6;
    else interval = Math.round(interval * easeFactor);

    repetitions += 1;
  }

  easeFactor = easeFactor + (0.1 - (5 - qualityNum) * (0.08 + (5 - qualityNum) * 0.02));
  if (easeFactor < 1.3) easeFactor = 1.3;
  if (easeFactor > 4.0) easeFactor = 4.0;

  const nextReviewAt = Date.now() + interval * 60 * 1000;

  return {
    ...stats, easeFactor, interval, repetitions, nextReviewAt, lastReviewed: Date.now(),
  };
}

export function updateStability(stats: VerseStats, quality: AnswerQuality): StabilityLevel {
  const current = stats.memory.standalone;
  if (quality === 'mastered' || quality === 'correct') {
    const newReps = stats.repetitions + 1;
    if (newReps >= REPS_TO_PROMOTE[current]) {
      return promoteLevel(current);
    }
    return current;
  } else if (quality === 'review') {
    return demoteLevel(current, 1);
  } else {
    return demoteLevel(current, 2);
  }
}

export function getEligibleExercises(
  stability: StabilityLevel, hasAjar: boolean, verseIndex: number, totalVerses: number
): ExerciseType[] {
  const exercises: ExerciseType[] = [];
  switch (stability) {
    case 'new':
    case 'learning':
      exercises.push('complete_verse');
      if (hasAjar) { exercises.push('sadr_to_ajar'); exercises.push('fill_blank'); }
      break;
    case 'weak':
      exercises.push('complete_verse'); exercises.push('fill_blank');
      if (hasAjar) { exercises.push('sadr_to_ajar'); exercises.push('ajar_to_sadr'); exercises.push('fill_blanks'); }
      break;
    case 'medium':
      exercises.push('fill_blank'); exercises.push('fill_blanks');
      if (hasAjar) { exercises.push('sadr_to_ajar'); exercises.push('ajar_to_sadr'); }
      exercises.push('word_order');
      if (verseIndex > 0) exercises.push('prev_verse');
      if (verseIndex < totalVerses - 1) exercises.push('next_verse');
      break;
    case 'strong':
      exercises.push('fill_blanks'); exercises.push('word_order'); exercises.push('write_all');
      if (hasAjar) { exercises.push('sadr_to_ajar'); exercises.push('ajar_to_sadr'); }
      if (verseIndex > 0) exercises.push('prev_verse');
      if (verseIndex < totalVerses - 1) exercises.push('next_verse');
      break;
    case 'mastered':
      exercises.push('write_all'); exercises.push('word_order'); exercises.push('fill_blanks');
      if (hasAjar) { exercises.push('sadr_to_ajar'); exercises.push('ajar_to_sadr'); }
      if (verseIndex > 0) exercises.push('prev_verse');
      if (verseIndex < totalVerses - 1) exercises.push('next_verse');
      break;
  }
  return exercises;
}

function selectExerciseType(
  stats: VerseStats, verses: Verse[], verseIndex: number
): ExerciseType {
  const verse = verses[verseIndex];
  const hasAjar = Boolean(verse?.ajar?.trim());
  const totalVerses = verses.length;
  const stability = stats.memory.standalone;
  const eligible = getEligibleExercises(stability, hasAjar, verseIndex, totalVerses);

  const weights = eligible.map(type => {
    const history = stats.exerciseHistory[type];
    if (!history) return 1;
    const errorRate = history.errors / Math.max(history.correct + history.errors, 1);
    return 1 + errorRate * 2;
  });

  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let rand = Math.random() * totalWeight;
  for (let i = 0; i < eligible.length; i++) {
    rand -= weights[i];
    if (rand <= 0) return eligible[i];
  }
  return eligible[eligible.length - 1];
}

export function buildSessionQueue(
  verses: Verse[], statsMap: Record<number, VerseStats>, maxVerseReached: number, newVerseIndex: number | null
): SessionItem[] {
  const queue: SessionItem[] = [];
  const now = Date.now();

  if (newVerseIndex !== null && newVerseIndex <= maxVerseReached + 1) {
    queue.push({ verseIndex: newVerseIndex, exerciseType: 'complete_verse', priority: 2, attempts: 0 });
  }

  const dueVerses: Array<{ index: number; stats: VerseStats; overdue: number }> = [];
  for (let i = 0; i <= maxVerseReached; i++) {
    const stats = statsMap[i] || defaultVerseStats(i);
    const overdue = (now - stats.nextReviewAt) / 60000;
    if (overdue >= 0 || stats.memory.standalone === 'new') {
      if (i === newVerseIndex) continue;
      dueVerses.push({ index: i, stats, overdue: Math.max(overdue, 0) });
    }
  }

  dueVerses.sort((a, b) => {
    const aScore = a.stats.memory.standalone === 'new' ? 100 : a.overdue + (a.stats.errors - a.stats.correct) * 0.1;
    const bScore = b.stats.memory.standalone === 'new' ? 100 : b.overdue + (b.stats.errors - b.stats.correct) * 0.1;
    return bScore - aScore;
  });

  const sessionVerses = dueVerses.slice(0, 14);
  for (const { index, stats } of sessionVerses) {
    const exerciseType = selectExerciseType(stats, verses, index);
    queue.push({
      verseIndex: index, exerciseType,
      priority: stats.memory.standalone === 'new' ? 2 : 1, attempts: 0,
    });
  }

  if (maxVerseReached >= 4) {
    const chainVerses = selectChainVerses(verses, statsMap, maxVerseReached);
    for (const idx of chainVerses) {
      if (!queue.find(q => q.verseIndex === idx)) {
        queue.push({ verseIndex: idx, exerciseType: 'next_verse', priority: 0, attempts: 0 });
      }
    }
  }

  return queue;
}

function selectChainVerses(verses: Verse[], _statsMap: Record<number, VerseStats>, maxVerse: number): number[] {
  const count = Math.min(maxVerse + 1, verses.length);
  if (count < 2) return [];
  const selected: number[] = [];
  selected.push(0);
  if (maxVerse > 0) selected.push(maxVerse);
  const mid = Math.floor(maxVerse / 2);
  if (!selected.includes(mid)) selected.push(mid);
  const rand = Math.floor(Math.random() * (maxVerse + 1));
  if (!selected.includes(rand)) selected.push(rand);
  return selected.sort((a, b) => a - b);
}

export function buildChainQueue(
  verses: Verse[], statsMap: Record<number, VerseStats>, maxVerseReached: number
): SessionItem[] {
  const queue: SessionItem[] = [];
  const exerciseTypes: ExerciseType[] = ['complete_verse', 'sadr_to_ajar', 'fill_blank', 'next_verse', 'write_all'];
  for (let i = 0; i <= Math.min(maxVerseReached, verses.length - 1); i++) {
    const typeIdx = i % exerciseTypes.length;
    queue.push({ verseIndex: i, exerciseType: exerciseTypes[typeIdx], priority: 1, attempts: 0 });
  }
  return queue;
}

export function buildReviewQueue(
  verses: Verse[], statsMap: Record<number, VerseStats>, maxVerseReached: number
): SessionItem[] {
  const queue: SessionItem[] = [];
  const candidates = Array.from({ length: Math.min(maxVerseReached + 1, verses.length) }, (_, i) => i)
    .filter(i => { const stats = statsMap[i]; return stats && stats.memory.standalone !== 'new'; });

  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }

  const selected = candidates.slice(0, 8);
  for (const idx of selected) {
    if (idx > 0) queue.push({ verseIndex: idx, exerciseType: 'prev_verse', priority: 1, attempts: 0 });
    if (idx < verses.length - 1) queue.push({ verseIndex: idx, exerciseType: 'next_verse', priority: 1, attempts: 0 });
  }
  return queue;
}

export function buildWhereAmIQueue(
  verses: Verse[], statsMap: Record<number, VerseStats>, maxVerseReached: number
): SessionItem[] {
  const queue: SessionItem[] = [];
  const now = Date.now();
  for (let i = 0; i <= Math.min(maxVerseReached, verses.length - 1); i++) {
    const stats = statsMap[i] || defaultVerseStats(i);
    if (now >= stats.nextReviewAt || stats.memory.standalone === 'new') {
      queue.push({ verseIndex: i, exerciseType: 'where_am_i', priority: 1, attempts: 0 });
    }
  }
  if (queue.length === 0) {
    const sorted = Object.values(statsMap)
      .filter(s => s.verseIndex <= maxVerseReached)
      .sort((a, b) => (a.lastReviewed || 0) - (b.lastReviewed || 0))
      .slice(0, 5);
    for (const stats of sorted) {
      queue.push({ verseIndex: stats.verseIndex, exerciseType: selectExerciseType(stats, verses, stats.verseIndex), priority: 0, attempts: 0 });
    }
  }
  return queue;
}

export function updateVerseStatsAfterAnswer(
  stats: VerseStats, quality: AnswerQuality, exerciseType: ExerciseType
): VerseStats {
  const isCorrect = quality === 'mastered' || quality === 'correct';
  const newStats = applySM2(stats, quality);
  const newStability = updateStability(stats, quality);

  const exHistory = { ...stats.exerciseHistory };
  const prev = exHistory[exerciseType] || { correct: 0, errors: 0 };
  exHistory[exerciseType] = { correct: prev.correct + (isCorrect ? 1 : 0), errors: prev.errors + (isCorrect ? 0 : 1) };

  const memory = { ...stats.memory };
  if (exerciseType === 'next_verse' || exerciseType === 'continue_from') {
    memory.transition = isCorrect ? promoteLevel(memory.transition) : demoteLevel(memory.transition, 1);
  }
  if (exerciseType === 'prev_verse' || exerciseType === 'where_am_i') {
    memory.positional = isCorrect ? promoteLevel(memory.positional) : demoteLevel(memory.positional, 1);
  }
  if (exerciseType === 'sadr_to_ajar' || exerciseType === 'ajar_to_sadr') {
    memory.contextual = isCorrect ? promoteLevel(memory.contextual) : demoteLevel(memory.contextual, 1);
  }
  memory.standalone = newStability;

  return {
    ...newStats,
    attempts: stats.attempts + 1,
    correct: stats.correct + (isCorrect ? 1 : 0),
    errors: stats.errors + (isCorrect ? 0 : 1),
    sessionCorrect: stats.sessionCorrect + (isCorrect ? 1 : 0),
    sessionErrors: stats.sessionErrors + (isCorrect ? 0 : 1),
    exerciseHistory: exHistory,
    memory,
  };
}

export function requeueError(
  queue: SessionItem[], item: SessionItem, verses: Verse[], _stats: VerseStats
): SessionItem[] {
  const verse = verses[item.verseIndex];
  const hasAjar = Boolean(verse?.ajar?.trim());
  const currentType = item.exerciseType;
  const alternatives: ExerciseType[] = ['complete_verse', 'fill_blank', 'sadr_to_ajar', 'write_all']
    .filter(t => t !== currentType && (hasAjar || (t !== 'sadr_to_ajar' && t !== 'ajar_to_sadr'))) as ExerciseType[];
  const newType = alternatives[Math.floor(Math.random() * alternatives.length)] || 'complete_verse';
  const insertAt = Math.min(queue.length, 2);
  const newQueue = [...queue];
  newQueue.splice(insertAt, 0, { verseIndex: item.verseIndex, exerciseType: newType, priority: 2, attempts: item.attempts + 1 });
  return newQueue;
}

export function detectWeakTransitions(statsMap: Record<number, VerseStats>, maxVerse: number): number[] {
  const weak: number[] = [];
  for (let i = 0; i < maxVerse; i++) {
    const stats = statsMap[i];
    if (!stats) continue;
    const nextStats = statsMap[i + 1];
    if (!nextStats) continue;
    const standaloneWeak = getStabilityOrder(stats.memory.standalone) < 3;
    const transitionWeak = getStabilityOrder(stats.memory.transition) < 3;
    if (standaloneWeak || transitionWeak) weak.push(i);
  }
  return weak;
}

export function isVerseDueForReview(stats: VerseStats | undefined): boolean {
  if (!stats) return true;
  return Date.now() >= stats.nextReviewAt || stats.memory.standalone === 'new';
}

export function getOverallProgress(
  statsMap: Record<number, VerseStats>, totalVerses: number
): { mastered: number; strong: number; medium: number; weak: number; learning: number; newCount: number } {
  let mastered = 0, strong = 0, medium = 0, weak = 0, learning = 0, newCount = 0;
  for (let i = 0; i < totalVerses; i++) {
    const stats = statsMap[i];
    const level = stats?.memory.standalone || 'new';
    switch (level) {
      case 'mastered': mastered++; break;
      case 'strong': strong++; break;
      case 'medium': medium++; break;
      case 'weak': weak++; break;
      case 'learning': learning++; break;
      default: newCount++; break;
    }
  }
  return { mastered, strong, medium, weak, learning, newCount };
}
