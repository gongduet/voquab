/**
 * Scroll to Position Hook
 *
 * Handles auto-scroll on load and smooth scrolling for reading mode.
 * Manages scroll behavior for the continuous reading experience.
 *
 * Functions:
 * - scrollToCurrentSentence() - on initial load
 * - scrollToSentence(sentenceId) - when jumping to specific sentence
 * - scrollToBottom() - scroll to show new content
 */

import { useCallback, useRef } from 'react'

export default function useScrollToPosition(containerRef) {
  // Track if initial scroll has happened
  const hasInitialScrolled = useRef(false)

  // Store refs to sentence elements by ID
  const sentenceRefs = useRef(new Map())

  /**
   * Register a sentence element ref
   * Call this from each sentence component
   */
  const registerSentenceRef = useCallback((sentenceId, element) => {
    if (element) {
      sentenceRefs.current.set(sentenceId, element)
    } else {
      sentenceRefs.current.delete(sentenceId)
    }
  }, [])

  /**
   * Scroll to a specific sentence by ID
   */
  const scrollToSentence = useCallback((sentenceId, behavior = 'smooth') => {
    const element = sentenceRefs.current.get(sentenceId)

    if (element) {
      element.scrollIntoView({
        behavior,
        block: 'center'
      })
      return true
    }

    return false
  }, [])

  /**
   * Scroll to the current/active sentence
   * Uses 'auto' for initial load (instant), 'smooth' for user-triggered
   */
  const scrollToCurrentSentence = useCallback((sentenceId, isInitial = false) => {
    if (!sentenceId) return false

    // Small delay to ensure DOM is rendered
    setTimeout(() => {
      const success = scrollToSentence(
        sentenceId,
        isInitial ? 'auto' : 'smooth'
      )

      if (success && isInitial) {
        hasInitialScrolled.current = true
      }
    }, isInitial ? 100 : 0)

    return true
  }, [scrollToSentence])

  /**
   * Scroll to bottom of container (for new content)
   */
  const scrollToBottom = useCallback((behavior = 'smooth') => {
    if (containerRef?.current) {
      containerRef.current.scrollTo({
        top: containerRef.current.scrollHeight,
        behavior
      })
    } else {
      // Fallback to window scroll
      window.scrollTo({
        top: document.body.scrollHeight,
        behavior
      })
    }
  }, [containerRef])

  /**
   * Scroll element into view with offset for sticky header
   */
  const scrollWithHeaderOffset = useCallback((sentenceId, headerHeight = 60) => {
    const element = sentenceRefs.current.get(sentenceId)

    if (element) {
      const elementRect = element.getBoundingClientRect()
      const absoluteElementTop = elementRect.top + window.pageYOffset
      const offsetPosition = absoluteElementTop - headerHeight - 20 // 20px padding

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      })
      return true
    }

    return false
  }, [])

  /**
   * Get current visible sentence (for updating sticky header)
   * Returns the sentence ID that is most visible in the viewport
   */
  const getVisibleSentenceId = useCallback(() => {
    const viewportCenter = window.innerHeight / 2
    let closestId = null
    let closestDistance = Infinity

    sentenceRefs.current.forEach((element, sentenceId) => {
      const rect = element.getBoundingClientRect()
      const elementCenter = rect.top + rect.height / 2
      const distance = Math.abs(elementCenter - viewportCenter)

      if (distance < closestDistance) {
        closestDistance = distance
        closestId = sentenceId
      }
    })

    return closestId
  }, [])

  /**
   * Reset scroll state (for session restart)
   */
  const resetScroll = useCallback(() => {
    hasInitialScrolled.current = false
    sentenceRefs.current.clear()

    // Scroll to top
    if (containerRef?.current) {
      containerRef.current.scrollTo({ top: 0, behavior: 'auto' })
    } else {
      window.scrollTo({ top: 0, behavior: 'auto' })
    }
  }, [containerRef])

  /**
   * Check if initial scroll has been performed
   */
  const hasScrolled = useCallback(() => {
    return hasInitialScrolled.current
  }, [])

  return {
    // Ref registration
    registerSentenceRef,

    // Scroll actions
    scrollToSentence,
    scrollToCurrentSentence,
    scrollToBottom,
    scrollWithHeaderOffset,

    // Utilities
    getVisibleSentenceId,
    resetScroll,
    hasScrolled
  }
}
