import { useState, useEffect } from 'react'
import { Rocket } from 'lucide-react'
import './GATECountdown.css'

function GATECountdown() {
  const [days, setDays] = useState(0)
  const [hours, setHours] = useState(0)
  const [mins, setMins] = useState(0)
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    const target = new Date('2027-02-07T09:00:00').getTime()
    const update = () => {
      const diff = target - Date.now()
      if (diff > 0) {
        setDays(Math.floor(diff / (1000 * 60 * 60 * 24)))
        setHours(Math.floor((diff / (1000 * 60 * 60)) % 24))
        setMins(Math.floor((diff / (1000 * 60)) % 60))
        setSecs(Math.floor((diff / 1000) % 60))
      } else {
        setDays(0); setHours(0); setMins(0); setSecs(0)
      }
    }
    update()
    const timer = setInterval(update, 1000)
    return () => clearInterval(timer)
  }, [])

  const pad = (n) => String(n).padStart(2, '0')

  return (
    <div className="countdown-container glass animate-fade-in">
      <div className="countdown-title">
        <span className="icon"><Rocket size={18} strokeWidth={2} /></span>
        <h3 className="gradient-text">GATE 2027 Countdown</h3>
      </div>
      <div className="countdown-timer">
        <div className="time-block">
          <span className="time-num">{days}</span>
          <span className="time-unit">Days</span>
        </div>
        <span className="time-sep">:</span>
        <div className="time-block">
          <span className="time-num">{pad(hours)}</span>
          <span className="time-unit">Hours</span>
        </div>
        <span className="time-sep">:</span>
        <div className="time-block">
          <span className="time-num">{pad(mins)}</span>
          <span className="time-unit">Minutes</span>
        </div>
        <span className="time-sep">:</span>
        <div className="time-block">
          <span className="time-num">{pad(secs)}</span>
          <span className="time-unit">Seconds</span>
        </div>
      </div>
      <p className="countdown-quote">"Believe in your preparation. Success follows effort."</p>
      <p className="countdown-sincere">BE SINCERE AS TIME</p>
      <div className="countdown-motto">
        <span>AIM BIG</span> • <span>START EARLY</span> • <span>STAY CONSISTENT</span> • <span>TRUST THE PROCESS</span>
      </div>
    </div>
  )
}

export default GATECountdown
