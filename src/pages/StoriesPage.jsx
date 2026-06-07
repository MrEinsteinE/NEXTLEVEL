import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import StoriesFeed from '../components/stories/StoriesFeed.jsx';

export default function StoriesPage() {
  return (
    <div className="page page-enter" style={{ maxWidth: 1000, margin: '0 auto', padding: '24px' }}>
      <Link
        to="/dashboard"
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16,
          color: 'var(--color-primary)', fontWeight: 700, textDecoration: 'none'
        }}
      >
        <ArrowLeft size={16} /> Back to Dashboard
      </Link>
      <StoriesFeed />
    </div>
  );
}
