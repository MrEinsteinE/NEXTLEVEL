import React, { useState } from 'react';
import { MessageCircle, Trash2 } from 'lucide-react';
import api from '../../utils/api';
import toast from 'react-hot-toast';
import { useAuth } from '../../context/AuthContext';

export default function CommentSection({ story, onNewComment }) {
  const { user } = useAuth();
  const [list, setList] = useState(story.comments || []);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const res = await api.post(`/api/stories/${story._id}/comment`, { text: trimmed });
      const c = res.data.comment;
      setList(prev => [...prev, c]);
      onNewComment && onNewComment(c);
      setText('');
    } catch (err) {
      toast.error('Failed to post comment');
    } finally { setLoading(false); }
  };

  const del = async (commentId) => {
    try {
      await api.delete(`/api/stories/${story._id}/comment/${commentId}`);
      setList(prev => prev.filter(c => c._id !== commentId));
      toast.success('Comment deleted');
    } catch (err) { toast.error('Could not delete'); }
  };

  const ownerId = (c) => (c.userId && (c.userId._id || c.userId)) || null;

  return (
    <div className="comment-thread">
      <div className="comment-thread-head">
        <MessageCircle size={16} strokeWidth={2} />
        <span>{list.length} {list.length === 1 ? 'Reply' : 'Replies'}</span>
      </div>

      <div className="comments-list">
        {list.length === 0 && <p className="comment-empty">No replies yet — be the first to respond.</p>}
        {list.map(c => {
          const mine = user && ownerId(c) && String(ownerId(c)) === String(user._id);
          return (
            <div key={c._id} className="comment-item">
              <div className="comment-avatar">{(c.userId?.name || 'U')[0].toUpperCase()}</div>
              <div className="comment-body">
                <div className="comment-meta">
                  <strong>{c.userId?.name || 'User'}</strong>
                  <span className="comment-time">{new Date(c.createdAt).toLocaleString()}</span>
                  {mine && <button className="comment-del" onClick={() => del(c._id)} title="Delete reply"><Trash2 size={13} /></button>}
                </div>
                <div className="comment-text">{c.text}</div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="comment-compose">
        <input
          className="comment-input"
          value={text}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); submit(); } }}
          placeholder="Write a reply…"
          maxLength={1000}
        />
        <button className="comment-post" onClick={submit} disabled={loading || !text.trim()}>
          {loading ? 'Posting…' : 'Reply'}
        </button>
      </div>

      <style>{`
        .comment-thread-head { display:flex; align-items:center; gap:6px; font-weight:800; font-size:.9rem; color:var(--color-text-primary); margin-bottom:12px; }
        .comment-empty { color: var(--color-text-muted); font-size:.85rem; margin:0 0 12px; }
        .comments-list { display:flex; flex-direction:column; gap:14px; margin-bottom:14px; }
        .comment-item { display:flex; gap:10px; }
        .comment-avatar { width:32px; height:32px; flex-shrink:0; border-radius:50%; background:var(--gradient-primary); color:#fff; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:.8rem; }
        .comment-body { flex:1; background:var(--color-bg); border:1px solid var(--color-border); border-radius:12px; padding:8px 12px; }
        .comment-meta { display:flex; align-items:center; gap:8px; font-size:.78rem; color:var(--color-text-secondary); }
        .comment-meta strong { color:var(--color-text-primary); }
        .comment-time { color:var(--color-text-muted); }
        .comment-del { margin-left:auto; background:none; border:none; color:var(--color-text-muted); cursor:pointer; display:inline-flex; padding:2px; border-radius:6px; }
        .comment-del:hover { color:#ef4444; background:rgba(239,68,68,.12); }
        .comment-text { margin-top:3px; white-space:pre-wrap; font-size:.9rem; color:var(--color-text-primary); }
        .comment-compose { display:flex; gap:8px; }
        .comment-input { flex:1; padding:10px 12px; border:1px solid var(--color-border); border-radius:10px; background:var(--color-bg); color:var(--color-text-primary); font-family:inherit; font-size:.9rem; outline:none; transition:border-color .15s, box-shadow .15s; }
        .comment-input:focus { border-color:var(--color-primary); box-shadow:0 0 0 4px var(--color-primary-light); }
        .comment-post { padding:10px 18px; border:none; border-radius:10px; background:var(--gradient-primary); color:#fff; font-weight:800; cursor:pointer; }
        .comment-post:disabled { opacity:.55; cursor:not-allowed; }
      `}</style>
    </div>
  );
}
