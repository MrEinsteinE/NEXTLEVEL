import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import api from '../../utils/api';
import CommentSection from './CommentSection.jsx';
import toast from 'react-hot-toast';

// Only render media from trusted sources: https YouTube (normalised to a
// privacy-friendly sandboxed embed) or direct https images. Everything else
// (data:/javascript:/arbitrary origins) is rejected — defends against the
// stored-XSS / frame-injection vector via a user-supplied mediaUrl.
function getSafeMedia(raw) {
  if (!raw || typeof raw !== 'string') return null;
  let u;
  try { u = new URL(raw); } catch { return null; }
  if (u.protocol !== 'https:') return null;
  const host = u.hostname.replace(/^www\./, '');
  const ytHosts = ['youtube.com', 'youtu.be', 'youtube-nocookie.com', 'm.youtube.com'];
  if (ytHosts.includes(host)) {
    let id = '';
    if (host === 'youtu.be') id = u.pathname.slice(1);
    else if (u.pathname === '/watch') id = u.searchParams.get('v') || '';
    else if (u.pathname.startsWith('/embed/')) id = u.pathname.split('/embed/')[1] || '';
    id = (id || '').split(/[/?&#]/)[0];
    if (!/^[\w-]{6,15}$/.test(id)) return null;
    return { type: 'youtube', src: `https://www.youtube-nocookie.com/embed/${id}` };
  }
  if (/\.(png|jpe?g|gif|webp)$/i.test(u.pathname)) return { type: 'image', src: u.href };
  return null;
}

export default function StoryDetailModal({ storyId, onClose }) {
  const [story, setStory] = useState(null);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await api.get(`/api/stories/${storyId}`);
        setStory(res.data.story);
      } catch (err) {
        toast.error('Failed to load story');
        onClose();
      }
    };
    load();
  }, [storyId]);

  if (!story) return null;

  return createPortal(
    <div className="story-detail-overlay" onClick={onClose}>
      <div className="story-detail-card" onClick={(e) => e.stopPropagation()}>
        <button className="story-detail-close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h3 className="story-detail-title">{story.title}</h3>
        <div className="story-detail-meta">By {story.userId?.name || 'Anonymous'} • {new Date(story.createdAt).toLocaleString()}</div>
        <div className="story-detail-content">{story.content}</div>
        {(() => {
          const media = getSafeMedia(story.mediaUrl);
          if (!media) return null;
          return (
            <div className="story-detail-media">
              {media.type === 'youtube' ? (
                <iframe
                  width="100%" height="320" src={media.src} title="media" frameBorder="0"
                  sandbox="allow-scripts allow-same-origin allow-presentation"
                  referrerPolicy="strict-origin-when-cross-origin"
                  allowFullScreen
                />
              ) : (
                <img src={media.src} alt="media" />
              )}
            </div>
          );
        })()}

        <div className="story-detail-thread">
          <CommentSection story={story} onNewComment={(c) => setStory(prev => ({ ...prev, comments: [...(prev.comments || []), c] }))} />
        </div>
      </div>

      <style>{`
        .story-detail-overlay {
          position: fixed; inset: 0; z-index: 2100;
          background: rgba(15,23,42,.55);
          -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
          display: flex; padding: 24px; overflow-y: auto;
        }
        .story-detail-card {
          margin: auto; width: 100%; max-width: 620px;
          background: var(--color-bg-card); color: var(--color-text-primary);
          border: 1px solid var(--color-border); border-radius: 20px;
          padding: 26px 28px; position: relative;
          box-shadow: 0 24px 60px rgba(2,6,23,.30);
          animation: storyDetailPop .22s cubic-bezier(.2,.8,.2,1);
        }
        @keyframes storyDetailPop { from { opacity:0; transform: translateY(12px) scale(.98) } to { opacity:1; transform:none } }
        .story-detail-close { position:absolute; top:14px; right:14px; width:34px; height:34px; border:none; border-radius:9px; background: var(--color-bg); color: var(--color-text-secondary); cursor:pointer; display:inline-flex; align-items:center; justify-content:center; }
        .story-detail-close:hover { background: rgba(239,68,68,.14); color:#ef4444; }
        .story-detail-title { font-size: 1.35rem; font-weight: 800; margin: 0 38px 4px 0; }
        .story-detail-meta { font-size: .82rem; color: var(--color-text-muted); margin-bottom: 14px; }
        .story-detail-content { white-space: pre-wrap; line-height: 1.6; font-size: .95rem; color: var(--color-text-primary); }
        .story-detail-media { margin-top: 14px; }
        .story-detail-media img { max-width: 100%; border-radius: 12px; }
        .story-detail-media iframe { border-radius: 12px; }
        .story-detail-thread { margin-top: 20px; padding-top: 18px; border-top: 1px solid var(--color-border); }
      `}</style>
    </div>,
    document.body
  );
}
