import type { Verse, ExerciseType } from './types';

export interface Exercise {
  type: ExerciseType;
  verseIndex: number;
  prompt: string;
  answer: string;
  shownPart?: string;
  hint?: string;
  blanks?: BlankData[];
  scrambledWords?: string[];
  relatedVerseIndex?: number;
  choices?: string[];
  isMultiVerse?: boolean;
  /** مستوى الاختبار (1-6) */
  level?: number;
  /** المرحلة الفرعية داخل المستوى (للمستوى 4: 1=4A كلمات مساعدة, 2=4B استحضار يدوي) */
  subPhase?: 1 | 2;
}

export interface BlankData {
  beforeText: string;
  blankWord: string;
  afterText: string;
  position: number;
}

// ===== كلمات سهلة يجب تجنبها عند اختيار الكلمات المحذوفة =====
const EASY_WORDS = new Set([
  'في', 'من', 'إلى', 'على', 'عن', 'مع', 'حتى', 'لدى', 'بين',
  'و', 'أو', 'ثم', 'ف', 'ب', 'ل', 'ك',
  'التي', 'الذي', 'اللذان', 'اللتيا',
  'هل', 'لا', 'لم', 'لن', 'قد', 'ما', 'من', 'إن', 'أن',
  'هذا', 'هذه', 'ذلك', 'تلك',
  'هو', 'هي', 'هم', 'هن', 'يا', 'أي', 'كل', 'بعض',
]);

function isSignificantWord(word: string): boolean {
  const clean = word.replace(/[\u064B-\u065F\u0670]/g, '').replace(/[،؛؟!.،;?!'"«»()\[\]{}\-_ـ]/g, '');
  return clean.length >= 2 && !EASY_WORDS.has(clean);
}

// ===== المستوى ١ — التعرف على البيت (اختيار من متعدد) =====
export function generateLevel1(verse: Verse, allVerses: Verse[]): Exercise {
  const distractors: string[] = [];
  const otherVerses = allVerses.filter(v => v.index !== verse.index);

  const shuffled = [...otherVerses];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (const v of shuffled) {
    if (distractors.length >= 3) break;
    distractors.push(v.text);
  }

  // إذا لم تكفِ الأبيات، أضف أبياتًا مقلوبة
  while (distractors.length < 3) {
    const words = verse.text.split(/\s+/).filter(Boolean);
    const shuffledWords = [...words];
    for (let i = shuffledWords.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffledWords[i], shuffledWords[j]] = [shuffledWords[j], shuffledWords[i]];
    }
    const fake = shuffledWords.join(' ');
    if (fake !== verse.text && !distractors.includes(fake)) {
      distractors.push(fake);
    } else {
      distractors.push('...');
    }
  }

  const choices = [verse.text, ...distractors];
  for (let i = choices.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [choices[i], choices[j]] = [choices[j], choices[i]];
  }

  return {
    type: 'where_am_i',
    verseIndex: verse.index,
    prompt: `أي من هذه الأبيات هو البيت رقم ${verse.index + 1}؟`,
    answer: verse.text,
    choices,
    level: 1,
  };
}

// ===== المستوى ٢ — إعادة ترتيب كلمات البيت =====
export function generateLevel2(verse: Verse): Exercise {
  const words = verse.text.split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return { type: 'complete_verse', verseIndex: verse.index, prompt: `أكملي البيت:`, answer: verse.text, level: 2 };
  }

  const scrambled = shuffleArray([...words]);

  // إذا الترتيب العشوائي مطابق، أجرِ إزاحة دائرية
  if (scrambled.join(' ') === words.join(' ') && words.length > 2) {
    const shift = Math.floor(Math.random() * (words.length - 1)) + 1;
    for (let i = 0; i < scrambled.length; i++) {
      scrambled[i] = words[(i + shift) % words.length];
    }
  }

  return {
    type: 'word_order',
    verseIndex: verse.index,
    prompt: `رتّبي كلمات البيت ${verse.index + 1}:`,
    answer: words.join(' '),
    scrambledWords: scrambled,
    level: 2,
  };
}

// ===== المستوى ٣ — كلمتان مفقودتان =====
export function generateLevel3(verse: Verse): Exercise {
  const words = verse.text.split(/\s+/).filter(Boolean);
  if (words.length < 4) {
    return { type: 'fill_blank', verseIndex: verse.index, prompt: `أكملي البيت:`, answer: verse.text, level: 3 };
  }

  const [pos1, pos2] = selectTwoMissingWords(verse, words);
  const blankWord1 = words[pos1];
  const blankWord2 = words[pos2];

  const displayed = words.map((w, i) => {
    if (i === pos1 || i === pos2) return '______';
    return w;
  }).join(' ');

  return {
    type: 'fill_blanks',
    verseIndex: verse.index,
    prompt: `أكملي الكلمتين الناقصتين (اكتبي الكلمتين مفصولتين بفراغ):\n«${displayed}»`,
    answer: `${blankWord1} ${blankWord2}`,
    level: 3,
    hint: `الحرف الأول: ${blankWord1[0]} ، ${blankWord2[0]}`,
  };
}

// ===== المستوى ٤ — مرحلتان: 4A (بنك كلمات) ثم 4B (استحضار يدوي) =====

/** المرحلة 4A: حذف 4-5 كلمات ذكية، عرضها مبعثرة، اختيار بالضغط فقط */
export function generateLevel4Phase1(verse: Verse): Exercise {
  const words = verse.text.split(/\s+/).filter(Boolean);
  if (words.length < 8) {
    return generateLevel4ShortPhase1(verse, words);
  }

  const removedPositions = selectSmartMissingWords(verse, words);
  const removedWords = removedPositions.map(p => words[p]);

  const displayed = words.map((w, i) => {
    if (removedPositions.includes(i)) return '______';
    return w;
  }).join(' ');

  const scrambledRemoved = shuffleArray([...removedWords]);

  return {
    type: 'word_order',
    verseIndex: verse.index,
    prompt: `أكملي الفراغات باختيار الكلمات بالترتيب الصحيح:\n«${displayed}»`,
    answer: removedWords.join(' '),
    scrambledWords: scrambledRemoved,
    level: 4,
    subPhase: 1,
    hint: `اضغطي على الكلمات بالترتيب الصحيح للفراغات`,
  };
}

/** المرحلة 4B: حذف 4-5 كلمات مختلفة، استحضار يدوي بدون بنك كلمات */
export function generateLevel4Phase2(verse: Verse): Exercise {
  const words = verse.text.split(/\s+/).filter(Boolean);
  if (words.length < 8) {
    return generateLevel4ShortPhase2(verse, words);
  }

  // نختار كلمات مختلفة باستخدام seed مختلف (بالتكرار حتى نحصل على مجموعة مختلفة)
  const removedPositions = selectSmartMissingWords(verse, words, true);
  const removedWords = removedPositions.map(p => words[p]);

  const displayed = words.map((w, i) => {
    if (removedPositions.includes(i)) return '______';
    return w;
  }).join(' ');

  return {
    type: 'fill_blanks',
    verseIndex: verse.index,
    prompt: `أكملي الفراغات من الذاكرة (اكتبي الكلمات بالترتيب مفصولة بفراغات):\n«${displayed}»`,
    answer: removedWords.join(' '),
    level: 4,
    subPhase: 2,
    hint: `${removedWords.length} كلمات مفقودة`,
  };
}

/** للبيت القصير — المرحلة 4A */
function generateLevel4ShortPhase1(verse: Verse, words: string[]): Exercise {
  const removedPositions = selectShortMissingWords(verse, words);
  const removedWords = removedPositions.map(p => words[p]);

  const displayed = words.map((w, i) => {
    if (removedPositions.includes(i)) return '______';
    return w;
  }).join(' ');

  const scrambledRemoved = shuffleArray([...removedWords]);

  return {
    type: 'word_order',
    verseIndex: verse.index,
    prompt: `أكملي الفراغات باختيار الكلمات بالترتيب الصحيح:\n«${displayed}»`,
    answer: removedWords.join(' '),
    scrambledWords: scrambledRemoved,
    level: 4,
    subPhase: 1,
    hint: `اضغطي على الكلمات بالترتيب الصحيح للفراغات`,
  };
}

/** للبيت القصير — المرحلة 4B */
function generateLevel4ShortPhase2(verse: Verse, words: string[]): Exercise {
  const removedPositions = selectShortMissingWords(verse, words, true);
  const removedWords = removedPositions.map(p => words[p]);

  const displayed = words.map((w, i) => {
    if (removedPositions.includes(i)) return '______';
    return w;
  }).join(' ');

  return {
    type: 'fill_blanks',
    verseIndex: verse.index,
    prompt: `أكملي الفراغات من الذاكرة (اكتبي الكلمات بالترتيب مفصولة بفراغات):\n«${displayed}»`,
    answer: removedWords.join(' '),
    level: 4,
    subPhase: 2,
    hint: `${removedWords.length} كلمات مفقودة`,
  };
}

/** اختيار كلمات للبيت القصير */
function selectShortMissingWords(verse: Verse, words: string[], differentSeed = false): number[] {
  const target = Math.min(words.length - 1, Math.max(3, Math.round(words.length * 0.4)));
  const sadrWordCount = verse.sadr.split(/\s+/).filter(Boolean).length;

  const sadrSignificant: number[] = [];
  const ajarSignificant: number[] = [];
  for (let i = 0; i < words.length; i++) {
    if (isSignificantWord(words[i])) {
      if (i < sadrWordCount) sadrSignificant.push(i);
      else ajarSignificant.push(i);
    }
  }

  const allSignificant = [...sadrSignificant, ...ajarSignificant];
  const selected: number[] = [];

  const sadrTarget = Math.max(1, Math.round(target * sadrWordCount / words.length));
  const ajarTarget = target - sadrTarget;

  const pool1 = differentSeed ? shuffleArray(shuffleArray(sadrSignificant.length > 0 ? sadrSignificant : Array.from({ length: sadrWordCount }, (_, i) => i).filter(i => i > 0))) : shuffleArray(sadrSignificant.length > 0 ? sadrSignificant : Array.from({ length: sadrWordCount }, (_, i) => i).filter(i => i > 0));
  const pool2 = differentSeed ? shuffleArray(shuffleArray(ajarSignificant.length > 0 ? ajarSignificant : Array.from({ length: words.length - sadrWordCount }, (_, i) => sadrWordCount + i).filter(i => i < words.length - 1))) : shuffleArray(ajarSignificant.length > 0 ? ajarSignificant : Array.from({ length: words.length - sadrWordCount }, (_, i) => sadrWordCount + i).filter(i => i < words.length - 1));

  for (let i = 0; i < Math.min(sadrTarget, pool1.length); i++) selected.push(pool1[i]);
  for (let i = 0; i < Math.min(ajarTarget, pool2.length); i++) selected.push(pool2[i]);

  while (selected.length < target && allSignificant.length > 0) {
    const remaining = allSignificant.filter(i => !selected.includes(i));
    if (remaining.length === 0) break;
    selected.push(remaining[Math.floor(Math.random() * remaining.length)]);
  }

  if (selected.length < 2) {
    for (let i = 0; i < Math.min(target, words.length); i++) {
      if (!selected.includes(i)) selected.push(i);
    }
  }

  return selected.sort((a, b) => a - b);
}

// ===== المستوى ٥ — نصف البيت المفقود (صدر أو عجز) =====
export function generateLevel5(verse: Verse): Exercise {
  // إذا لم يكن للبيت عجز، لا يمكن تقسيمه → نطلب البيت كاملًا
  if (!verse.ajar || verse.ajar.trim() === '') {
    return {
      type: 'write_all',
      verseIndex: verse.index,
      prompt: `اكتبي البيت كاملًا من الذاكرة`,
      answer: verse.text,
      level: 5,
    };
  }

  // نختار عشوائيًا أي جزء نعرضه وأي جزء نطلبه
  const showSadr = Math.random() < 0.5;

  if (showSadr) {
    // نعرض الصدر ونطلب العجز
    return {
      type: 'sadr_to_ajar',
      verseIndex: verse.index,
      prompt: `أكملي عجز البيت:\n«${verse.sadr}»`,
      answer: verse.ajar,
      shownPart: verse.sadr,
      level: 5,
      hint: `عجز البيت`,
    };
  } else {
    // نعرض العجز ونطلب الصدر
    return {
      type: 'ajar_to_sadr',
      verseIndex: verse.index,
      prompt: `أكملي صدر البيت:\n«${verse.ajar}»`,
      answer: verse.sadr,
      shownPart: verse.ajar,
      level: 5,
      hint: `صدر البيت`,
    };
  }
}

// ===== المستوى ٦ — كتابة البيت كاملًا من الذاكرة (بدون إظهار النص) =====
export function generateLevel6(verse: Verse): Exercise {
  return {
    type: 'write_all',
    verseIndex: verse.index,
    prompt: `اكتبي البيت ${verse.index + 1} كاملًا من الذاكرة`,
    answer: verse.text,
    level: 6,
  };
}

// ===== توليد تمارين لمستوى محدد =====
export function generateLevelExercises(
  level: number,
  verse: Verse,
  allVerses: Verse[]
): Exercise[] {
  switch (level) {
    case 1: return [generateLevel1(verse, allVerses)];
    case 2: return [generateLevel2(verse)];
    case 3: return [generateLevel3(verse)];
    case 4: return [generateLevel4Phase1(verse), generateLevel4Phase2(verse)]; // المستوى الرابع: 4A + 4B
    case 5: return [generateLevel5(verse)]; // المستوى الخامس: نصف البيت المفقود
    case 6: return [generateLevel6(verse)]; // المستوى السادس: كتابة البيت كاملًا
    default: return [generateLevel6(verse)];
  }
}

// ===== مراجعة ثنائية (بعد كل بيتين) =====
export function generatePairReview(
  verse1: Verse, verse2: Verse, _allVerses: Verse[]
): Exercise[] {
  const exercises: Exercise[] = [];
  exercises.push({ ...generateLevel2(verse1), prompt: `[مراجعة] رتّبي كلمات البيت ${verse1.index + 1}:`, isMultiVerse: true });
  exercises.push({ ...generateLevel3(verse2), prompt: `[مراجعة] أكملي الكلمتين الناقصتين من البيت ${verse2.index + 1}:`, isMultiVerse: true });
  exercises.push({
    type: 'next_verse', verseIndex: verse1.index,
    prompt: `ما البيت الذي يلي هذا البيت؟ (اكتبيه كاملًا)\n«${verse1.text}»`,
    answer: verse2.text, relatedVerseIndex: verse2.index, isMultiVerse: true,
  });
  exercises.push({
    type: 'prev_verse', verseIndex: verse2.index,
    prompt: `ما البيت الذي يسبق هذا البيت؟ (اكتبيه كاملًا)\n«${verse2.text}»`,
    answer: verse1.text, relatedVerseIndex: verse1.index, isMultiVerse: true,
  });
  return exercises;
}

// ===== مراجعة شاملة =====
export function generateComprehensiveReview(
  verses: Verse[], maxVerseReached: number
): Exercise[] {
  const exercises: Exercise[] = [];
  const learned = verses.slice(0, maxVerseReached + 1);
  if (learned.length <= 0) return exercises;

  const sample = learned.filter((_, i) => i % 3 === 0).slice(0, 4);
  for (const v of sample) {
    exercises.push({ ...generateLevel6(v), prompt: `[مراجعة شاملة] اكتبي البيت ${v.index + 1} كاملًا:`, isMultiVerse: true });
  }
  return exercises;
}

// ===== دوال مساعدة =====
function shuffleArray<T>(arr: T[]): T[] {
  const result = [...arr];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** اختيار كلمتين لهما قيمة لحذفهما */
function selectTwoMissingWords(verse: Verse, words: string[]): [number, number] {
  const sadrWordCount = verse.sadr.split(/\s+/).filter(Boolean).length;

  const sadrSignificant: number[] = [];
  for (let i = 0; i < sadrWordCount; i++) {
    if (isSignificantWord(words[i])) sadrSignificant.push(i);
  }

  const ajarSignificant: number[] = [];
  for (let i = sadrWordCount; i < words.length; i++) {
    if (isSignificantWord(words[i])) ajarSignificant.push(i);
  }

  const allSignificant = [...sadrSignificant, ...ajarSignificant];

  let pos1: number, pos2: number;

  if (sadrSignificant.length > 0 && ajarSignificant.length > 0) {
    pos1 = sadrSignificant[Math.floor(Math.random() * sadrSignificant.length)];
    pos2 = ajarSignificant[Math.floor(Math.random() * ajarSignificant.length)];
  } else if (allSignificant.length >= 2) {
    const shuffled = shuffleArray(allSignificant);
    pos1 = shuffled[0];
    pos2 = shuffled[1];
  } else {
    const candidates = words.map((_, i) => i).filter(i => i > 0 && i < words.length - 1);
    if (candidates.length >= 2) {
      const shuffled = shuffleArray(candidates);
      pos1 = shuffled[0];
      pos2 = shuffled[1];
    } else {
      pos1 = 0;
      pos2 = Math.min(1, words.length - 1);
    }
  }

  if (pos1 > pos2) [pos1, pos2] = [pos2, pos1];
  return [pos1, pos2];
}

/**
 * اختيار ٤-٥ كلمات من البيت للحذف في المستوى الرابع
 * الكلمات موزعة على صدر البيت وعجزه
 * تُفضل الكلمات الدلالية/الشعرية على كلمات الوصل والجر
 */
function selectSmartMissingWords(verse: Verse, words: string[], differentSeed = false): number[] {
  const sadrWordCount = verse.sadr.split(/\s+/).filter(Boolean).length;
  const ajarWordCount = words.length - sadrWordCount;

  // نريد حذف ٤-٥ كلمات إجمالًا
  const totalTarget = Math.min(words.length - 2, Math.max(4, Math.round(words.length * 0.4)));

  // توزيع العدد بين الصدر والعجز بنسبة طولهما
  const sadrRatio = sadrWordCount / words.length;
  let sadrRemove = Math.max(1, Math.round(totalTarget * sadrRatio));
  let ajarRemove = Math.max(1, totalTarget - sadrRemove);

  // لا تزد على عدد الكلمات المتاحة (اترك كلمة واحدة ظاهرة على الأقل)
  sadrRemove = Math.min(sadrRemove, sadrWordCount - 1);
  ajarRemove = Math.min(ajarRemove, Math.max(0, ajarWordCount - 1));

  const removed: number[] = [];

  // ===== اختيار من الصدر =====
  const sadrSignificant: number[] = [];
  const sadrOther: number[] = [];
  for (let i = 0; i < sadrWordCount; i++) {
    if (isSignificantWord(words[i])) sadrSignificant.push(i);
    else sadrOther.push(i);
  }

  // اختر الكلمات الدلالية أولًا
  // differentSeed: خلط مرتين لاختيار كلمات مختلفة عن Phase 1
  const shuffledSadrSig = differentSeed ? shuffleArray(shuffleArray(sadrSignificant)) : shuffleArray(sadrSignificant);
  for (let i = 0; i < Math.min(sadrRemove, shuffledSadrSig.length); i++) {
    removed.push(shuffledSadrSig[i]);
  }
  // أكمل بالكلمات الأخرى إن لزم
  if (removed.length < sadrRemove) {
    const pool = sadrOther.filter(i => !removed.includes(i));
    const shuffledSadrOther = differentSeed ? shuffleArray(shuffleArray(pool)) : shuffleArray(pool);
    for (let i = 0; i < Math.min(sadrRemove - removed.length, shuffledSadrOther.length); i++) {
      removed.push(shuffledSadrOther[i]);
    }
  }

  // ===== اختيار من العجز =====
  const ajarSignificant: number[] = [];
  const ajarOther: number[] = [];
  for (let i = sadrWordCount; i < words.length; i++) {
    if (isSignificantWord(words[i])) ajarSignificant.push(i);
    else ajarOther.push(i);
  }

  const shuffledAjarSig = differentSeed ? shuffleArray(shuffleArray(ajarSignificant)) : shuffleArray(ajarSignificant);
  const ajarSelected: number[] = [];
  for (let i = 0; i < Math.min(ajarRemove, shuffledAjarSig.length); i++) {
    ajarSelected.push(shuffledAjarSig[i]);
  }
  if (ajarSelected.length < ajarRemove) {
    const pool = ajarOther.filter(i => !ajarSelected.includes(i));
    const shuffledAjarOther = differentSeed ? shuffleArray(shuffleArray(pool)) : shuffleArray(pool);
    for (let i = 0; i < Math.min(ajarRemove - ajarSelected.length, shuffledAjarOther.length); i++) {
      ajarSelected.push(shuffledAjarOther[i]);
    }
  }

  removed.push(...ajarSelected);

  // ===== أكمل العدد الإجمالي إن لزم =====
  while (removed.length < totalTarget) {
    const remaining = words.map((_, i) => i).filter(i => !removed.includes(i) && i > 0 && i < words.length - 1);
    if (remaining.length === 0) break;
    // فضّل الكلمات الدلالية
    const sigRemaining = remaining.filter(i => isSignificantWord(words[i]));
    const pool = sigRemaining.length > 0 ? sigRemaining : remaining;
    removed.push(pool[Math.floor(Math.random() * pool.length)]);
  }

  return removed.sort((a, b) => a - b);
}

// ===== دوال العرض =====
export function getExerciseLabel(type: ExerciseType): string {
  const labels: Record<ExerciseType, string> = {
    complete_verse: 'إكمال البيت',
    fill_blank: 'كلمة ناقصة',
    fill_blanks: 'كلمات ناقصة',
    sadr_to_ajar: 'صدر ← عجز',
    ajar_to_sadr: 'عجز ← صدر',
    first_word: 'حروف أولى',
    write_all: 'استحضار حر',
    word_order: 'ترتيب الكلمات',
    next_verse: 'البيت التالي',
    prev_verse: 'البيت السابق',
    continue_from: 'أكمل من هنا',
    where_am_i: 'أين أنا؟',
  };
  return labels[type] || type;
}

export function getLevelLabel(level: number, subPhase?: number): string {
  const labels: Record<number, string> = {
    1: 'التعرف على البيت',
    2: 'ترتيب الكلمات',
    3: 'كلمتان مفقودتان',
    4: subPhase === 1 ? 'نصف البيت — كلمات مساعدة' : 'نصف البيت — استحضار يدوي',
    5: 'استرجاع نصف البيت',
    6: 'كتابة البيت كاملًا',
  };
  return labels[level] || '';
}
