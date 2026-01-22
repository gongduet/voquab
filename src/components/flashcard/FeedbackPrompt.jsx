import { useState, useCallback } from 'react'
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'

/**
 * FeedbackPrompt - Inline feedback submission for flashcard errors
 *
 * Shows a subtle "Something wrong?" prompt that expands to a textarea
 * when clicked. Users can report translation errors, typos, etc.
 */
export default function FeedbackPrompt({
  lemmaId,
  phraseId,
  cardSide,
  userId
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [feedbackText, setFeedbackText] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showSuccess, setShowSuccess] = useState(false)
  const [error, setError] = useState(null)

  const handleToggle = useCallback(() => {
    if (!isExpanded) {
      setIsExpanded(true)
      setError(null)
    }
  }, [isExpanded])

  const handleCancel = useCallback(() => {
    setIsExpanded(false)
    setFeedbackText('')
    setError(null)
  }, [])

  const handleSubmit = useCallback(async () => {
    if (!feedbackText.trim() || isSubmitting) return

    setIsSubmitting(true)
    setError(null)

    try {
      const { error: insertError } = await supabase
        .from('user_feedback')
        .insert({
          user_id: userId,
          lemma_id: lemmaId || null,
          phrase_id: phraseId || null,
          // Note: slang_id not in schema, but we capture it via lemma/phrase relationship
          feedback_text: feedbackText.trim(),
          card_side: cardSide
        })

      if (insertError) throw insertError

      // Show success state
      setShowSuccess(true)
      setFeedbackText('')

      // Collapse after 2 seconds
      setTimeout(() => {
        setShowSuccess(false)
        setIsExpanded(false)
      }, 2000)
    } catch (err) {
      console.error('Error submitting feedback:', err)
      setError('Failed to submit. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }, [feedbackText, isSubmitting, userId, lemmaId, phraseId, cardSide])

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      handleCancel()
    } else if (e.key === 'Enter' && e.metaKey) {
      handleSubmit()
    }
  }, [handleCancel, handleSubmit])

  // Don't render if no user
  if (!userId) return null

  return (
    <div style={styles.container}>
      <AnimatePresence mode="wait">
        {showSuccess ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            style={styles.success}
          >
            Thanks! We'll review this.
          </motion.div>
        ) : isExpanded ? (
          <motion.div
            key="expanded"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            style={styles.expandedContainer}
          >
            <textarea
              value={feedbackText}
              onChange={(e) => setFeedbackText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="What's wrong with this card?"
              rows={3}
              style={styles.textarea}
              autoFocus
            />
            {error && (
              <p style={styles.error}>{error}</p>
            )}
            <div style={styles.buttonRow}>
              <button
                onClick={handleCancel}
                style={styles.cancelButton}
                disabled={isSubmitting}
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                style={{
                  ...styles.submitButton,
                  opacity: (!feedbackText.trim() || isSubmitting) ? 0.5 : 1,
                  cursor: (!feedbackText.trim() || isSubmitting) ? 'not-allowed' : 'pointer'
                }}
                disabled={!feedbackText.trim() || isSubmitting}
              >
                {isSubmitting ? 'Sending...' : 'Submit'}
              </button>
            </div>
          </motion.div>
        ) : (
          <motion.button
            key="collapsed"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={handleToggle}
            style={styles.prompt}
          >
            Something wrong? Let us know.
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  )
}

const styles = {
  container: {
    marginTop: '16px',
    textAlign: 'center',
    fontFamily: 'Inter, sans-serif'
  },
  prompt: {
    background: 'none',
    border: 'none',
    color: '#94a3b8', // slate-400
    fontSize: '13px',
    cursor: 'pointer',
    padding: '8px 16px',
    borderRadius: '8px',
    transition: 'all 0.15s ease'
  },
  expandedContainer: {
    overflow: 'hidden'
  },
  textarea: {
    width: '100%',
    maxWidth: '400px',
    padding: '12px',
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    border: '1px solid #e2e8f0',
    borderRadius: '8px',
    resize: 'none',
    outline: 'none',
    boxSizing: 'border-box',
    backgroundColor: '#f8fafc'
  },
  buttonRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: '12px',
    marginTop: '12px'
  },
  cancelButton: {
    background: 'none',
    border: 'none',
    color: '#64748b', // slate-500
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    cursor: 'pointer',
    padding: '8px 16px'
  },
  submitButton: {
    background: '#d4a574', // gold accent
    border: 'none',
    color: '#fff',
    fontSize: '14px',
    fontFamily: 'Inter, sans-serif',
    fontWeight: '500',
    cursor: 'pointer',
    padding: '8px 20px',
    borderRadius: '6px',
    transition: 'opacity 0.15s ease'
  },
  success: {
    color: '#5aada4', // teal accent
    fontSize: '14px',
    fontWeight: '500',
    padding: '8px'
  },
  error: {
    color: '#ef4444',
    fontSize: '13px',
    marginTop: '8px'
  }
}
