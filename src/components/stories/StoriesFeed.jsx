import React, { useEffect, useState } from 'react';
import api from '../../utils/api';
import StoryCard from './StoryCard.jsx';
import ShareStoryModal from './ShareStoryModal.jsx';

export default function StoriesFeed() {
  const [stories, setStories] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchStories = async () => {
    try {
      const res = await api.get('/api/stories');
      setStories(res.data.stories || []);
    } catch (err) {
      console.error('Failed to load stories', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchStories(); }, []);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Community Stories</h2>
        <ShareStoryModal onSubmitted={fetchStories} />
      </div>
      {loading ? <p>Loading stories…</p> : (
        <div className="stories-grid">
          {stories.length === 0 && <p>No stories yet.</p>}
          {stories.map(s => <StoryCard key={s._id} story={s} onUpdate={fetchStories} />)}
        </div>
      )}
    </div>
  );
}
