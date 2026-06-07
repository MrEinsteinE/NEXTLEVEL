import { GraduationCap, MessageCircle } from 'lucide-react'
import './MentorProfile.css'

function MentorProfile() {
  return (
    <div className="mentor-card">
      <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
        <GraduationCap size={20} strokeWidth={2} /> Your Mentor
      </h3>

      <div className="mentor-photo-wrapper">
        <div className="mentor-photo-ring" />
        <img
          src="/images/bhimasir-mentor.jpg"
          alt="Bhima Sir - GATE Mentor"
          className="mentor-photo"
        />
      </div>

      <div className="mentor-name">Bhima Sir</div>
      <div className="mentor-title">Senior GATE Mentor & Coach</div>

      <div className="mentor-stats">
        <div className="mentor-stat">
          <span className="stat-num">500+</span>
          <span className="stat-lbl">Students</span>
        </div>
        <div className="mentor-stat">
          <span className="stat-num">8+</span>
          <span className="stat-lbl">Years Exp</span>
        </div>
        <div className="mentor-stat">
          <span className="stat-num">95%</span>
          <span className="stat-lbl">Success Rate</span>
        </div>
      </div>

      <p className="mentor-bio">
        Dedicated to transforming GATE aspirants into top rankers. 
        Expert in Engineering Mathematics, DSA, and Computer Networks.
        Taking you to the <strong>Next Level</strong>!
      </p>

      <button className="mentor-contact-btn" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
        <MessageCircle size={18} strokeWidth={2} /> Connect with Mentor
      </button>
    </div>
  )
}

export default MentorProfile
