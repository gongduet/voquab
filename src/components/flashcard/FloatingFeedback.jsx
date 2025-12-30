// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion'

/**
 * FloatingFeedback - Shows animated feedback after rating a card
 *
 * Displays a message like "+5 days" that floats upward from the clicked button
 */
export default function FloatingFeedback({ message, visible, position, color = '#5aada4' }) {
  if (!message) return null

  // Use position if provided, otherwise fall back to center
  const hasPosition = position && position.x && position.y

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 0 }}
          animate={{ opacity: 1, y: -80 }}
          exit={{ opacity: 0, y: -120 }}
          transition={{ duration: 1.5, ease: 'easeOut' }}
          style={{
            position: 'fixed',
            top: hasPosition ? `${position.y}px` : '45%',
            left: hasPosition ? `${position.x}px` : '50%',
            transform: 'translateX(-50%)',
            fontSize: '24px',
            fontWeight: '700',
            fontFamily: 'Inter, sans-serif',
            color: color,
            pointerEvents: 'none',
            zIndex: 1000,
            textShadow: '0 2px 4px rgba(0,0,0,0.1)'
          }}
        >
          {message}
        </motion.div>
      )}
    </AnimatePresence>
  )
}
