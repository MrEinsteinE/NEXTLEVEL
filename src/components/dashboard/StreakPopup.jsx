import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import axios from 'axios'
import confetti from 'canvas-confetti'
import toast from 'react-hot-toast'
import { Flame, X, Share2 } from 'lucide-react'

const MILESTONES = [7, 14, 30, 60, 100, 180, 365]

function fireConfetti() {
  try {
    const end = Date.now() + 900
    const colors = ['#F97316', '#EA580C', '#6C63FF', '#22C55E']
    ;(function frame() {
      confetti({ particleCount: 4, angle: 60, spread: 60, origin: { x: 0 }, colors })
      confetti({ particleCount: 4, angle: 120, spread: 60, origin: { x: 1 }, colors })
      if (Date.now() < end) requestAnimationFrame(frame)
    })()
  } catch (e) { /* confetti is best-effort */ }
}

/**
 * Streak popup: shows a normal nudge once per calendar day, and a special
 * confetti + shareable celebration the first time a streak milestone is hit.
 */
export default function StreakPopup() {
  const [streak, setStreak] = useState(null)
  const [show, setShow] = useState(false)
  const [milestone, setMilestone] = useState(null)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}')
        if (!user._id) return
        const res = await axios.get(`/api/student/streak/${user._id}`)
        if (cancelled) return
        const s = res.data?.streak ?? 0
        setStreak(s)

        // New milestone since we last celebrated? Always show it (with confetti).
        const reached = MILESTONES.filter(m => s >= m).pop() || 0
        const celebrated = Number(localStorage.getItem('streakMilestoneCelebrated') || 0)
        if (reached > celebrated) {
          localStorage.setItem('streakMilestoneCelebrated', String(reached))
          setMilestone(reached)
          setShow(true)
          fireConfetti()
          return
        }

        // Otherwise the normal once-per-day streak nudge.
        const today = new Date().toDateString()
        if (localStorage.getItem('streakPopupDate') !== today) {
          localStorage.setItem('streakPopupDate', today)
          setShow(true)
        }
      } catch (e) { /* ignore — no popup on error */ }
    })()
    return () => { cancelled = true }
  }, [])

  if (!show || streak === null) return null

  const close = () => setShow(false)
  const isMilestone = !!milestone
  const headline = isMilestone
    ? `${milestone}-day milestone! 🎉`
    : streak > 0 ? `${streak}-day streak!` : 'Start your streak today'
  const message = isMilestone
    ? `Incredible discipline — ${milestone} days of consistent prep. This is how ranks are built. Keep the chain alive!`
    : streak > 0
      ? "You're showing up consistently — submit today's report to keep it alive."
      : 'Submit your daily study report to begin a streak and earn rewards.'

  const shareText = `I've kept a ${streak}-day study streak on NEXT_LEVEL with Bhima Sankar Sir! 🔥 #GATE`
  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'My NEXT_LEVEL streak', text: shareText })
      else { await navigator.clipboard.writeText(shareText); toast.success('Copied — paste it anywhere!') }
    } catch (e) { /* user cancelled the share sheet */ }
  }

  return createPortal(
    <div className="streak-pop-overlay" onClick={close}>
      <div className={`streak-pop ${isMilestone ? 'milestone' : ''}`} onClick={e => e.stopPropagation()}>
        <button className="streak-pop-close" onClick={close} aria-label="Close" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><X size={16} strokeWidth={2} /></button>
        <div className="streak-pop-flame"><Flame size={48} strokeWidth={2} /></div>
        <div className="streak-pop-count">{streak}</div>
        <div className="streak-pop-headline">{headline}</div>
        <p className="streak-pop-msg">{message}</p>
        {isMilestone && (
          <button className="streak-pop-share" onClick={share}><Share2 size={15} strokeWidth={2} /> Share this win</button>
        )}
        <button className="streak-pop-cta" onClick={close}>Let’s go →</button>
      </div>
      <style>{`
        .streak-pop-overlay {
          position: fixed; inset: 0; z-index: 2100;
          background: rgba(15,23,42,.55);
          -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px);
          display: flex; align-items: center; justify-content: center; padding: 24px;
          animation: streakFade .2s ease;
        }
        @keyframes streakFade { from { opacity: 0 } to { opacity: 1 } }
        .streak-pop {
          position: relative;
          width: 100%; max-width: 360px; text-align: center;
          padding: 32px 28px 28px;
          border-radius: 24px;
          background: linear-gradient(160deg, #FFF7ED 0%, #FFFFFF 60%);
          box-shadow: 0 24px 60px rgba(234,88,12,.28);
          border: 1px solid rgba(249,115,22,.25);
          animation: streakPop .35s cubic-bezier(.2,.9,.3,1.3);
        }
        .streak-pop.milestone { background: linear-gradient(160deg, #FEF3C7 0%, #FFFFFF 60%); box-shadow: 0 24px 60px rgba(108,99,255,.3); }
        [data-theme="dark"] .streak-pop {
          background: linear-gradient(160deg, #2a1a10 0%, #1A1830 60%);
          border-color: rgba(249,115,22,.4);
          color: #F1F0FF;
        }
        [data-theme="dark"] .streak-pop.milestone { background: linear-gradient(160deg, #2a2410 0%, #1A1830 60%); }
        @keyframes streakPop { from { opacity:0; transform: translateY(16px) scale(.92) } to { opacity:1; transform:none } }
        .streak-pop-close {
          position: absolute; top: 12px; right: 12px;
          width: 30px; height: 30px; border: none; border-radius: 8px;
          background: rgba(0,0,0,.06); color: #64748b; cursor: pointer; font-size: .8rem;
        }
        [data-theme="dark"] .streak-pop-close { background: rgba(255,255,255,.08); color: #cbd5e1; }
        .streak-pop-flame { font-size: 3.2rem; line-height: 1; filter: drop-shadow(0 6px 14px rgba(249,115,22,.45)); animation: flameBob 1.6s ease-in-out infinite; }
        @keyframes flameBob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-6px) } }
        .streak-pop-count {
          font-family: var(--font-display, sans-serif);
          font-size: 3.4rem; font-weight: 900; line-height: 1; margin-top: 6px;
          background: linear-gradient(135deg, #F97316, #EA580C);
          -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent;
        }
        .streak-pop-headline { font-size: 1.05rem; font-weight: 800; color: #9a3412; margin-top: 4px; }
        [data-theme="dark"] .streak-pop-headline { color: #fdba74; }
        .streak-pop-msg { font-size: .9rem; color: #64748b; margin: 10px 0 20px; line-height: 1.5; }
        [data-theme="dark"] .streak-pop-msg { color: #9CA3AF; }
        .streak-pop-share {
          width: 100%; padding: 11px; margin-bottom: 10px; cursor: pointer;
          border: 1px solid rgba(249,115,22,.4); border-radius: 12px; background: transparent;
          color: #EA580C; font-weight: 800; font-size: .9rem;
          display: inline-flex; align-items: center; justify-content: center; gap: 7px;
        }
        [data-theme="dark"] .streak-pop-share { color: #fdba74; }
        .streak-pop-cta {
          width: 100%; padding: 12px; border: none; border-radius: 12px; cursor: pointer;
          font-weight: 800; font-size: .95rem; color: #fff;
          background: linear-gradient(135deg, #F97316, #EA580C);
          box-shadow: 0 8px 20px rgba(234,88,12,.35);
          transition: transform .15s;
        }
        .streak-pop-cta:hover { transform: translateY(-2px); }
      `}</style>
    </div>,
    document.body
  )
}
