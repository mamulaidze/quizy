import React from 'react'
import { motion } from 'framer-motion'

export function SparkleBurst({ show }: { show: boolean }) {
  if (!show) return null
  const sparkles = Array.from({ length: 6 })
  return (
    <div className="pointer-events-none relative h-0 w-0">
      {sparkles.map((_, idx) => (
        <motion.span
          key={idx}
          className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-amber-300"
          initial={{ opacity: 0, scale: 0.5, x: 0, y: 0 }}
          animate={{
            opacity: [0, 1, 0],
            scale: [0.5, 1.2, 0.6],
            x: Math.cos((idx / sparkles.length) * Math.PI * 2) * 24,
            y: Math.sin((idx / sparkles.length) * Math.PI * 2) * 24
          }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      ))}
    </div>
  )
}
