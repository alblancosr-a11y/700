import type { AppSettings } from '../lib/types';

interface Props { settings: AppSettings; onUpdate: (s: Partial<AppSettings>) => void; onClose: () => void; }

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button onClick={() => onChange(!value)} className={`relative inline-flex w-9 h-5 rounded-full transition-all duration-200 shrink-0 ${value ? 'bg-[var(--accent)]' : 'bg-[var(--bg-3)]'}`}>
      <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow-sm transition-all duration-200 ${value ? 'right-0.5' : 'right-auto left-0.5'}`} />
    </button>
  );
}

function Setting({ label, desc, children }: { label: string; desc: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 py-3">
      <div><p className="text-sm text-[var(--text-0)]">{label}</p><p className="text-[11px] text-[var(--text-3)]">{desc}</p></div>
      {children}
    </div>
  );
}

export default function SettingsPanel({ settings, onUpdate, onClose }: Props) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="w-full max-w-md bg-[var(--bg-1)] border border-[var(--border-0)] rounded-xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="p-4 divide-y divide-[var(--border-0)]">
          <Setting label="الوضع الليلي" desc="تصميم داكن مريح للعينين">
            <Toggle value={settings.darkMode} onChange={v => onUpdate({ darkMode: v })} />
          </Setting>
          <Setting label="حجم الخط" desc="حجم نص الأبيات">
            <div className="flex gap-1">
              {[1, 2, 3].map(s => (
                <button key={s} onClick={() => onUpdate({ fontSize: s })} className={`px-2.5 py-1 rounded-md text-xs transition-all ${settings.fontSize === s ? 'bg-[var(--accent)] text-white' : 'bg-[var(--bg-2)] text-[var(--text-2)]'}`}>{s === 1 ? 'ص' : s === 2 ? 'م' : 'ك'}</button>
              ))}
            </div>
          </Setting>
          <Setting label="التشكيل إلزامي" desc="مطابقة التشكيل في الاختبارات">
            <Toggle value={settings.requireTashkeel} onChange={v => onUpdate({ requireTashkeel: v })} />
          </Setting>
          <Setting label="أرقام الأبيات" desc="إظهار رقم البيت في وضع القراءة">
            <Toggle value={settings.showVerseNumbers} onChange={v => onUpdate({ showVerseNumbers: v })} />
          </Setting>
          <Setting label="سرعة القراءة" desc={`${settings.speechRate}x`}>
            <input type="range" min="0.5" max="1.5" step="0.1" value={settings.speechRate} onChange={e => onUpdate({ speechRate: Number(e.target.value) })} className="w-20 accent-[var(--accent)]" />
          </Setting>
          <Setting label="نبرة الصوت" desc={`${settings.speechPitch}`}>
            <input type="range" min="0.5" max="2" step="0.1" value={settings.speechPitch} onChange={e => onUpdate({ speechPitch: Number(e.target.value) })} className="w-20 accent-[var(--accent)]" />
          </Setting>
        </div>
        <div className="px-4 py-3 border-t border-[var(--border-0)]">
          <p className="text-[11px] text-[var(--text-3)] text-center">البيانات محفوظة محليًا في المتصفح</p>
        </div>
      </div>
    </div>
  );
}
