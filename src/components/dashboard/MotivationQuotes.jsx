import { useState, useEffect } from 'react'
import { MessageCircle, RefreshCw } from 'lucide-react'
import { motivationQuotes } from '../../data/platformData.js'
import './MotivationQuotes.css'

function MotivationQuotes() {
  const [quote, setQuote] = useState(null)

  const getRandomQuote = () => {
    const idx = Math.floor(Math.random() * motivationQuotes.length)
    setQuote(motivationQuotes[idx])
  }

  useEffect(() => { getRandomQuote() }, [])

  if (!quote) return null

  const renderText = (text) => {
    const boldWords = ['TRUST THE PROCESS', 'AIM BIG', 'CONSISTENCY', 'DISCIPLINE', 'Consistency', 'Discipline']
    let result = text
    boldWords.forEach(w => {
      result = result.replace(new RegExp(w, 'g'), `<strong>${w}</strong>`)
    })
    return <span dangerouslySetInnerHTML={{ __html: `"${result}"` }} />
  }

  return (
    <div className="motivation-widget">
      <div className="motivation-header">
        <h3 style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <MessageCircle size={18} strokeWidth={2} /> Message from Bhima Sankar Sir
        </h3>
        <button className="refresh-btn" onClick={getRandomQuote} aria-label="New quote">
          <RefreshCw size={16} strokeWidth={2} />
        </button>
      </div>
      <div className="motivation-body">
        <p className="motivation-text">{renderText(quote.text)}</p>
        <p className="motivation-sig">— Bhima Sankar Sir | NEXT_LEVEL</p>
      </div>
    </div>
  )
}

export default MotivationQuotes
