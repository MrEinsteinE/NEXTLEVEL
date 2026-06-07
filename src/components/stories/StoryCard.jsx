import React, { useState } from 'react';
import { Heart, MessageCircle } from 'lucide-react';
import api from '../../utils/api';
import StoryDetailModal from './StoryDetailModal.jsx';
import toast from 'react-hot-toast';

export default function StoryCard({ story, onUpdate }) {
  const [liked, setLiked] = useState(() => (story.likes || []).length > 0);
  const [likesCount, setLikesCount] = useState((story.likes || []).length || 0);
  const [commentsCount] = useState((story.comments || []).length || 0);
  const [open, setOpen] = useState(false);

  const toggleLike = async () => {
    try {
      const res = await api.put(`/api/stories/${story._id}/like`);
      setLiked(res.data.liked);
      setLikesCount(res.data.likes);
    } catch (err) {
      toast.error('Could not update like');
    }
  };

  return (
    <div className="card card-hover story-card" onClick={() => setOpen(true)} style={{ cursor: 'pointer' }}>
      <div className="story-header">
        <div>
          <strong>{story.title}</strong>
          <div className="text-sm text-muted">by {story.userId?.name || 'Anonymous'} • {new Date(story.createdAt).toLocaleDateString()}</div>
        </div>
      </div>

      <p className="text-sm">{story.content?.slice(0, 200)}{story.content && story.content.length > 200 ? '…' : ''}</p>

      <div className="story-actions">
        <button
          className={`story-action ${liked ? 'liked' : ''}`}
          onClick={(e) => { e.stopPropagation(); toggleLike(); }}
          title={liked ? 'Unlike' : 'Like'}
        >
          <Heart className="like-heart" size={16} strokeWidth={2.2} color="#ef4444" fill={liked ? '#ef4444' : 'none'} />
          {likesCount} {likesCount === 1 ? 'like' : 'likes'}
        </button>
        <button
          className="story-action"
          onClick={(e) => { e.stopPropagation(); setOpen(true); }}
          title="View replies"
        >
          <MessageCircle size={16} strokeWidth={2} />
          {commentsCount} {commentsCount === 1 ? 'reply' : 'replies'}
        </button>
        <span className="story-thread-cta">View thread →</span>
      </div>

      {open && <StoryDetailModal storyId={story._id} onClose={() => { setOpen(false); if (onUpdate) onUpdate(); }} />}

      <style>{`
        .story-card { display: flex; flex-direction: column; gap: 8px; }
        .story-actions {
          display: flex; align-items: center; gap: 10px;
          margin-top: 4px; padding-top: 10px;
          border-top: 1px solid var(--color-border);
        }
        .story-action {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 5px 10px; border: 1px solid var(--color-border); border-radius: 999px;
          background: transparent; color: var(--color-text-secondary);
          font-size: .8rem; font-weight: 700; cursor: pointer;
          transition: background .15s, color .15s, border-color .15s;
        }
        .story-action:hover { background: var(--color-bg); color: var(--color-text-primary); }
        .story-action.liked { color: #ef4444; border-color: rgba(239,68,68,.35); background: rgba(239,68,68,.08); }
        .story-thread-cta { margin-left: auto; font-size: .8rem; font-weight: 700; color: var(--color-primary); }
        .like-heart { color: #ef4444; transition: transform .15s; }
        .story-action:hover .like-heart { transform: scale(1.12); }
        .story-action.liked .like-heart { animation: heartPop .32s ease; }
        @keyframes heartPop { 0% { transform: scale(1); } 35% { transform: scale(1.4); } 60% { transform: scale(.88); } 100% { transform: scale(1); } }
      `}</style>
    </div>
  );
}
