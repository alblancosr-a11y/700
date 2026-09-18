import { X, Clock, Flame } from 'lucide-react';
import type { Poem, PoemStats } from '../lib/types';
import { getOverallProgress, getStabilityLabel } from '../lib/algorithm';
import { Card, ProgressBar, Badge } from '../ui';

interface Props { poem: Poem; stats: PoemStats | undefined; onClose: () => void; }

function calcStreak(days: string[]): number {
  if (!days.length) return 0;
  const sorted = [...days].sort().reverse();
  const today = new Date().toISOString().split('T')[0];
  let streak = 0, check = today;
  for (const d of sorted) { if (d === check) { streak++; const dt = new Date(check); dt.setDate(dt.getDate() - 1); check = dt.toISOString().split('T')[0]; } else break; }
  return streak;
}

export default function StatsView({ poem, stats, onClose }: Props) {
  const total = poem.verses.length;
  const progress = stats ? getOverallProgress(stats.verses, total) : { mastered: 0, strong: 0, medium: 0, weak: 0, learning: 0, newCount: total };
  const totalSessions = stats?.totalSessions || 0;
  const totalCorrect = stats?.totalCorrect || 0;
  const totalErrors = stats?.totalErrors || 0;
  const totalAttempts = totalCorrect + totalErrors;
  const accuracy = totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : 0;
  const learnedCount = progress.mastered + progress.strong + progress.medium;
  const learnedPct = total > 0 ? Math.round((learnedCount / total) * 100) : 0;
  const daysSince = stats?.lastSession ? Math.floor((Date.now() - stats.lastSession) / 86400000) : null;
  const streak = calcStreak(poem.studyDays);
  const errorVerses = stats ? Object.values(stats.verses).filter(vs => vs.errors > 0).sort((a, b) => b.errors - a.errors).slice(0, 5) : [];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="w-full max-w-lg max-h-[90vh] bg-[var(--bg-1)] border border-[var(--border-0)] rounded-xl overflow-hidden animate-scale-in flex flex-col" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-0)] shrink-0">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-0)]">إحصائيات</h2>
            <p className="text-[11px] text-[var(--text-3)]">{poem.title} — {poem.poet}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]"><X size={14} strokeWidth={1.5} /></button>
        </div>
        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          <div><ProgressBar value={learnedPct} className="mb-1.5" /><p className="text-[11px] text-[var(--text-3)] text-center">{learnedPct}% محفوظ</p></div>
          <div className="grid grid-cols-2 gap-2">
            <Card className="p-3 text-center"><p className="text-lg font-semibold text-[var(--text-0)]">{totalSessions}</p><p className="text-[11px] text-[var(--text-3)]">جلسات</p></Card>
            <Card className="p-3 text-center"><p className="text-lg font-semibold text-[var(--success)]">{accuracy}%</p><p className="text-[11px] text-[var(--text-3)]">دقة</p></Card>
            <Card className="p-3 text-center"><p className="text-lg font-semibold text-[var(--text-0)]">{totalCorrect}</p><p className="text-[11px] text-[var(--text-3)]">صحيح</p></Card>
            <Card className="p-3 text-center"><p className="text-lg font-semibold text-[var(--error)]">{totalErrors}</p><p className="text-[11px] text-[var(--text-3)]">خطأ</p></Card>
          </div>
          <div className="flex gap-3 justify-center">
            <div className="text-center"><Flame size={16} className="mx-auto mb-1 text-[var(--warning)]" strokeWidth={1.5} /><p className="text-sm font-semibold text-[var(--text-0)]">{streak}</p><p className="text-[10px] text-[var(--text-3)]">يوم متتالي</p></div>
            <div className="text-center"><Clock size={16} className="mx-auto mb-1 text-[var(--text-3)]" strokeWidth={1.5} /><p className="text-sm font-semibold text-[var(--text-0)]">{daysSince === null ? '—' : daysSince === 0 ? 'اليوم' : `${daysSince}ي`}</p><p className="text-[10px] text-[var(--text-3)]">منذ آخر جلسة</p></div>
          </div>
          <div>
            <h4 className="text-xs font-medium text-[var(--text-1)] mb-2">مستويات الحفظ</h4>
            <div className="space-y-1">
              {[
                { l: 'متقن', c: progress.mastered, cl: 'text-amber-600' },
                { l: 'ثابت', c: progress.strong, cl: 'text-emerald-600' },
                { l: 'متوسط', c: progress.medium, cl: 'text-violet-600' },
                { l: 'ضعيف', c: progress.weak, cl: 'text-orange-600' },
                { l: 'جديد', c: progress.learning + progress.newCount, cl: 'text-gray-500' },
              ].map(x => (
                <div key={x.l} className="flex items-center justify-between text-xs">
                  <span className={`font-medium ${x.cl}`}>{x.l}</span>
                  <span className="text-[var(--text-2)]">{x.c}</span>
                </div>
              ))}
            </div>
          </div>
          {errorVerses.length > 0 && (
            <div>
              <h4 className="text-xs font-medium text-[var(--text-1)] mb-2">الأبيات الأصعب</h4>
              <div className="space-y-1.5">
                {errorVerses.map(vs => {
                  const v = poem.verses[vs.verseIndex];
                  if (!v) return null;
                  return (
                    <div key={vs.verseIndex} className="p-2 rounded-lg bg-[var(--bg-2)]">
                      <p className="text-[11px] text-[var(--text-1)] truncate" style={{ fontFamily: 'var(--font-poem)' }}>{vs.verseIndex + 1}. {v.text}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="error">{vs.errors} خطأ</Badge>
                        <span className="text-[10px] text-[var(--text-3)]">{getStabilityLabel(vs.memory.standalone)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
