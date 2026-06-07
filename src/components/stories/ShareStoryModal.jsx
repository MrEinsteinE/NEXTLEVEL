import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { PenLine, X } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';

export default function ShareStoryModal({ onSubmitted }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const submit = async () => {
    if (!title || !content) return toast.error('Title and content are required');
    setSubmitting(true);
    try {
      await api.post('/api/stories', { title, content, mediaUrl });
      toast.success('Story submitted for review ✓');
      setOpen(false);
      setTitle(''); setContent(''); setMediaUrl('');
      if (onSubmitted) onSubmitted();
    } catch (err) {
      toast.error('Could not submit story');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button className="share-story-trigger" onClick={() => setOpen(true)}>
        <PenLine size={16} strokeWidth={2} /> Share Your Story
      </button>

      {open && createPortal(
        <div className="story-modal-overlay" onClick={() => setOpen(false)}>
          <div className="story-modal" onClick={(e) => e.stopPropagation()}>
            <button className="story-modal-close" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
            <h3>Share Your Story</h3>
            <p className="story-modal-sub">Inspire other aspirants — your journey, your results, or a thank-you to your mentor.</p>

            <label>Title</label>
            <input value={title} onChange={e => setTitle(e.target.value)} maxLength={100} placeholder="e.g. How I cracked GATE with consistency" />

            <label>Your story</label>
            <textarea rows={6} value={content} onChange={e => setContent(e.target.value)} maxLength={5000} placeholder="Share what worked for you…" />

            <label>Image / Video URL (optional)</label>
            <input value={mediaUrl} onChange={e => setMediaUrl(e.target.value)} placeholder="https://…" />

            <div className="story-modal-actions">
              <button className="story-cancel" onClick={() => setOpen(false)}>Cancel</button>
              <button className="story-submit" onClick={submit} disabled={submitting}>
                {submitting ? 'Submitting…' : 'Submit Story'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Styles are always mounted (not inside the modal) so the trigger button
          is styled even when the modal is closed. */}
      <style>{`
        .share-story-trigger {
          display:inline-flex; align-items:center; gap:8px;
          padding:10px 18px; border:none; border-radius:12px;
          background: var(--gradient-primary); color:#fff; font-weight:800; font-size:.9rem; cursor:pointer;
          box-shadow:0 8px 20px rgba(108,99,255,.3); transition: transform .15s, box-shadow .15s;
        }
        .share-story-trigger:hover { transform: translateY(-2px); box-shadow:0 12px 26px rgba(108,99,255,.4); }
        .story-modal-overlay {
          position: fixed; inset: 0; z-index: 2100;
          background: rgba(15,23,42,.55);
          -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
          display: flex; padding: 24px; overflow-y: auto;
        }
        .story-modal {
          margin: auto; width: 100%; max-width: 520px;
          background: var(--color-bg-card); color: var(--color-text-primary);
          border: 1px solid var(--color-border); border-radius: 20px;
          padding: 26px 28px; position: relative;
          box-shadow: 0 24px 60px rgba(2,6,23,.30);
          animation: storyPop .22s cubic-bezier(.2,.8,.2,1);
        }
        @keyframes storyPop { from { opacity:0; transform: translateY(12px) scale(.98) } to { opacity:1; transform:none } }
        .story-modal h3 { font-size: 1.3rem; font-weight: 800; margin: 0 0 4px; }
        .story-modal-sub { color: var(--color-text-secondary); font-size: .88rem; margin-bottom: 16px; }
        .story-modal label { display:block; font-size:.78rem; font-weight:700; text-transform:uppercase; letter-spacing:.04em; color: var(--color-text-secondary); margin: 12px 0 6px; }
        .story-modal input, .story-modal textarea {
          width: 100%; box-sizing: border-box; padding: 10px 12px;
          border: 1px solid var(--color-border); border-radius: 10px;
          background: var(--color-bg); color: var(--color-text-primary);
          font-family: inherit; font-size: .9rem; resize: vertical; outline: none;
          transition: border-color .15s, box-shadow .15s;
        }
        .story-modal input::placeholder, .story-modal textarea::placeholder { color: var(--color-text-muted); }
        .story-modal input:focus, .story-modal textarea:focus { border-color: var(--color-primary); box-shadow: 0 0 0 4px var(--color-primary-light); }
        .story-modal-close { position:absolute; top:14px; right:14px; width:34px; height:34px; border:none; border-radius:9px; background: var(--color-bg); color: var(--color-text-secondary); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
        .story-modal-close:hover { background: rgba(239,68,68,.14); color:#ef4444; }
        .story-modal-actions { display:flex; gap:10px; justify-content:flex-end; margin-top:20px; }
        .story-cancel { padding:10px 18px; border:1px solid var(--color-border); border-radius:10px; background:transparent; color: var(--color-text-secondary); font-weight:700; cursor:pointer; }
        .story-submit { padding:10px 20px; border:none; border-radius:10px; background: var(--gradient-primary); color:#fff; font-weight:800; cursor:pointer; box-shadow:0 8px 20px rgba(108,99,255,.32); transition:transform .15s; }
        .story-submit:hover:not(:disabled) { transform: translateY(-1px); }
        .story-submit:disabled { opacity:.6; cursor:not-allowed; }
      `}</style>
    </>
  );
}
