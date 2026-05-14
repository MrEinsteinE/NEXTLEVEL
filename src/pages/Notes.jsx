import React, { useEffect, useState, useRef } from 'react';

export default function Notes() {
  const [text, setText] = useState(() => localStorage.getItem('notes:draft') || '');
  const timeoutRef = useRef(null);
  useEffect(() => () => { if (timeoutRef.current) clearTimeout(timeoutRef.current); }, []);

  const handleChange = (e) => {
    setText(e.target.value);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => {
      localStorage.setItem('notes:draft', e.target.value);
    }, 800);
  };

  return (
    <div>
      <h2>Notes</h2>
      <div className="card" style={{ padding: 12 }}>
        <textarea className="input" rows={12} value={text} onChange={handleChange} placeholder="Write your notes here. Auto-saves every few seconds." />
      </div>
    </div>
  );
}
