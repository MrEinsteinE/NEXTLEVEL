import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

// Theme-aware custom select. A native <select> can't restyle its open option
// list (it's drawn by the OS), so this renders a button + a styled menu instead.
export default function Select({ value, onChange, options, ariaLabel, placeholder = 'Select…' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])

  const current = options.find(o => String(o.value) === String(value))

  return (
    <div className="sel" ref={ref}>
      <button
        type="button"
        className="sel-trigger"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel}
        onClick={() => setOpen(o => !o)}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false) }}
      >
        <span className="sel-value">{current?.label ?? placeholder}</span>
        <ChevronDown size={15} strokeWidth={2.2} className={`sel-chev ${open ? 'open' : ''}`} />
      </button>
      {open && (
        <div className="sel-menu" role="listbox">
          {options.map(o => (
            <button
              key={o.value}
              type="button"
              role="option"
              aria-selected={String(o.value) === String(value)}
              className={`sel-option ${String(o.value) === String(value) ? 'active' : ''}`}
              onClick={() => { onChange(o.value); setOpen(false) }}
            >
              {o.label}
              {String(o.value) === String(value) && <Check size={14} strokeWidth={2.5} />}
            </button>
          ))}
        </div>
      )}
      <style>{`
        .sel { position: relative; }
        .sel-trigger { width: 100%; box-sizing: border-box; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 11px 13px; border-radius: 10px; border: 1px solid var(--color-border); background: var(--color-bg-input, var(--color-bg)); color: var(--color-text-primary); font-family: inherit; font-size: .92rem; cursor: pointer; transition: border-color .15s, box-shadow .15s; }
        .sel-trigger:hover { border-color: var(--color-primary); }
        .sel-trigger[aria-expanded="true"], .sel-trigger:focus-visible { outline: none; border-color: var(--color-primary); box-shadow: 0 0 0 3px var(--color-primary-light); }
        [data-theme="dark"] .sel-trigger[aria-expanded="true"], [data-theme="dark"] .sel-trigger:focus-visible { box-shadow: 0 0 0 3px rgba(108,99,255,0.25); }
        .sel-value { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .sel-chev { color: var(--color-text-muted); transition: transform .18s; flex-shrink: 0; }
        .sel-chev.open { transform: rotate(180deg); }
        .sel-menu { position: absolute; top: calc(100% + 6px); left: 0; right: 0; z-index: 60; background: var(--color-bg-card); border: 1px solid var(--color-border); border-radius: 10px; box-shadow: 0 12px 32px rgba(2,6,23,.28); padding: 5px; max-height: 260px; overflow-y: auto; animation: selPop .14s ease; }
        @keyframes selPop { from { opacity: 0; transform: translateY(-4px) } to { opacity: 1; transform: none } }
        .sel-option { width: 100%; display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 9px 11px; border: none; border-radius: 8px; background: transparent; color: var(--color-text-primary); font-family: inherit; font-size: .9rem; font-weight: 600; cursor: pointer; text-align: left; }
        .sel-option:hover { background: var(--color-bg-input, var(--color-bg)); }
        .sel-option.active { background: var(--color-primary-light); color: var(--color-primary); }
        [data-theme="dark"] .sel-option.active { background: rgba(108,99,255,0.16); color: #b3aeff; }
      `}</style>
    </div>
  )
}
