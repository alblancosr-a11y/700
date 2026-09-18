import { X, Play, RefreshCw, Navigation, ChevronRight } from 'lucide-react';
import type { Poem, PoemStats } from '../lib/types';
import { getOverallProgress } from '../lib/algorithm';
import { ProgressBar } from '../ui';

type Mode = 'cumulative' | 'chain' | 'continue_from' | 'where_am_i' | 'review';
interface Props { poem: Poem; stats: PoemStats | undefined; onStart: (mode: Mode, opts?: { startFromVerse?: number; newVerseIndex?: number }) => void; onClose: () => void; }

export default function SessionStartModal({ poem, stats, onStart, onClose }: Props) {
  const total = poem.verses.length;
  const maxVerse = poem.currentVerseIndex;
  const progress = stats ? getOverallProgress(stats.verses, total) : { mastered: 0, strong: 0, medium: 0, weak: 0, learning: 0, newCount: total };
  const learnedPct = Math.round(((progress.mastered + progress.strong) / Math.max(total, 1)) * 100);

  const modes: Array<{ id: Mode; icon: typeof Play; title: string; desc: string; disabled?: boolean; primary?: boolean }> = [
    { id: 'cumulative', icon: Play, title: 'حفظ تراكمي', desc: 'عرض كل بيت ثم حفظه بأساليب متنوعة', primary: true },
    { id: 'chain', icon: RefreshCw, title: 'اختبار السلسلة', desc: 'اختبري القصيدة كاملة', disabled: maxVerse < 1 },
    { id: 'review', icon: RefreshCw, title: 'مراجعة شاملة', desc: 'راجعي جميع الأبيات المحفوظة', disabled: maxVerse < 1 },
    { id: 'where_am_i', icon: Navigation, title: 'أين أنا؟', desc: 'اختبار موضع الأبيات', disabled: maxVerse < 2 },
  ];

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="w-full max-w-md bg-[var(--bg-1)] border border-[var(--border-0)] rounded-xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-0)]">
          <div>
            <h2 className="text-sm font-semibold text-[var(--text-0)]">ابدئي جلسة الحفظ</h2>
            <p className="text-[11px] text-[var(--text-3)]">{poem.title} · البيت {maxVerse + 1}/{total}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded-md text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]"><X size={14} strokeWidth={1.5} /></button>
        </div>
        <div className="px-4 py-3 border-b border-[var(--border-0)]">
          <ProgressBar value={learnedPct} className="mb-1" />
          <div className="flex gap-3 text-[11px] text-[var(--text-3)]">
            <span>متقن: {progress.mastered}</span><span>ثابت: {progress.strong}</span><span>جديد: {progress.newCount}</span>
          </div>
        </div>
        <div className="p-4 space-y-2">
          {modes.map(m => (
            <button
              key={m.id}
              onClick={() => !m.disabled && onStart(m.id)}
              disabled={m.disabled}
              className={`w-full flex items-center gap-3 p-3 rounded-lg border text-right transition-all ${m.disabled ? 'opacity-30 cursor-not-allowed' : 'hover:border-[var(--border-1)] hover:bg-[var(--bg-2)] cursor-pointer'} ${m.primary ? 'border-[var(--accent)] bg-[var(--accent-light)]' : 'border-[var(--border-0)]'}`}
            >
              <m.icon size={16} className={m.primary ? 'text-[var(--accent)]' : 'text-[var(--text-3)]'} strokeWidth={1.5} />
              <div className="flex-1">
                <p className={`text-sm ${m.primary ? 'font-medium text-[var(--accent-text)]' : 'text-[var(--text-0)]'}`}>{m.title}</p>
                <p className="text-[11px] text-[var(--text-3)]">{m.desc}</p>
              </div>
              {!m.disabled && <ChevronRight size={14} className="text-[var(--text-3)]" strokeWidth={1.5} />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
