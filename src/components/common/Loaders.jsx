// Reusable skeleton loaders + empty-state primitives.
// Styles live globally in index.css (.sk, .sk-widget, .empty-state).

export function Skeleton({ w = '100%', h = 14, r = 8, style = {} }) {
  return (
    <span
      className="sk"
      style={{
        width: w,
        height: typeof h === 'number' ? `${h}px` : h,
        borderRadius: typeof r === 'number' ? `${r}px` : r,
        ...style,
      }}
    />
  )
}

// Generic widget placeholder: a title bar + an avatar/icon block + a few text lines.
export function WidgetSkeleton({ rows = 4 }) {
  return (
    <div className="sk-widget">
      <Skeleton w="45%" h={18} />
      <div className="sk-row">
        <Skeleton w={56} h={56} r={14} />
        <div className="sk-col">
          {Array.from({ length: rows }).map((_, i) => (
            <Skeleton key={i} w={`${92 - i * 14}%`} h={12} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="empty-state">
      {Icon && <span className="empty-state-icon"><Icon size={26} strokeWidth={1.8} /></span>}
      {title && <div className="empty-state-title">{title}</div>}
      {message && <p className="empty-state-msg">{message}</p>}
      {action}
    </div>
  )
}

export default Skeleton
