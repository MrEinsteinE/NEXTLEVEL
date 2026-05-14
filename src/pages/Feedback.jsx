import React, { useState } from 'react';
import api from '../utils/api';

export default function Feedback() {
  const [msg, setMsg] = useState('');
  const [name, setName] = useState('');
  const [sending, setSending] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setSending(true);
    try {
      await api.post('/api/feedback', { name, message: msg });
      alert('Thanks for the feedback!');
      setMsg(''); setName('');
    } catch (err) {
      alert('Failed to send');
    } finally { setSending(false); }
  };

  return (
    <div>
      <h2>Feedback</h2>
      <form onSubmit={submit} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 16 }}>
        <input className="input" placeholder="Your name" value={name} onChange={(e)=>setName(e.target.value)} />
        <textarea className="input" rows={6} placeholder="Your feedback" value={msg} onChange={(e)=>setMsg(e.target.value)} />
        <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" disabled={sending}>{sending ? 'Sending…' : 'Send Feedback'}</button>
        </div>
      </form>
    </div>
  );
}
