import { useState, useEffect } from 'react';
import { X, FileText, User } from 'lucide-react';
import type { Poem, Verse } from '../lib/types';
import { parsePoem } from '../lib/poem-parser';
import { Button, Input, TextArea } from '../ui';

interface Props {
  onClose: () => void;
  onAdd: (poem: Poem) => void;
  editPoem?: Poem;
}

export default function AddPoemModal({ onClose, onAdd, editPoem }: Props) {
  const [title, setTitle] = useState(editPoem?.title || '');
  const [poet, setPoet] = useState(editPoem?.poet || '');
  const [rawText, setRawText] = useState(editPoem?.rawText || '');
  const [verses, setVerses] = useState<Verse[]>(editPoem?.verses || []);
  const [error, setError] = useState('');

  useEffect(() => { setVerses(rawText.trim() ? parsePoem(rawText) : []); }, [rawText]);

  const handleSubmit = () => {
    if (!rawText.trim()) { setError('أدخلي نص القصيدة'); return; }
    if (!verses.length) { setError('لم يُتعرف على أبيات — كل سطرين بيت'); return; }
    onAdd({
      id: editPoem?.id || crypto.randomUUID(), title: title.trim() || 'قصيدة بدون عنوان', poet: poet.trim() || 'شاعر غير معروف',
      rawText: rawText.trim(), verses, createdAt: editPoem?.createdAt || Date.now(), updatedAt: Date.now(),
      currentVerseIndex: editPoem?.currentVerseIndex || 0, lastSession: editPoem?.lastSession || null, studyDays: editPoem?.studyDays || [],
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="w-full max-w-lg bg-[var(--bg-1)] border border-[var(--border-0)] rounded-xl overflow-hidden animate-scale-in" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-[var(--border-0)]">
          <h2 className="text-sm font-semibold text-[var(--text-0)]">{editPoem ? 'تعديل القصيدة' : 'إضافة قصيدة'}</h2>
          <button onClick={onClose} className="p-1 rounded-md text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]"><X size={14} strokeWidth={1.5} /></button>
        </div>
        <div className="p-4 space-y-4 max-h-[70vh] overflow-y-auto">
          <div>
            <label className="block text-xs text-[var(--text-2)] mb-1.5">اسم القصيدة</label>
            <div className="relative">
              <FileText size={14} className="absolute right-3 top-2.5 text-[var(--text-3)]" strokeWidth={1.5} />
              <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="مثال: قصيدة المتنبي" className="pr-8" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-2)] mb-1.5">الشاعر</label>
            <div className="relative">
              <User size={14} className="absolute right-3 top-2.5 text-[var(--text-3)]" strokeWidth={1.5} />
              <Input value={poet} onChange={e => setPoet(e.target.value)} placeholder="مثال: المتنبي" className="pr-8" />
            </div>
          </div>
          <div>
            <label className="block text-xs text-[var(--text-2)] mb-1.5">نص القصيدة</label>
            <p className="text-[11px] text-[var(--text-3)] mb-1.5">كل سطرين = بيت واحد (الأول صدر، الثاني عجز)</p>
            <TextArea value={rawText} onChange={e => { setRawText(e.target.value); setError(''); }} placeholder={"على قدر أهل العزم تأتي عزائمهم\nوعلى قدر أهل الكرم تأتي كرائمهم"} rows={6} dir="rtl" style={{ fontFamily: 'var(--font-poem)', lineHeight: '2' }} />
          </div>
          {verses.length > 0 && (
            <div className="p-3 rounded-lg bg-[var(--accent-light)] border border-[var(--accent)]/20">
              <p className="text-xs font-medium text-[var(--accent-text)] mb-2">{verses.length} بيت</p>
              <div className="max-h-28 overflow-y-auto space-y-0.5" style={{ fontFamily: 'var(--font-poem)' }}>
                {verses.slice(0, 5).map((v, i) => (
                  <p key={i} className="text-[11px] text-[var(--text-2)]">
                    <span className="font-medium">{i + 1}.</span> {v.sadr}{v.ajar ? <span className="text-[var(--text-3)]"> ◇ </span> : ''}{v.ajar}
                  </p>
                ))}
                {verses.length > 5 && <p className="text-[11px] text-[var(--text-3)]">+{verses.length - 5} بيت</p>}
              </div>
            </div>
          )}
          {error && <p className="text-xs text-[var(--error)]">{error}</p>}
        </div>
        <div className="flex justify-end gap-2 p-4 border-t border-[var(--border-0)]">
          <Button variant="ghost" size="sm" onClick={onClose}>إلغاء</Button>
          <Button variant="primary" size="sm" onClick={handleSubmit}>{editPoem ? 'حفظ' : 'إضافة'}</Button>
        </div>
      </div>
    </div>
  );
}
