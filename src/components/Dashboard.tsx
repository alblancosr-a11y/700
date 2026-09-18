import { BookOpen, Clock, CheckCircle2, Play } from 'lucide-react';
import type { Poem, AppState } from '../lib/types';
import { getOverallProgress } from '../lib/algorithm';
import { Card, ProgressBar, Button, Badge } from '../ui';

interface Props {
  state: AppState;
  onStudy: (poem: Poem) => void;
  onNavigate: (page: string) => void;
}

export default function Dashboard({ state, onStudy, onNavigate }: Props) {
  const { poems, stats } = state;
  const now = Date.now();

  let totalVerses = 0;
  let masteredVerses = 0;
  let dueForReview = 0;
  for (const poem of poems) {
    totalVerses += poem.verses.length;
    const pStats = stats[poem.id];
    if (pStats) {
      const p = getOverallProgress(pStats.verses, poem.verses.length);
      masteredVerses += p.mastered + p.strong;
      if (Object.values(pStats.verses).some(v => now >= v.nextReviewAt)) dueForReview++;
    }
  }
  const masteryRate = totalVerses > 0 ? Math.round((masteredVerses / totalVerses) * 100) : 0;

  const lastStudied = [...poems].sort((a, b) => (b.lastSession || 0) - (a.lastSession || 0))[0];

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'صباح الخير';
    if (h < 18) return 'مساء الخير';
    return 'مساء الخير';
  };

  return (
    <div className="max-w-4xl mx-auto py-8 lg:py-12">
      {/* Greeting */}
      <div className="mb-8">
        <h2 className="text-2xl font-semibold text-[var(--text-0)] mb-1">{greeting()}</h2>
        <p className="text-sm text-[var(--text-2)]">
          {poems.length === 0 ? 'أضيفي قصيدة وابدئي رحلة الحفظ' : 'واصلي رحلة حفظ القصائد العربية'}
        </p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-8">
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <BookOpen size={14} className="text-[var(--text-3)]" strokeWidth={1.5} />
            <span className="text-[11px] text-[var(--text-3)]">القصائد</span>
          </div>
          <p className="text-2xl font-semibold text-[var(--text-0)]">{poems.length}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle2 size={14} className="text-[var(--text-3)]" strokeWidth={1.5} />
            <span className="text-[11px] text-[var(--text-3)]">أبيات متقنة</span>
          </div>
          <p className="text-2xl font-semibold text-[var(--text-0)]">{masteredVerses}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <Clock size={14} className="text-[var(--text-3)]" strokeWidth={1.5} />
            <span className="text-[11px] text-[var(--text-3)]">للمراجعة</span>
          </div>
          <p className="text-2xl font-semibold text-[var(--text-0)]">{dueForReview}</p>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="text-[11px] text-[var(--text-3)]">معدل الإتقان</span>
          </div>
          <p className="text-2xl font-semibold text-[var(--text-0)]">{masteryRate}%</p>
        </Card>
      </div>

      {/* Continue studying */}
      {lastStudied && (
        <div className="mb-8">
          <h3 className="text-sm font-medium text-[var(--text-1)] mb-3">متابعة الحفظ</h3>
          <Card hover className="p-4" onClick={() => onStudy(lastStudied)}>
            <div className="flex items-center justify-between mb-3">
              <div>
                <p className="font-medium text-[var(--text-0)] mb-0.5" style={{ fontFamily: 'var(--font-ui)' }}>{lastStudied.title}</p>
                <p className="text-xs text-[var(--text-2)]">{lastStudied.poet}</p>
              </div>
              <Button variant="primary" size="sm" onClick={(e: React.MouseEvent) => { e.stopPropagation(); onStudy(lastStudied); }}>
                <Play size={14} strokeWidth={2} />
                متابعة
              </Button>
            </div>
            <div className="flex items-center gap-3">
              <ProgressBar value={(() => {
                const pStats = stats[lastStudied.id];
                if (!pStats) return 0;
                const p = getOverallProgress(pStats.verses, lastStudied.verses.length);
                return Math.round(((p.mastered + p.strong) / lastStudied.verses.length) * 100);
              })()} className="flex-1" />
              <span className="text-xs text-[var(--text-2)] tabular-nums">
                {Math.min(lastStudied.currentVerseIndex + 1, lastStudied.verses.length)} من {lastStudied.verses.length}
              </span>
            </div>
          </Card>
        </div>
      )}

      {/* Poems list */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-[var(--text-1)]">قصائدك</h3>
          <Button variant="ghost" size="sm" onClick={() => onNavigate('poems')}>
            عرض الكل ←
          </Button>
        </div>

        {poems.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-sm text-[var(--text-2)] mb-2">لم تضيفي أي قصيدة بعد</p>
            <p className="text-xs text-[var(--text-3)] mb-6">أضيفي أول قصيدة وابدئي رحلة حفظها</p>
            <Button variant="primary" onClick={() => onNavigate('poems')}>إضافة قصيدة</Button>
          </div>
        ) : (
          <div className="space-y-2">
            {poems.slice(0, 5).map(poem => {
              const pStats = stats[poem.id];
              const progress = pStats ? getOverallProgress(pStats.verses, poem.verses.length) : null;
              const learnedPct = progress ? Math.round(((progress.mastered + progress.strong) / poem.verses.length) * 100) : 0;
              return (
                <Card hover key={poem.id} className="p-3 px-4" onClick={() => onStudy(poem)}>
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-[var(--text-0)] truncate">{poem.title}</p>
                      <p className="text-xs text-[var(--text-2)]">{poem.poet} · {poem.verses.length} بيت</p>
                    </div>
                    <div className="flex items-center gap-3 w-32 lg:w-48">
                      <ProgressBar value={learnedPct} className="flex-1" />
                      <span className="text-xs text-[var(--text-2)] tabular-nums w-8 text-left">{learnedPct}%</span>
                    </div>
                    {progress && progress.mastered > 0 && (
                      <Badge variant="success">{progress.mastered} متقن</Badge>
                    )}
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
