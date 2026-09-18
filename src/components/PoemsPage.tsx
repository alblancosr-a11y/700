import { Plus, MoreHorizontal, Play, BookOpen, Trash2, BarChart3 } from 'lucide-react';
import { useState } from 'react';
import type { Poem, AppState } from '../lib/types';
import { getOverallProgress } from '../lib/algorithm';
import { Card, ProgressBar, Button, Badge } from '../ui';

interface Props {
  state: AppState;
  onAdd: () => void;
  onStudy: (poem: Poem) => void;
  onRead: (poem: Poem) => void;
  onStats: (poem: Poem) => void;
  onDelete: (poem: Poem) => void;
}

export default function PoemsPage({ state, onAdd, onStudy, onRead, onStats, onDelete }: Props) {
  const { poems, stats } = state;
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  return (
    <div className="max-w-4xl mx-auto py-8 lg:py-12">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-semibold text-[var(--text-0)] mb-0.5">قصائدي</h2>
          <p className="text-xs text-[var(--text-2)]">{poems.length} {poems.length === 1 ? 'قصيدة' : 'قصائد'}</p>
        </div>
        <Button variant="primary" size="sm" onClick={onAdd}>
          <Plus size={14} strokeWidth={2} />
          إضافة قصيدة
        </Button>
      </div>

      {poems.length === 0 ? (
        <div className="text-center py-20">
          <div className="w-12 h-12 rounded-xl bg-[var(--bg-2)] flex items-center justify-center mx-auto mb-4">
            <BookOpen size={20} className="text-[var(--text-3)]" strokeWidth={1.5} />
          </div>
          <p className="text-sm text-[var(--text-1)] mb-1">لم تضيفي أي قصيدة بعد</p>
          <p className="text-xs text-[var(--text-3)] mb-6">أضيفي قصيدة وابدئي حفظها بالتكرار المتباعد</p>
          <Button variant="primary" onClick={onAdd}>إضافة قصيدة</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {poems.map(poem => {
            const pStats = stats[poem.id];
            const progress = pStats ? getOverallProgress(pStats.verses, poem.verses.length) : null;
            const learnedPct = progress ? Math.round(((progress.mastered + progress.strong) / poem.verses.length) * 100) : 0;
            const currentVerse = Math.min(poem.currentVerseIndex + 1, poem.verses.length);
            const isDue = pStats && Object.values(pStats.verses).some(v => Date.now() >= v.nextReviewAt);

            return (
              <Card key={poem.id} className="p-4">
                <div className="flex items-start gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-sm font-medium text-[var(--text-0)] truncate">{poem.title}</h3>
                      {isDue && <Badge variant="warning">للمراجعة</Badge>}
                    </div>
                    <p className="text-xs text-[var(--text-2)] mb-3">{poem.poet} · {poem.verses.length} بيت · البيت {currentVerse}</p>

                    {/* Preview */}
                    {poem.verses[0] && (
                      <p className="text-xs text-[var(--text-2)] mb-3 truncate leading-loose" style={{ fontFamily: 'var(--font-poem)', lineHeight: '1.8' }}>
                        {poem.verses[0].sadr}
                        {poem.verses[0].ajar && <span className="text-[var(--text-3)] mx-2">◇</span>}
                        {poem.verses[0].ajar}
                      </p>
                    )}

                    <div className="flex items-center gap-3">
                      <ProgressBar value={learnedPct} className="flex-1 max-w-48" />
                      <span className="text-xs text-[var(--text-2)] tabular-nums">{learnedPct}%</span>
                      {progress && progress.mastered > 0 && (
                        <Badge variant="success">{progress.mastered} متقن</Badge>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 shrink-0">
                    <Button variant="primary" size="sm" onClick={() => onStudy(poem)}>
                      <Play size={12} strokeWidth={2} />
                      حفظ
                    </Button>
                    <button
                      onClick={() => setMenuOpen(menuOpen === poem.id ? null : poem.id)}
                      className="p-1.5 rounded-md text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)] transition-all"
                    >
                      <MoreHorizontal size={14} strokeWidth={1.5} />
                    </button>
                  </div>
                </div>

                {/* Dropdown menu */}
                {menuOpen === poem.id && (
                  <div className="mt-3 pt-3 border-t border-[var(--border-0)] flex items-center gap-2 animate-fade-in">
                    <Button variant="ghost" size="sm" onClick={() => { onRead(poem); setMenuOpen(null); }}>
                      <BookOpen size={12} strokeWidth={1.5} />
                      قراءة
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { onStats(poem); setMenuOpen(null); }}>
                      <BarChart3 size={12} strokeWidth={1.5} />
                      إحصائيات
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => { onDelete(poem); setMenuOpen(null); }} className="text-[var(--error)] hover:text-[var(--error)]">
                      <Trash2 size={12} strokeWidth={1.5} />
                      حذف
                    </Button>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
