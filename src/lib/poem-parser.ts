import type { Verse } from './types';

/**
 * يحلل نص القصيدة ويقسمه إلى أبيات
 * كل سطرين يمثلان بيتًا واحدًا: السطر الأول صدر والسطر الثاني عجز
 * إذا احتوى السطر على فاصل صريح (| أو //) يُعتبر بيتًا كاملًا في سطر واحد
 */
export function parsePoem(rawText: string): Verse[] {
  const lines = rawText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0);

  const cleanedLines = lines
    .map(line => line.replace(/^[\d٠-٩]+[.\-)]\s*/, '').trim())
    .filter(line => line.length > 0);

  if (cleanedLines.length === 0) return [];

  const verses: Verse[] = [];
  const explicitSeparators = [' | ', ' / ', ' // ', ' *** ', ' --- ', '|', '/'];

  let i = 0;
  while (i < cleanedLines.length) {
    const line = cleanedLines[i];
    const separatorResult = trySplitBySeparator(line, explicitSeparators);
    if (separatorResult) {
      verses.push({
        index: verses.length,
        text: line,
        sadr: separatorResult.sadr,
        ajar: separatorResult.ajar,
      });
      i++;
    } else if (i + 1 < cleanedLines.length) {
      const sadr = cleanedLines[i];
      const ajar = cleanedLines[i + 1];
      const nextHasSeparator = trySplitBySeparator(ajar, explicitSeparators);

      if (nextHasSeparator) {
        verses.push({ index: verses.length, text: sadr, sadr, ajar: '' });
        i++;
      } else {
        verses.push({
          index: verses.length,
          text: `${sadr}  ${ajar}`,
          sadr,
          ajar,
        });
        i += 2;
      }
    } else {
      verses.push({ index: verses.length, text: line, sadr: line, ajar: '' });
      i++;
    }
  }

  return verses;
}

function trySplitBySeparator(
  text: string,
  separators: string[]
): { sadr: string; ajar: string } | null {
  for (const sep of separators) {
    const parts = text.split(sep);
    if (parts.length === 2) {
      const sadr = parts[0].trim();
      const ajar = parts[1].trim();
      if (sadr.length > 0 && ajar.length > 0) {
        return { sadr, ajar };
      }
    }
  }

  const commaIdx = text.indexOf('،');
  if (commaIdx > 0 && commaIdx < text.length - 2) {
    const before = text.slice(0, commaIdx).trim();
    const after = text.slice(commaIdx + 1).trim();
    const beforeWords = before.split(/\s+/).length;
    const afterWords = after.split(/\s+/).length;
    if (beforeWords >= 2 && afterWords >= 2) {
      return { sadr: before, ajar: after };
    }
  }

  return null;
}

export function splitVerse(text: string, index: number): Verse {
  const explicitSeparators = [' | ', ' / ', ' // ', ' *** ', ' --- ', '|', '/'];
  const result = trySplitBySeparator(text, explicitSeparators);
  if (result) {
    return { index, text, sadr: result.sadr, ajar: result.ajar };
  }

  const words = text.split(/\s+/);
  if (words.length >= 4) {
    const mid = Math.ceil(words.length / 2);
    return {
      index,
      text,
      sadr: words.slice(0, mid).join(' '),
      ajar: words.slice(mid).join(' '),
    };
  }

  return { index, text, sadr: text, ajar: '' };
}

export function removeTashkeel(text: string): string {
  return text.replace(/[\u064B-\u065F\u0670]/g, '');
}

export function normalizeForComparison(
  text: string,
  options: { ignoreTashkeel?: boolean; ignorePunctuation?: boolean; ignoreSpaces?: boolean } = {}
): string {
  let t = text;

  if (options.ignoreTashkeel) {
    t = removeTashkeel(t);
  }

  if (options.ignorePunctuation) {
    t = t.replace(/[،؛؟!.،;?!'"«»()\[\]{}\-_ـ]/g, ' ');
  }

  if (options.ignoreSpaces) {
    t = t.replace(/\s+/g, '');
  } else {
    t = t.replace(/\s+/g, ' ').trim();
  }

  t = t.replace(/[أإآ]/g, 'ا');
  t = t.replace(/[ى]/g, 'ي');
  t = t.replace(/ة/g, 'ه');
  t = t.replace(/ؤ/g, 'و');
  t = t.replace(/ئ/g, 'ي');
  t = t.replace(/لا/g, 'لا');

  return t.trim();
}

export interface ComparisonResult {
  isCorrect: boolean;
  similarity: number;
  quality: 'mastered' | 'correct' | 'review' | 'wrong';
  diffTokens: DiffToken[];
}

export interface DiffToken {
  text: string;
  type: 'correct' | 'error' | 'missing' | 'extra';
}

export function compareAnswers(
  userAnswer: string,
  correctAnswer: string,
  options: {
    requireTashkeel: boolean;
    strict?: boolean;
  }
): ComparisonResult {
  const normOpts = {
    ignoreTashkeel: !options.requireTashkeel,
    ignorePunctuation: true,
  };

  const userNorm = normalizeForComparison(userAnswer, normOpts);
  const correctNorm = normalizeForComparison(correctAnswer, normOpts);

  if (userNorm === correctNorm) {
    return {
      isCorrect: true,
      similarity: 1,
      quality: 'mastered',
      diffTokens: correctAnswer.split(/\s+/).filter(Boolean).map(w => ({ text: w, type: 'correct' as const })),
    };
  }

  const userWords = userNorm.split(/\s+/).filter(Boolean);
  const correctWords = correctNorm.split(/\s+/).filter(Boolean);
  const originalWords = correctAnswer.split(/\s+/).filter(Boolean);

  if (correctWords.length === 0) {
    return { isCorrect: false, similarity: 0, quality: 'wrong', diffTokens: [] };
  }

  const diffTokens = computeDiff(userWords, correctWords, originalWords);

  const correctCount = diffTokens.filter(t => t.type === 'correct').length;
  const total = Math.max(diffTokens.length, 1);
  const similarity = correctCount / total;

  let quality: ComparisonResult['quality'];
  if (similarity >= 0.95) {
    quality = 'mastered';
  } else if (similarity >= 0.8) {
    quality = 'correct';
  } else if (similarity >= 0.5) {
    quality = 'review';
  } else {
    quality = 'wrong';
  }

  if (quality === 'wrong' || quality === 'review') {
    const userWordSet = new Set(userWords);
    const matchCount = correctWords.filter(w => userWordSet.has(w)).length;
    const setSimilarity = matchCount / correctWords.length;
    if (setSimilarity >= 0.9 && similarity < 0.8) {
      quality = 'correct';
      return { isCorrect: true, similarity: setSimilarity, quality, diffTokens };
    }
  }

  return { isCorrect: similarity >= 0.8, similarity, quality, diffTokens };
}

function computeDiff(
  userWords: string[],
  correctWords: string[],
  originalWords: string[]
): DiffToken[] {
  const m = userWords.length;
  const n = correctWords.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => new Array(n + 1).fill(0));

  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      if (userWords[i - 1] === correctWords[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  const tokens: DiffToken[] = [];
  let i = m, j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && userWords[i - 1] === correctWords[j - 1]) {
      tokens.unshift({
        text: originalWords[j - 1] || correctWords[j - 1],
        type: 'correct',
      });
      i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
      tokens.unshift({
        text: originalWords[j - 1] || correctWords[j - 1],
        type: 'missing',
      });
      j--;
    } else {
      tokens.unshift({
        text: userWords[i - 1],
        type: 'extra',
      });
      i--;
    }
  }

  return tokens;
}
