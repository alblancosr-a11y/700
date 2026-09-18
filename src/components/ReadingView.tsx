import { useState, useCallback, useEffect } from 'react';
import { X, Minus, Plus, Volume2, VolumeX, Eye, EyeOff, BarChart3 } from 'lucide-react';
import type { Poem, PoemStats, AppSettings } from '../lib/types';
import { removeTashkeel } from '../lib/poem-parser';
import { getStabilityLabel } from '../lib/algorithm';

interface Props { poem: Poem; stats: PoemStats | undefined; settings: AppSettings; onClose: () => void; }

function findArabicVoice() { if (!('speechSynthesis' in window)) return null; const v = window.speechSynthesis.getVoices(); return v.find(x => x.lang === 'ar-SA') || v.find(x => x.lang === 'ar-EG') || v.find(x => x.lang.startsWith('ar')) || null; }

export default function ReadingView({ poem, stats, settings, onClose }: Props) {
  const [fontSize, setFontSize] = useState(settings.fontSize);
  const [showTashkeel, setShowTashkeel] = useState(true);
  const [showNumbers, setShowNumbers] = useState(settings.showVerseNumbers);
  const [showStability, setShowStability] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [ttsAvailable, setTtsAvailable] = useState(false);

  const fontSizes = ['1.1rem', '1.4rem', '1.7rem'];
  const fs = fontSizes[fontSize - 1] || '1.4rem';

  useEffect(() => {
    if (!('speechSynthesis' in window)) { setTtsAvailable(false); return; }
    const check = () => setTtsAvailable(window.speechSynthesis.getVoices().length > 0);
    check(); window.speechSynthesis.onvoiceschanged = check; setTimeout(check, 500);
  }, []);

  const speak = useCallback((text: string) => {
    if (!('speechSynthesis' in window)) return; window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.lang = 'ar-SA'; u.rate = settings.speechRate; u.pitch = settings.speechPitch; u.volume = 1;
    const v = findArabicVoice(); if (v) u.voice = v;
    u.onstart = () => setSpeaking(true); u.onend = () => setSpeaking(false); u.onerror = () => setSpeaking(false);
    try { window.speechSynthesis.speak(u); } catch {}
  }, [settings]);

  const stopSpeaking = useCallback(() => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); setSpeaking(false); }, []);
  useEffect(() => { return () => { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); }; }, []);

  return (
    <div className="fixed inset-0 z-50 bg-[var(--bg-0)] flex flex-col">
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[var(--border-0)]">
        <button onClick={onClose} className="p-1.5 rounded-md text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]"><X size={16} strokeWidth={1.5} /></button>
        <div className="text-center">
          <p className="text-xs font-medium text-[var(--text-0)]">{poem.title}</p>
          <p className="text-[11px] text-[var(--text-3)]">{poem.poet}</p>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setFontSize(f => Math.max(1, f - 1))} className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)] disabled:opacity-30" disabled={fontSize <= 1}><Minus size={12} /></button>
          <button onClick={() => setFontSize(f => Math.min(3, f + 1))} className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)] disabled:opacity-30" disabled={fontSize >= 3}><Plus size={12} /></button>
          <button onClick={() => setShowTashkeel(s => !s)} className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]">{showTashkeel ? <EyeOff size={12} /> : <Eye size={12} />}</button>
          <button onClick={() => setShowNumbers(s => !s)} className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)] text-[10px]">#</button>
          <button onClick={() => setShowStability(s => !s)} className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]"><BarChart3 size={12} strokeWidth={1.5} /></button>
          {ttsAvailable && <button onClick={() => speaking ? stopSpeaking() : speak(poem.verses.map(v => v.text).join('. '))} className="p-1 rounded text-[var(--text-3)] hover:text-[var(--text-1)] hover:bg-[var(--bg-2)]">{speaking ? <VolumeX size={12} /> : <Volume2 size={12} />}</button>}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto session-content">
        <div className="max-w-2xl mx-auto py-10">
          <div className="text-center mb-10">
            <h1 className="text-xl font-semibold text-[var(--text-0)] mb-1" style={{ fontFamily: 'var(--font-ui)' }}>{poem.title}</h1>
            <p className="text-sm text-[var(--text-2)]">{poem.poet}</p>
            <div className="flex items-center justify-center gap-4 my-6 text-[var(--border-1)]"><span className="h-px flex-1" /><span className="text-xs">✦</span><span className="h-px flex-1" /></div>
          </div>

          <div className="space-y-1">
            {poem.verses.map(verse => {
              const vs = stats?.verses[verse.index];
              const stability = vs?.memory.standalone || 'new';
              return (
                <div key={verse.index} className="flex items-center gap-3 py-2 px-3 rounded-lg transition-colors hover:bg-[var(--bg-1)]">
                  {showNumbers && <span className="verse-num">{verse.index + 1}</span>}
                  <div className="flex-1 text-center" style={{ fontFamily: 'var(--font-poem)', fontSize: fs, lineHeight: '2.2', color: 'var(--text-0)' }}>
                    {verse.ajar ? (
                      <>{showTashkeel ? verse.sadr : removeTashkeel(verse.sadr)}<span className="text-[var(--border-1)] mx-3 text-sm">✦</span>{showTashkeel ? verse.ajar : removeTashkeel(verse.ajar)}</>
                    ) : (showTashkeel ? verse.text : removeTashkeel(verse.text))}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {showStability && <span className="text-[10px] text-[var(--text-3)]">{getStabilityLabel(stability)}</span>}
                    {ttsAvailable && <button onClick={() => speak(verse.text)} className="p-0.5 rounded text-[var(--text-3)] hover:text-[var(--text-1)] opacity-0 group-hover:opacity-100"><Volume2 size={10} strokeWidth={1.5} /></button>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
