import React, { useEffect, useState, useRef } from 'react';
import api from '../utils/api';
import { PenLine } from 'lucide-react';
import './study-tools.css';

// Single auto-saving scratchpad synced to the backend (so notes survive logout /
// device changes), with a localStorage cache for instant load + offline drafts.
export default function Notes() {
  const [text, setText] = useState('');
  const [noteId, setNoteId] = useState(null);
  const [saved, setSaved] = useState(true);
  const timeoutRef = useRef(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get('/api/notes', { params: { subject: 'General', topic: 'Scratchpad' } });
        if (cancelled) return;
        const note = (res.data.notes || [])[0];
        if (note) { setText(note.content || ''); setNoteId(note._id); }
        else { setText(localStorage.getItem('notes:draft') || ''); }
      } catch (e) {
        if (!cancelled) setText(localStorage.getItem('notes:draft') || '');
      }
    })();
    return () => { cancelled = true; if (timeoutRef.current) clearTimeout(timeoutRef.current); };
  }, []);

  const persist = async (content) => {
    try {
      const res = await api.post('/api/notes', { id: noteId, subject: 'General', topic: 'Scratchpad', content });
      if (res.data.note?._id) setNoteId(res.data.note._id);
      setSaved(true);
    } catch (e) { /* localStorage cache already holds the draft */ }
  };

  const handleChange = (e) => {
    const v = e.target.value;
    setText(v);
    setSaved(false);
    localStorage.setItem('notes:draft', v); // instant local cache
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => persist(v), 900);
  };

  const words = text.trim() ? text.trim().split(/\s+/).length : 0;

  return (
    <div className="st-page">
      <h2>Notes</h2>
      <p className="st-sub">A quick scratchpad that auto-saves to your account — pick up where you left off on any device.</p>

      <div className="st-card">
        <div className="st-card-head">
          <h3 className="st-section-title"><span className="st-ic"><PenLine size={17} strokeWidth={2} /></span> Scratchpad</h3>
          <span className="st-pill ok" style={{ opacity: saved ? 1 : 0.5 }}>{saved ? 'Saved ✓' : 'Saving…'}</span>
        </div>
        <textarea
          className="st-textarea"
          rows={16}
          value={text}
          onChange={handleChange}
          placeholder="Write your notes here. Auto-saves as you type."
        />
        <div className="st-li-sub" style={{ marginTop: 8 }}>{words} word{words === 1 ? '' : 's'} · auto-saves to your account</div>
      </div>
    </div>
  );
}
