import { Target } from 'lucide-react'

function MonthlyTargetSetter() {
  const targets = [
    { label: 'Complete Linear Algebra', progress: 80, status: 'On Track' },
    { label: 'Solve 500 MCQs', progress: 62, status: 'On Track' },
    { label: 'Finish OS syllabus', progress: 35, status: 'Behind' },
    { label: '8 hrs daily average', progress: 75, status: 'On Track' },
  ]

  return (
    <div>
      <h3 style={{ fontSize: 'var(--font-size-base)', fontWeight: 600, marginBottom: 'var(--space-4)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <Target size={18} strokeWidth={2} /> March Targets
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
        {targets.map((t, i) => (
          <div key={i}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-2)' }}>
              <span style={{ fontSize: 'var(--font-size-sm)', fontWeight: 500 }}>{t.label}</span>
              <span style={{
                fontSize: 'var(--font-size-xs)',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: 'var(--radius-full)',
                background: t.status === 'On Track' ? 'rgba(34, 197, 94, 0.1)' : 'rgba(239, 68, 68, 0.1)',
                color: t.status === 'On Track' ? 'var(--color-accent-success)' : 'var(--color-accent-danger)',
              }}>
                {t.status}
              </span>
            </div>
            <div style={{
              height: 6,
              background: 'rgba(255,255,255,0.06)',
              borderRadius: 'var(--radius-full)',
              overflow: 'hidden',
            }}>
              <div style={{
                height: '100%',
                width: `${t.progress}%`,
                background: t.status === 'On Track' ? 'var(--gradient-success)' : 'var(--gradient-warm)',
                borderRadius: 'var(--radius-full)',
                transition: 'width 0.8s ease',
              }} />
            </div>
            <div style={{ fontSize: 'var(--font-size-xs)', color: 'var(--color-text-muted)', marginTop: 'var(--space-1)', textAlign: 'right' }}>
              {t.progress}%
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

export default MonthlyTargetSetter
