import { useState, useCallback, useEffect, useRef } from 'react';
import { X, Volume2, VolumeX, Eye, EyeOff, Lightbulb } from 'lucide-react';
import type { Poem, PoemStats, AppSettings, VerseStats } from '../lib/types';
import { defaultVerseStats } from '../lib/storage';
import { generateLevelExercises, generatePairReview, generateComprehensiveReview, getExerciseLabel, type Exercise } from '../lib/exercises';
import { compareAnswers, removeTashkeel } from '../lib/poem-parser';
import { updateVerseStatsAfterAnswer } from '../lib/algorithm';
import { Button, ProgressBar } from '../ui';

interface Props {
  poem: Poem;
  stats: PoemStats | undefined;
  settings: AppSettings;
  mode: string;
  startFromVerse?: number;
  newVerseIndex?: number;
  onClose: () => void;
  onVerseUpdate: (poemId: string, vs: VerseStats) => void;
  onSessionComplete: (poemId: string, correct: number, errors: number) => void;
  onCurrentVerseUpdate: (poemId: string, idx: number) => void;
}

type Phase = 'preview' | 'practice' | 'pair_review' | 'comprehensive_review' | 'session_complete';

function findArabicVoice(): SpeechSynthesisVoice | null {
  if (!('speechSynthesis' in window)) return null;
  const v = window.speechSynthesis.getVoices();
  return v.find(x => x.lang === 'ar-SA') || v.find(x => x.lang === 'ar-EG') || v.find(x => x.lang.startsWith('ar')) || null;
}

export default function SessionView({ poem, stats, settings, mode, startFromVerse, onClose, onVerseUpdate, onSessionComplete, onCurrentVerseUpdate }: Props) {
  const statsMap = stats?.verses || {};
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const totalVerses = poem.verses.length;

  // ===== تعديل ٢: بدء الحفظ من البيت الأول دائمًا =====
  const initialVerseIdx = (() => {
    if (mode === 'continue_from' && startFromVerse !== undefined) return startFromVerse;
    if (mode === 'review' || mode === 'chain' || mode === 'where_am_i') return 0;
    // للوضع التراكمي: نبدأ دائمًا من البيت الأول
    return 0;
  })();

  const initialPhase: Phase = (mode === 'review' || mode === 'where_am_i' || mode === 'chain') ? 'comprehensive_review' : 'preview';

  const [currentVerseIdx, setCurrentVerseIdx] = useState(initialVerseIdx);
  const [phase, setPhase] = useState<Phase>(initialPhase);
  const [exerciseSet, setExerciseSet] = useState<Exercise[]>([]);
  const [exIdx, setExIdx] = useState(0);
  const [correctCount, setCorrectCount] = useState(0);
  const [errorCount, setErrorCount] = useState(0);
  const [userAnswer, setUserAnswer] = useState('');
  const [showResult, setShowResult] = useState(false);
  const [resultQuality, setResultQuality] = useState<'mastered' | 'correct' | 'review' | 'wrong'>('correct');
  const [diffTokens, setDiffTokens] = useState<Array<{ text: string; type: string }>>([]);
  const [selectedWordIndices, setSelectedWordIndices] = useState<number[]>([]);
  const [showHint, setShowHint] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);
  const [versesCompleted, setVersesCompleted] = useState(0);
  const [showTashkeel, setShowTashkeel] = useState(true);

  // ===== تعديل ٣: نظام التدرج في المستويات =====
  const [currentLevel, setCurrentLevel] = useState(1);

  const currentVerse = poem.verses[currentVerseIdx];
  const currentExercise = exerciseSet[exIdx] || null;

  // TTS setup
  useEffect(() => {
    if (!('speechSynthesis' in window)) { setTtsAvailable(false); return; }
    const check = () => setTtsAvailable(window.speechSynthesis.getVoices().length > 0);
    check(); window.speechSynthesis.onvoiceschanged = check; setTimeout(check, 500);
  }, []);

  useEffect(() => { if (!showResult && phase === 'practice' && textareaRef.current) textareaRef.current.focus(); }, [exIdx, showResult, phase]);
  useEffect(() => { return () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }; }, []);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ar-SA'; u.rate = settings.speechRate; u.pitch = settings.speechPitch; u.volume = 1;
    const v = findArabicVoice(); if (v) u.voice = v;
    u.onstart = () => setSpeaking(true); u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false);
    try { window.speechSynthesis.speak(u); } catch {}
  }, [settings]);

  const stopSpeaking = useCallback(() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setSpeaking(false); }, []);

  // ===== بدء تمرين مستوى محدد =====
  const startVersePractice = useCallback((idx: number, level = 1) => {
    const verse = poem.verses[idx];
    if (!verse) return;
    const exercises = generateLevelExercises(level, verse, poem.verses);
    setExerciseSet(exercises);
    setCurrentLevel(level);
    setExIdx(0);
    setUserAnswer('');
    setSelectedWordIndices([]);
    setShowResult(false);
    setShowHint(false);
    setDiffTokens([]);
    setPhase('practice');
  }, [poem]);

  // startPairReview is now inlined in advanceToNextVerse

  const startComprehensiveReview = useCallback(() => {
    const maxReached = poem.currentVerseIndex;
    if (maxReached < 0) return;
    setExerciseSet(generateComprehensiveReview(poem.verses, maxReached));
    setExIdx(0); setUserAnswer(''); setSelectedWordIndices([]); setShowResult(false); setShowHint(false); setDiffTokens([]);
    setPhase('comprehensive_review');
  }, [poem]);

  // ===== التحقق من الإجابة =====
  const checkAnswer = useCallback(() => {
    if (!currentExercise) return;
    let answer = userAnswer;

    // إذا كانت الإجابة بالكلمات المختارة
    if (currentExercise.scrambledWords && selectedWordIndices.length > 0) {
      answer = selectedWordIndices.map(idx => currentExercise.scrambledWords![idx]).join(' ');
    }

    // إذا كانت الإجابة بالاختيار من متعدد
    if (currentExercise.choices && userAnswer) {
      answer = userAnswer;
    }

    const result = compareAnswers(answer, currentExercise.answer, { requireTashkeel: settings.requireTashkeel });
    setResultQuality(result.quality);
    setDiffTokens(result.diffTokens);
    setShowResult(true);

    const isCorrect = result.isCorrect;

    if (isCorrect) {
      setCorrectCount(c => c + 1);
    } else {
      setErrorCount(e => e + 1);
    }

    // تحديث إحصائيات البيت
    const verseIdx = currentExercise.verseIndex;
    const existingStats = statsMap[verseIdx] || defaultVerseStats(verseIdx);
    const updatedStats = updateVerseStatsAfterAnswer(existingStats, result.quality, currentExercise.type);
    onVerseUpdate(poem.id, updatedStats);

    if (verseIdx >= poem.currentVerseIndex) {
      onCurrentVerseUpdate(poem.id, verseIdx);
    }
  }, [currentExercise, userAnswer, selectedWordIndices, settings, statsMap, poem, onVerseUpdate, onCurrentVerseUpdate]);

  // ===== الانتقال إلى البيت التالي أو المراجعة =====
  // بعد إكمال جميع مستويات بيت معين
  const advanceToNextVerse = useCallback(() => {
    const nextIdx = currentVerseIdx + 1;

    // إذا أكملنا بيتًا بفهرس فردي (0-indexed) = بيت ذو رقم زوجي (1-indexed)
    // أي أكملنا بيتًا ثانيًا في زوج → مراجعة ثنائية قبل الانتقال
    if (currentVerseIdx % 2 === 1) {
      // أكملنا بيتين: [currentVerseIdx - 1, currentVerseIdx]
      // → مراجعة ثنائية
      const i1 = currentVerseIdx - 1;
      const i2 = currentVerseIdx;
      const v1 = poem.verses[i1], v2 = poem.verses[i2];
      if (v1 && v2) {
        setExerciseSet(generatePairReview(v1, v2, poem.verses));
        setExIdx(0); setUserAnswer(''); setSelectedWordIndices([]); setShowResult(false); setShowHint(false); setDiffTokens([]);
        setPhase('pair_review');
      } else {
        // fallback: انتقل إلى البيت التالي مباشرة
        if (nextIdx >= totalVerses) {
          setVersesCompleted(v => v + 1);
          setPhase('session_complete');
          onSessionComplete(poem.id, correctCount, errorCount);
          return;
        }
        setCurrentVerseIdx(nextIdx);
        setCurrentLevel(1);
        setPhase('preview');
        setExerciseSet([]);
        setExIdx(0);
        setUserAnswer('');
        setSelectedWordIndices([]);
        setShowResult(false);
        setShowHint(false);
        setDiffTokens([]);
        setVersesCompleted(v => v + 1);
      }
      return;
    }

    // إذا كان هذا آخر بيت وليس هناك بيت تالي
    if (nextIdx >= totalVerses) {
      // البيت الأخير في قصيدة ذات عدد فردي
      // نعتبره مكتملًا بدون مراجعة ثنائية
      setVersesCompleted(v => v + 1);
      setPhase('session_complete');
      onSessionComplete(poem.id, correctCount, errorCount);
      return;
    }

    // ننتقل إلى البيت التالي (preview)
    setCurrentVerseIdx(nextIdx);
    setCurrentLevel(1);
    setPhase('preview');
    setExerciseSet([]);
    setExIdx(0);
    setUserAnswer('');
    setSelectedWordIndices([]);
    setShowResult(false);
    setShowHint(false);
    setDiffTokens([]);
    setVersesCompleted(v => v + 1);
  }, [currentVerseIdx, totalVerses, poem, correctCount, errorCount, onSessionComplete]);

  // ===== الانتقال بعد إكمال المراجعة الثنائية =====
  const advanceAfterPairReview = useCallback(() => {
    // بعد مراجعة البيتين، ننتقل إلى البيت التالي
    const nextIdx = currentVerseIdx + 1;

    if (nextIdx >= totalVerses) {
      // انتهت القصيدة
      setPhase('session_complete');
      onSessionComplete(poem.id, correctCount, errorCount);
      return;
    }

    setCurrentVerseIdx(nextIdx);
    setCurrentLevel(1);
    setPhase('preview');
    setExerciseSet([]);
    setExIdx(0);
    setUserAnswer('');
    setSelectedWordIndices([]);
    setShowResult(false);
    setShowHint(false);
    setDiffTokens([]);
  }, [currentVerseIdx, totalVerses, poem, correctCount, errorCount, onSessionComplete]);

  // ===== الانتقال بعد الإجابة =====
  const handleNextExercise = useCallback(() => {
    if (!currentExercise) return;

    const isCorrect = resultQuality === 'mastered' || resultQuality === 'correct';

    // في وضع التدرج (practice phase مع مستويات)
    if (phase === 'practice' && currentExercise.level) {
      // نأخذ المستوى من التمرين الفعلي الحالي — ليس من state قديم
      const actualLevel = currentExercise.level;

      if (isCorrect) {
        // ===== نجاح =====
        // هل بقيت تمارين أخرى في المجموعة الحالية؟ (مثلاً 4A → 4B)
        if (exIdx < exerciseSet.length - 1) {
          // انتقل إلى التمرين التالي في نفس المستوى (4A → 4B)
          setExIdx(exIdx + 1);
          setUserAnswer('');
          setSelectedWordIndices([]);
          setShowResult(false);
          setShowHint(false);
          setDiffTokens([]);
        } else {
          // أكمل جميع تمارين المستوى الحالي → انتقل إلى المستوى التالي
          const nextLevel = actualLevel + 1;
          if (nextLevel > 6) {
            // أتقن جميع المستويات الستة → انتقل إلى البيت التالي أو المراجعة
            advanceToNextVerse();
          } else {
            // انتقل إلى المستوى التالي
            startVersePractice(currentVerseIdx, nextLevel);
          }
        }
      } else {
        // ===== خطأ: الرجوع مستوى واحدًا فقط =====
        // 6 → 5, 5 → 4, 4 → 3, 3 → 2, 2 → 1, 1 → 1
        const prevLevel = Math.max(1, actualLevel - 1);
        startVersePractice(currentVerseIdx, prevLevel);
      }
      return;
    }

    // في وضع المراجعة الثنائية أو الشاملة
    if (exIdx < exerciseSet.length - 1) {
      setExIdx(exIdx + 1);
      setUserAnswer('');
      setSelectedWordIndices([]);
      setShowResult(false);
      setShowHint(false);
      setDiffTokens([]);
    } else {
      // انتهت مجموعة التمارين
      if (phase === 'pair_review') {
        advanceAfterPairReview();
      } else if (phase === 'comprehensive_review') {
        setPhase('session_complete');
        onSessionComplete(poem.id, correctCount, errorCount);
      }
    }
  }, [currentExercise, resultQuality, phase, currentLevel, currentVerseIdx, exIdx, exerciseSet, correctCount, errorCount, poem, onSessionComplete, startVersePractice, advanceToNextVerse, advanceAfterPairReview]);

  // بدء المراجعة الشاملة عند التحميل
  useEffect(() => {
    if (phase === 'comprehensive_review' && exerciseSet.length === 0) {
      startComprehensiveReview();
    }
  }, []);

  // معالجة اختيار كلمة
  const handleWordSelect = useCallback((wordIdx: number) => {
    if (selectedWordIndices.includes(wordIdx)) return;
    setSelectedWordIndices(prev => [...prev, wordIdx]);
  }, [selectedWordIndices]);

  // إزالة آخر كلمة مختارة
  const handleWordDeselect = useCallback(() => {
    setSelectedWordIndices(prev => prev.slice(0, -1));
  }, []);

  // التحقق التلقائي عند اكتمال الكلمات المختارة
  useEffect(() => {
    if (!currentExercise?.scrambledWords || !selectedWordIndices.length) return;
    // المستوى ٤ مرحلة A (4A): تحقق تلقائي عند اكتمال الكلمات المختارة
    if (currentExercise.level === 4 && currentExercise.subPhase === 1) {
      const blankCount = (currentExercise.prompt.match(/______/g) || []).length;
      if (selectedWordIndices.length === blankCount && !showResult) {
        const timer = setTimeout(() => checkAnswer(), 300);
        return () => clearTimeout(timer);
      }
    }
    // المستوى ٢: عدد الكلمات = كل الكلمات
    if (currentExercise.level === 2 && selectedWordIndices.length === currentExercise.scrambledWords.length && !showResult) {
      const timer = setTimeout(() => checkAnswer(), 300);
      return () => clearTimeout(timer);
    }
  }, [selectedWordIndices, currentExercise, showResult, checkAnswer]);

  // ===== العرض =====
  const verseProgress = Math.round(((versesCompleted) / totalVerses) * 100);

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-0)] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between session-content py-3 border-b border-[var(--border-0)] bg-[var(--bg-1)] shrink-0">
        <button onClick={onClose} className="p-1.5 rounded-md text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]">
          <X size={16} strokeWidth={1.5} />
        </button>
        <div className="text-center flex-1">
          <p className="text-xs font-medium text-[var(--text-0)]">{poem.title}</p>
          <p className="text-[10px] text-[var(--text-3)]">
            {phase === 'practice' && currentExercise?.level === 4 && currentExercise?.subPhase === 1 && `المستوى 4A من 6`}
            {phase === 'practice' && currentExercise?.level === 4 && currentExercise?.subPhase === 2 && `المستوى 4B من 6`}
            {phase === 'practice' && currentExercise?.level !== 4 && `المستوى ${currentLevel} من 6`}
            {phase === 'preview' && `البيت ${currentVerseIdx + 1} من ${totalVerses}`}
            {phase === 'pair_review' && 'مراجعة ثنائية'}
            {phase === 'comprehensive_review' && 'مراجعة شاملة'}
            {phase === 'session_complete' && 'اكتملت الجلسة'}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowTashkeel(s => !s)} className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]">
            {showTashkeel ? <EyeOff size={14} /> : <Eye size={14} />}
          </button>
          {ttsAvailable && currentVerse && (
            <button onClick={() => speaking ? stopSpeaking() : speak(currentVerse.text)} className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]">
              {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="session-content py-2 border-b border-[var(--border-0)] bg-[var(--bg-0)]">
        <ProgressBar value={verseProgress} />
        <div className="flex justify-between text-[10px] text-[var(--text-3)] mt-1">
          <span>البيت {currentVerseIdx + 1} / {totalVerses}</span>
          <span>✓ {correctCount} · ✗ {errorCount}</span>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto session-content py-6">
        <div className="max-w-2xl mx-auto">

          {/* ===== PREVIEW ===== */}
          {phase === 'preview' && currentVerse && (
            <div className="animate-fade-in">
              <div className="text-center mb-4">
                <span className="text-xs text-[var(--text-3)]">البيت {currentVerseIdx + 1} من {totalVerses}</span>
              </div>

              <div className="text-center mb-8 p-6 rounded-xl bg-[var(--bg-1)] border border-[var(--border-0)]" style={{ fontFamily: 'var(--font-poem)', fontSize: '1.4rem', lineHeight: '2.2', color: 'var(--text-0)' }}>
                {currentVerse.ajar ? (
                  <>
                    {showTashkeel ? currentVerse.sadr : removeTashkeel(currentVerse.sadr)}
                    <span className="text-[var(--border-1)] mx-3 text-sm">✦</span>
                    {showTashkeel ? currentVerse.ajar : removeTashkeel(currentVerse.ajar)}
                  </>
                ) : (
                  showTashkeel ? currentVerse.text : removeTashkeel(currentVerse.text)
                )}
              </div>

              <div className="flex items-center justify-center gap-3">
                {ttsAvailable && (
                  <Button variant="ghost" size="sm" onClick={() => speaking ? stopSpeaking() : speak(currentVerse.text)}>
                    {speaking ? <VolumeX size={14} /> : <Volume2 size={14} />}
                    استماع
                  </Button>
                )}
                <Button variant="primary" onClick={() => startVersePractice(currentVerseIdx, 1)}>
                  ابدئي التمرين
                </Button>
              </div>
            </div>
          )}

          {/* ===== EXERCISE (practice / pair_review / comprehensive_review) ===== */}
          {(phase === 'practice' || phase === 'pair_review' || phase === 'comprehensive_review') && currentExercise && (
            <div className="animate-fade-in">
              {/* شريط المستويات الخمسة */}
              {phase === 'practice' && currentExercise.level && (
                <div className="flex items-center justify-center gap-1.5 mb-4">
                  {[1, 2, 3, 4, 5, 6].map(l => (
                    <div
                      key={l}
                      className={`w-8 h-2 rounded-full transition-all duration-300 ${
                        l < currentLevel ? 'bg-[var(--success)]' :
                        l === currentLevel ? 'bg-[var(--accent)]' :
                        'bg-[var(--bg-3)]'
                      }`}
                    />
                  ))}
                  <span className="text-[11px] text-[var(--text-2)] mr-2">
                    المستوى {currentLevel}{currentExercise?.level === 4 && currentExercise?.subPhase === 1 ? 'A' : ''}{currentExercise?.level === 4 && currentExercise?.subPhase === 2 ? 'B' : ''}
                  </span>
                </div>
              )}

              {/* عنوان التمرين */}
              <div className="flex items-center justify-center gap-2 mb-4 text-xs text-[var(--text-2)]">
                <span>{getExerciseLabel(currentExercise.type)}</span>
                {currentExercise.isMultiVerse && <span>· بيتين</span>}
                <span>· {exIdx + 1}/{exerciseSet.length}</span>
              </div>

              {/* النص المطوب */}
              <div className="text-center mb-6 p-4 rounded-xl bg-[var(--bg-1)] border border-[var(--border-0)]" style={{ fontFamily: 'var(--font-poem)', fontSize: '1.2rem', lineHeight: '2.2', color: 'var(--text-0)' }}>
                {currentExercise.prompt.split('\n').map((line, i) => (
                  <p key={i}>{line}</p>
                ))}
              </div>

              {!showResult ? (
                <div className="space-y-4">
                  {/* اختيار من متعدد (المستوى ١) */}
                  {currentExercise.choices && (
                    <div className="space-y-2">
                      {currentExercise.choices.map((choice, i) => (
                        <button
                          key={i}
                          onClick={() => { setUserAnswer(choice); setSelectedWordIndices([]); }}
                          className={`w-full p-3 rounded-lg border text-right transition-all ${
                            userAnswer === choice
                              ? 'border-[var(--accent)] bg-[var(--accent-light)] text-[var(--accent-text)]'
                              : 'border-[var(--border-0)] bg-[var(--bg-1)] text-[var(--text-0)] hover:border-[var(--border-1)]'
                          }`}
                          style={{ fontFamily: 'var(--font-poem)', fontSize: '0.95rem', lineHeight: '1.8' }}
                        >
                          {choice}
                        </button>
                      ))}
                    </div>
                  )}

                  {/* كلمات مبعثرة (المستوى ٢، والمستوى ٤ مرحلة A فقط) */}
                  {currentExercise.scrambledWords && !(currentExercise.level === 4 && currentExercise.subPhase === 2) && (
                    <div className="space-y-4">
                      {/* الكلمات المتاحة */}
                      <div className="flex flex-wrap gap-2 justify-center">
                        {currentExercise.scrambledWords.map((word, i) => (
                          <button
                            key={i}
                            onClick={() => handleWordSelect(i)}
                            className={`word-tag ${selectedWordIndices.includes(i) ? 'selected' : ''}`}
                            disabled={selectedWordIndices.includes(i)}
                          >
                            {word}
                          </button>
                        ))}
                      </div>

                      {/* الكلمات المختارة بالترتيب */}
                      {selectedWordIndices.length > 0 && (
                        <div className="text-center">
                          <p className="text-xs text-[var(--text-2)] mb-2">ترتيبك:</p>
                          <div className="flex flex-wrap gap-2 justify-center">
                            {selectedWordIndices.map((idx, i) => (
                              <span key={i} className="inline-flex items-center gap-1 px-3 py-1 rounded-lg bg-[var(--accent-light)] text-[var(--accent-text)] text-sm" style={{ fontFamily: 'var(--font-poem)' }}>
                                {currentExercise.scrambledWords![idx]}
                                {i === selectedWordIndices.length - 1 && (
                                  <button onClick={handleWordDeselect} className="text-[var(--text-3)] hover:text-[var(--error)] text-xs">✕</button>
                                )}
                              </span>
                            ))}
                          </div>
                          <button onClick={handleWordDeselect} className="text-xs text-[var(--text-3)] hover:text-[var(--error)] mt-2">
                            ← تراجع عن آخر كلمة
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  {/*
                    حقل إدخال يدوي — يظهر في:
                    - المستوى ٣ (كلمتان ناقصتان)
                    - المستوى ٤ مرحلة B (4B: استحضار يدوي)
                    - المستوى ٥ (كتابة البيت كاملًا)
                    لا يظهر في:
                    - المستوى ١ (اختيار من متعدد)
                    - المستوى ٢ (ترتيب بالضغط فقط)
                    - المستوى ٤ مرحلة A (4A: بنك كلمات فقط)
                  */}
                  {!currentExercise.choices && !(currentExercise.scrambledWords && (currentExercise.level === 2 || (currentExercise.level === 4 && currentExercise.subPhase === 1))) && (
                    <div className="space-y-2">
                      <textarea
                        ref={textareaRef}
                        value={userAnswer}
                        onChange={e => setUserAnswer(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); if (userAnswer.trim()) checkAnswer(); } }}
                        className="w-full px-4 py-3 rounded-xl border border-[var(--border-1)] bg-[var(--bg-0)] text-[var(--text-0)] focus:border-[var(--accent)] focus:ring-1 focus:ring-[var(--accent)] transition-colors outline-none resize-none"
                        style={{ fontFamily: 'var(--font-poem)', fontSize: '1rem', lineHeight: '2', minHeight: '80px' }}
                        placeholder="اكتبي إجابتك هنا..."
                        dir="rtl"
                      />
                    </div>
                  )}

                  {/* زر التحقق */}
                  <div className="flex items-center justify-center gap-3">
                    {currentExercise.hint && (
                      <Button variant="ghost" size="sm" onClick={() => setShowHint(h => !h)}>
                        <Lightbulb size={14} />
                        تلميح
                      </Button>
                    )}
                    <Button
                      variant="primary"
                      onClick={checkAnswer}
                      disabled={
                        !currentExercise.choices &&
                        !(currentExercise.scrambledWords && selectedWordIndices.length > 0) &&
                        !userAnswer.trim()
                      }
                    >
                      تحقق
                    </Button>
                  </div>

                  {/* التلميح */}
                  {showHint && currentExercise.hint && (
                    <div className="text-center text-sm text-[var(--text-2)] p-3 rounded-lg bg-[var(--bg-1)] animate-fade-in">
                      💡 {currentExercise.hint}
                    </div>
                  )}
                </div>
              ) : (
                /* ===== النتيجة ===== */
                <div className="animate-fade-in text-center space-y-4">
                  <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium ${
                    resultQuality === 'mastered' ? 'bg-[var(--success-light)] text-[var(--success)]' :
                    resultQuality === 'correct' ? 'bg-[var(--success-light)] text-[var(--success)]' :
                    resultQuality === 'review' ? 'bg-[var(--warning-light)] text-[var(--warning)]' :
                    'bg-[var(--error-light)] text-[var(--error)]'
                  }`}>
                    {resultQuality === 'mastered' && '✓ متقن!'}
                    {resultQuality === 'correct' && '✓ صحيح'}
                    {resultQuality === 'review' && '~ يحتاج مراجعة'}
                    {resultQuality === 'wrong' && '✗ خطأ'}
                  </div>

                  {/* الإجابة الصحيحة مع الفروق */}
                  {diffTokens.length > 0 && (
                    <div className="p-4 rounded-xl bg-[var(--bg-1)] border border-[var(--border-0)]" style={{ fontFamily: 'var(--font-poem)', fontSize: '1rem', lineHeight: '2' }}>
                      {diffTokens.map((token, i) => (
                        <span key={i} className={
                          token.type === 'correct' ? 'diff-correct' :
                          token.type === 'missing' ? 'diff-missing' :
                          token.type === 'extra' ? 'diff-error' :
                          'diff-error'
                        }>
                          {token.text}{' '}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* الإجابة الصحيحة الكاملة */}
                  <div className="p-3 rounded-lg bg-[var(--bg-1)]" style={{ fontFamily: 'var(--font-poem)', fontSize: '0.95rem', lineHeight: '1.8', color: 'var(--text-1)' }}>
                    <p className="text-[11px] text-[var(--text-3)] mb-1">الإجابة الصحيحة:</p>
                    {currentExercise.answer}
                  </div>

                  <Button variant="primary" onClick={handleNextExercise}>
                    التالي ←
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* ===== SESSION COMPLETE ===== */}
          {phase === 'session_complete' && (
            <div className="animate-fade-in text-center py-12">
              <div className="w-16 h-16 rounded-full bg-[var(--success-light)] flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">✓</span>
              </div>
              <h2 className="text-xl font-semibold text-[var(--text-0)] mb-2">اكتملت الجلسة!</h2>
              <p className="text-sm text-[var(--text-2)] mb-6">{poem.title}</p>

              <div className="flex items-center justify-center gap-6 mb-8">
                <div className="text-center">
                  <p className="text-2xl font-semibold text-[var(--success)]">{correctCount}</p>
                  <p className="text-xs text-[var(--text-3)]">صحيح</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-[var(--error)]">{errorCount}</p>
                  <p className="text-xs text-[var(--text-3)]">خطأ</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-[var(--text-0)]">{versesCompleted}</p>
                  <p className="text-xs text-[var(--text-3)]">أبيات</p>
                </div>
              </div>

              <Button variant="primary" onClick={onClose}>
                عودة
              </Button>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
