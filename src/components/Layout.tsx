import { useState, type ReactNode } from 'react';
import { Home, BookOpen, BarChart3, Settings, Menu, X, Moon, Sun, PenLine } from 'lucide-react';

type Page = 'home' | 'poems' | 'session' | 'stats' | 'settings';

interface Props {
  currentPage: Page;
  onNavigate: (page: Page) => void;
  darkMode: boolean;
  onToggleDark: () => void;
  children: ReactNode;
}

const navItems: Array<{ id: Page; icon: typeof Home; label: string }> = [
  { id: 'home', icon: Home, label: 'الرئيسية' },
  { id: 'poems', icon: BookOpen, label: 'قصائدي' },
  { id: 'stats', icon: BarChart3, label: 'الإحصائيات' },
  { id: 'settings', icon: Settings, label: 'الإعدادات' },
];

export default function Layout({ currentPage, onNavigate, darkMode, onToggleDark, children }: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="min-h-screen flex bg-[var(--bg-0)]">
      {/* Sidebar - Desktop */}
      <aside className="hidden lg:flex flex-col w-56 border-l border-[var(--border-0)] bg-[var(--bg-1)] shrink-0">
        <div className="p-4 pb-6">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-[var(--accent-light)] flex items-center justify-center">
              <PenLine size={14} className="text-[var(--accent)]" strokeWidth={1.8} />
            </div>
            <div>
              <h1 className="text-lg font-bold text-[var(--text-0)] leading-tight" style={{ fontFamily: 'var(--font-brand)' }}>مَدَارِج</h1>
              <p className="text-[10px] text-[var(--text-3)] -mt-0.5">حفظُ القصائد العربية</p>
            </div>
          </div>
        </div>

        <nav className="flex-1 px-2 space-y-0.5">
          {navItems.map(item => (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                currentPage === item.id
                  ? 'bg-[var(--accent-light)] text-[var(--accent-text)] font-medium'
                  : 'text-[var(--text-2)] hover:text-[var(--text-0)] hover:bg-[var(--bg-2)]'
              }`}
            >
              <item.icon size={16} strokeWidth={currentPage === item.id ? 2 : 1.5} />
              {item.label}
            </button>
          ))}
        </nav>

        <div className="p-3 border-t border-[var(--border-0)] space-y-1">
          <button
            onClick={onToggleDark}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-2)] hover:text-[var(--text-0)] hover:bg-[var(--bg-2)] transition-all duration-150"
          >
            {darkMode ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
            {darkMode ? 'وضع نهاري' : 'وضع ليلي'}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="w-64 bg-[var(--bg-1)] border-l border-[var(--border-0)] flex flex-col animate-slide-in">
            <div className="p-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-md bg-[var(--accent-light)] flex items-center justify-center">
                  <PenLine size={12} className="text-[var(--accent)]" strokeWidth={1.8} />
                </div>
                <h1 className="text-base font-bold text-[var(--text-0)]" style={{ fontFamily: 'var(--font-brand)' }}>مَدَارِج</h1>
              </div>
              <button onClick={() => setSidebarOpen(false)} className="text-[var(--text-2)] hover:text-[var(--text-0)]">
                <X size={18} />
              </button>
            </div>
            <nav className="flex-1 px-2 space-y-0.5">
              {navItems.map(item => (
                <button
                  key={item.id}
                  onClick={() => { onNavigate(item.id); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-all duration-150 ${
                    currentPage === item.id
                      ? 'bg-[var(--accent-light)] text-[var(--accent-text)] font-medium'
                      : 'text-[var(--text-2)] hover:text-[var(--text-0)] hover:bg-[var(--bg-2)]'
                  }`}
                >
                  <item.icon size={16} strokeWidth={1.5} />
                  {item.label}
                </button>
              ))}
            </nav>
            <div className="p-3 border-t border-[var(--border-0)]">
              <button onClick={onToggleDark} className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-[var(--text-2)] hover:bg-[var(--bg-2)]">
                {darkMode ? <Sun size={16} strokeWidth={1.5} /> : <Moon size={16} strokeWidth={1.5} />}
                {darkMode ? 'وضع نهاري' : 'وضع ليلي'}
              </button>
            </div>
          </div>
          <div className="flex-1 bg-black/40" onClick={() => setSidebarOpen(false)} />
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile top bar */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 border-b border-[var(--border-0)] bg-[var(--bg-0)]">
          <button onClick={() => setSidebarOpen(true)} className="text-[var(--text-1)] hover:text-[var(--text-0)]">
            <Menu size={20} strokeWidth={1.5} />
          </button>
            <div className="flex items-center gap-1.5">
              <PenLine size={12} className="text-[var(--accent)]" strokeWidth={1.8} />
              <h1 className="text-sm font-bold text-[var(--text-0)]" style={{ fontFamily: 'var(--font-brand)' }}>مَدَارِج</h1>
            </div>
          <button onClick={onToggleDark} className="text-[var(--text-2)] hover:text-[var(--text-0)]">
            {darkMode ? <Sun size={18} strokeWidth={1.5} /> : <Moon size={18} strokeWidth={1.5} />}
          </button>
        </header>

        {/* Page content — مع هوامش متجاوبة */}
        <main className="flex-1 overflow-y-auto page-container">
          {children}
        </main>
      </div>
    </div>
  );
}
