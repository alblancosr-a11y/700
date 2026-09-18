import { useState, useEffect, useCallback } from 'react';
import type { Poem, VerseStats } from './lib/types';
import { useAppState } from './hooks/useAppState';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import PoemsPage from './components/PoemsPage';
import AddPoemModal from './components/AddPoemModal';
import SessionStartModal from './components/SessionStartModal';
import SessionView from './components/SessionView';
import ReadingView from './components/ReadingView';
import StatsView from './components/StatsView';
import SettingsPanel from './components/SettingsPanel';

type Page = 'home' | 'poems' | 'session' | 'stats' | 'settings';
type Modal =
  | { type: 'none' }
  | { type: 'add' }
  | { type: 'edit'; poem: Poem }
  | { type: 'session_start'; poem: Poem }
  | { type: 'session'; poem: Poem; mode: 'cumulative' | 'chain' | 'continue_from' | 'where_am_i' | 'review'; startFromVerse?: number; newVerseIndex?: number }
  | { type: 'reading'; poem: Poem }
  | { type: 'stats'; poem: Poem }
  | { type: 'settings' }
  | { type: 'delete_confirm'; poem: Poem };

export default function App() {
  const { state, updateSettings, addPoem, updatePoem, deletePoem, updateVerseStats, updateSessionStats, updateCurrentVerse, setActiveSession } = useAppState();
  const [page, setPage] = useState<Page>('home');
  const [modal, setModal] = useState<Modal>({ type: 'none' });

  // Dark mode
  useEffect(() => {
    if (!state) return;
    document.body.classList.toggle('dark', state.settings.darkMode);
  }, [state?.settings.darkMode]);

  const handleAddPoem = useCallback((poem: Poem) => { addPoem(poem); }, [addPoem]);
  const handleEditPoem = useCallback((poem: Poem) => { updatePoem(poem); }, [updatePoem]);
  const handleDeletePoem = useCallback((poemId: string) => { deletePoem(poemId); setModal({ type: 'none' }); }, [deletePoem]);
  const handleStartSession = useCallback((poem: Poem, mode: 'cumulative' | 'chain' | 'continue_from' | 'where_am_i' | 'review', opts?: { startFromVerse?: number; newVerseIndex?: number }) => {
    setActiveSession(poem.id);
    setModal({ type: 'session', poem, mode, startFromVerse: opts?.startFromVerse, newVerseIndex: opts?.newVerseIndex });
  }, [setActiveSession]);
  const handleVerseUpdate = useCallback((poemId: string, vs: VerseStats) => { updateVerseStats(poemId, vs); }, [updateVerseStats]);
  const handleSessionComplete = useCallback((poemId: string, correct: number, errors: number) => { updateSessionStats(poemId, correct, errors); setActiveSession(null); setModal({ type: 'none' }); }, [updateSessionStats, setActiveSession]);
  const handleCurrentVerseUpdate = useCallback((poemId: string, idx: number) => { updateCurrentVerse(poemId, idx); }, [updateCurrentVerse]);

  const openStudy = useCallback((poem: Poem) => { setModal({ type: 'session_start', poem }); }, []);

  if (!state) {
    return <div className="min-h-screen flex items-center justify-center bg-[var(--bg-0)]"><p className="text-sm text-[var(--text-3)]">جارٍ التحميل...</p></div>;
  }

  const { poems, stats, settings } = state;

  const renderPage = () => {
    switch (page) {
      case 'home':
        return <Dashboard state={state} onStudy={openStudy} onNavigate={(p) => setPage(p as Page)} />;
      case 'poems':
        return (
          <PoemsPage
            state={state}
            onAdd={() => setModal({ type: 'add' })}
            onStudy={openStudy}
            onRead={(poem) => setModal({ type: 'reading', poem })}
            onStats={(poem) => setModal({ type: 'stats', poem })}
            onDelete={(poem) => setModal({ type: 'delete_confirm', poem })}
          />
        );
      case 'stats':
        return (
          <div className="max-w-4xl mx-auto py-8 lg:py-12">
            <h2 className="text-lg font-semibold text-[var(--text-0)] mb-2">الإحصائيات</h2>
            <p className="text-xs text-[var(--text-2)] mb-6">{poems.length} قصيدة · إجمالي الجلسات: {Object.values(stats).reduce((s, p) => s + p.totalSessions, 0)}</p>
            {poems.length === 0 ? (
              <p className="text-sm text-[var(--text-2)]">أضيفي قصيدة أولًا</p>
            ) : (
              <div className="space-y-3">
                {poems.map(poem => (
                  <div key={poem.id} className="p-4 bg-[var(--bg-1)] border border-[var(--border-0)] rounded-xl flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-[var(--text-0)]">{poem.title}</p>
                      <p className="text-xs text-[var(--text-2)]">{poem.poet} · {(stats[poem.id]?.totalSessions || 0)} جلسة</p>
                    </div>
                    <button onClick={() => setModal({ type: 'stats', poem })} className="text-xs text-[var(--accent)] hover:underline">تفاصيل</button>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      case 'settings':
        return (
          <div className="max-w-4xl mx-auto py-8 lg:py-12">
            <h2 className="text-lg font-semibold text-[var(--text-0)] mb-2">الإعدادات</h2>
            <p className="text-xs text-[var(--text-2)] mb-6">تُحفظ تلقائيًا في المتصفح</p>
            <div className="space-y-0 divide-y divide-[var(--border-0)] bg-[var(--bg-1)] border border-[var(--border-0)] rounded-xl p-4">
              <div className="flex items-center justify-between gap-4 py-3">
                <div><p className="text-sm text-[var(--text-0)]">الوضع الليلي</p><p className="text-[11px] text-[var(--text-3)]">تصميم داكن مريح للعينين</p></div>
                <button onClick={() => updateSettings({ darkMode: !settings.darkMode })} className={`relative inline-flex w-9 h-5 rounded-full transition-all duration-200 shrink-0 ${settings.darkMode ? 'bg-[var(--accent)]' : 'bg-[var(--bg-3)]'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${settings.darkMode ? 'right-0.5' : 'right-auto left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <div><p className="text-sm text-[var(--text-0)]">حجم الخط</p><p className="text-[11px] text-[var(--text-3)]">حجم نص الأبيات</p></div>
                <div className="flex gap-1">
                  {[1, 2, 3].map(s => (
                    <button key={s} onClick={() => updateSettings({ fontSize: s })} className={`px-2.5 py-1 rounded-md text-xs transition-all ${settings.fontSize === s ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-2)] text-[var(--text-2)]'}`}>{s === 1 ? 'ص' : s === 2 ? 'م' : 'ك'}</button>
                  ))}
                </div>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <div><p className="text-sm text-[var(--text-0)]">التشكيل إلزامي</p><p className="text-[11px] text-[var(--text-3)]">مطابقة التشكيل في الاختبارات</p></div>
                <button onClick={() => updateSettings({ requireTashkeel: !settings.requireTashkeel })} className={`relative inline-flex w-9 h-5 rounded-full transition-all duration-200 shrink-0 ${settings.requireTashkeel ? 'bg-[var(--accent)]' : 'bg-[var(--bg-3)]'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${settings.requireTashkeel ? 'right-0.5' : 'right-auto left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <div><p className="text-sm text-[var(--text-0)]">أرقام الأبيات</p><p className="text-[11px] text-[var(--text-3)]">إظهار رقم البيت في وضع القراءة</p></div>
                <button onClick={() => updateSettings({ showVerseNumbers: !settings.showVerseNumbers })} className={`relative inline-flex w-9 h-5 rounded-full transition-all duration-200 shrink-0 ${settings.showVerseNumbers ? 'bg-[var(--accent)]' : 'bg-[var(--bg-3)]'}`}>
                  <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${settings.showVerseNumbers ? 'right-0.5' : 'right-auto left-0.5'}`} />
                </button>
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <div><p className="text-sm text-[var(--text-0)]">سرعة القراءة</p><p className="text-[11px] text-[var(--text-3)]">{settings.speechRate}x</p></div>
                <input type="range" min="0.5" max="1.5" step="0.1" value={settings.speechRate} onChange={e => updateSettings({ speechRate: Number(e.target.value) })} className="w-20 accent-[var(--accent)]" />
              </div>
              <div className="flex items-center justify-between gap-4 py-3">
                <div><p className="text-sm text-[var(--text-0)]">نبرة الصوت</p><p className="text-[11px] text-[var(--text-3)]">{settings.speechPitch}</p></div>
                <input type="range" min="0.5" max="2" step="0.1" value={settings.speechPitch} onChange={e => updateSettings({ speechPitch: Number(e.target.value) })} className="w-20 accent-[var(--accent)]" />
              </div>
            </div>
            <p className="text-[11px] text-[var(--text-3)] text-center mt-4">جميع البيانات محفوظة محليًا في المتصفح</p>
          </div>
        );
      default: return null;
    }
  };

  return (
    <>
      <Layout
        currentPage={page}
        onNavigate={(p) => setPage(p as Page)}
        darkMode={settings.darkMode}
        onToggleDark={() => updateSettings({ darkMode: !settings.darkMode })}
      >
        {renderPage()}
      </Layout>

      {/* Modals */}
      {modal.type === 'add' && <AddPoemModal onClose={() => setModal({ type: 'none' })} onAdd={handleAddPoem} />}
      {modal.type === 'edit' && <AddPoemModal onClose={() => setModal({ type: 'none' })} onAdd={handleEditPoem} editPoem={modal.poem} />}
      {modal.type === 'session_start' && <SessionStartModal poem={modal.poem} stats={stats[modal.poem.id]} onStart={(mode, opts) => handleStartSession(modal.poem, mode, opts)} onClose={() => setModal({ type: 'none' })} />}
      {modal.type === 'session' && <SessionView poem={modal.poem} stats={stats[modal.poem.id]} settings={settings} mode={modal.mode} startFromVerse={modal.startFromVerse} newVerseIndex={modal.newVerseIndex} onClose={() => { setActiveSession(null); setModal({ type: 'none' }); }} onVerseUpdate={handleVerseUpdate} onSessionComplete={handleSessionComplete} onCurrentVerseUpdate={handleCurrentVerseUpdate} />}
      {modal.type === 'reading' && <ReadingView poem={modal.poem} stats={stats[modal.poem.id]} settings={settings} onClose={() => setModal({ type: 'none' })} />}
      {modal.type === 'stats' && <StatsView poem={modal.poem} stats={stats[modal.poem.id]} onClose={() => setModal({ type: 'none' })} />}
      {modal.type === 'settings' && <SettingsPanel settings={settings} onUpdate={updateSettings} onClose={() => setModal({ type: 'none' })} />}
      {modal.type === 'delete_confirm' && (
        <div className="modal-overlay" onClick={() => setModal({ type: 'none' })}>
          <div className="w-full max-w-sm bg-[var(--bg-1)] border border-[var(--border-0)] rounded-xl p-6 animate-scale-in" onClick={e => e.stopPropagation()}>
            <h3 className="text-sm font-semibold text-[var(--text-0)] mb-2">حذف القصيدة؟</h3>
            <p className="text-xs text-[var(--text-2)] mb-4">«{modal.poem.title}» ستُحذف نهائيًا</p>
            <div className="flex justify-end gap-2">
              <button onClick={() => setModal({ type: 'none' })} className="px-3 py-1.5 rounded-lg text-xs text-[var(--text-2)] hover:bg-[var(--bg-2)]">إلغاء</button>
              <button onClick={() => handleDeletePoem(modal.poem.id)} className="px-3 py-1.5 rounded-lg text-xs bg-[var(--error)] text-white hover:opacity-90">حذف</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
