import React from 'react'

export function Countdown({ startAt, limitSec }: { startAt: string | null; limitSec: number }) {
  const [remaining, setRemaining] = React.useState(limitSec)

  React.useEffect(() => {
    if (!startAt) return
    const start = new Date(startAt).getTime()
    const tick = () => {
      const elapsed = Date.now() - start
      const left = Math.max(0, limitSec - Math.floor(elapsed / 1000))
      setRemaining(left)
    }
    tick()
    const id = window.setInterval(tick, 250)
    return () => window.clearInterval(id)
  }, [startAt, limitSec])

  return (
    <div className="flex items-center gap-2 text-sm">
      <div className="h-2 w-24 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-all"
          style={{ width: `${(remaining / limitSec) * 100}%` }}
        />
      </div>
      <span className="tabular-nums">{remaining}s</span>
    </div>
  )
}
