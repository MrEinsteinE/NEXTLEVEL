import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { MessageCircle } from 'lucide-react';
import { connectSocket, getSocket } from '../../utils/socket';
import { useAuth } from '../../context/AuthContext';
import './ChatWidget.css';

const ChatWidget = () => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [text, setText] = useState('');
  const listRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    const socket = connectSocket(user);

    const handleIncoming = (msg) => {
      setMessages(prev => [...prev, msg]);
    };

    socket.on('chat-message', handleIncoming);

    return () => {
      try { socket.off('chat-message', handleIncoming); } catch (e) {}
    };
  }, [user]);

  useEffect(() => {
    if (!user) return;
    // Load recent chat for student's room
    const room = `student_${user._id}`;
    axios.get(`/api/chat/room/${encodeURIComponent(room)}`)
      .then(res => {
        if (res.data && res.data.messages) setMessages(res.data.messages);
      }).catch(() => {});
  }, [user]);

  useEffect(() => {
    // scroll to bottom
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  const sendMessage = async () => {
    if (!text.trim() || !user) return;
    const socket = getSocket() || connectSocket(user);
    const msg = text.trim();
    setText('');
    // No optimistic insert: the server echoes the saved message back to this
    // user's room, which appends it via the 'chat-message' listener (avoids dupes).
    try {
      socket.emit('chat-message', { message: msg });
    } catch (e) {
      console.error('chat send error', e);
    }
  };

  if (!user) return null;

  return (
    <div className={`chat-widget ${open ? 'open' : ''}`}>
      <div className="chat-toggle" onClick={() => setOpen(!open)} title="Open chat">
        <MessageCircle size={24} strokeWidth={2} />
      </div>

      {open && (
        <div className="chat-panel">
          <div className="chat-header">Chat with Mentor</div>
          <div className="chat-list" ref={listRef}>
            {messages.map((m, idx) => (
              <div key={idx} className={`chat-msg ${m.sender && String(m.sender._id) === String(user._id) ? 'mine' : 'them'}`}>
                <div className="chat-meta">{m.sender?.name || (m.sender?.role === 'mentor' ? 'Mentor' : 'System')}</div>
                <div className="chat-text">{m.message}</div>
                <div className="chat-time">{new Date(m.createdAt).toLocaleTimeString()}</div>
              </div>
            ))}
          </div>
          <div className="chat-input">
            <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => e.key === 'Enter' && sendMessage()} placeholder="Type a message to your mentor..." />
            <button onClick={sendMessage}>Send</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatWidget;
