/**
 * AdminFeedback - Manage user feedback on flashcard errors
 *
 * Features:
 * - View all user feedback submissions
 * - Filter by status (pending/fixed/wont_fix) and archived state
 * - Search by feedback text
 * - Mark as Fixed or Won't Fix
 * - Archive/unarchive items
 * - Add admin notes
 * - Link to lemma/phrase edit pages
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { supabase } from '../lib/supabase'
import {
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  XCircle,
  Archive,
  ArchiveRestore,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Save,
  RotateCcw
} from 'lucide-react'

export default function AdminFeedback() {
  const navigate = useNavigate()
  const { user } = useAuth()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read filters from URL
  const searchTerm = searchParams.get('search') || ''
  const filterStatus = searchParams.get('status') || 'all'
  const filterArchived = searchParams.get('archived') || 'active'
  const sortBy = searchParams.get('sortBy') || 'newest'

  // State
  const [feedback, setFeedback] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [searchInput, setSearchInput] = useState(searchTerm)

  // Inline editing for admin notes
  const [editingNotesId, setEditingNotesId] = useState(null)
  const [editingNotesValue, setEditingNotesValue] = useState('')
  const [savingNotes, setSavingNotes] = useState(false)

  // Pagination
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 25

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    fixed: 0,
    wontFix: 0
  })

  const updateFilter = useCallback((key, value) => {
    const newParams = new URLSearchParams(searchParams)
    const defaults = {
      search: '',
      status: 'all',
      archived: 'active',
      sortBy: 'newest'
    }
    if (value === defaults[key]) {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
    setSearchParams(newParams, { replace: true })
  }, [searchParams, setSearchParams])

  const fetchFeedback = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Build query with joins to get lemma/phrase details
      let query = supabase
        .from('user_feedback')
        .select(`
          *,
          lemmas (lemma_id, lemma_text),
          phrases (phrase_id, phrase_text)
        `, { count: 'exact' })

      // Apply search filter
      if (searchTerm) {
        query = query.ilike('feedback_text', `%${searchTerm}%`)
      }

      // Apply status filter
      if (filterStatus !== 'all') {
        query = query.eq('resolution_status', filterStatus)
      }

      // Apply archived filter
      if (filterArchived === 'active') {
        query = query.eq('is_archived', false)
      } else if (filterArchived === 'archived') {
        query = query.eq('is_archived', true)
      }
      // 'all' shows both

      // Apply sorting
      if (sortBy === 'newest') {
        query = query.order('created_at', { ascending: false })
      } else if (sortBy === 'oldest') {
        query = query.order('created_at', { ascending: true })
      }

      // Apply pagination
      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      setFeedback(data || [])
      setTotalCount(count || 0)

    } catch (err) {
      console.error('Error fetching feedback:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [searchTerm, filterStatus, filterArchived, sortBy, page, pageSize])

  // Fetch stats separately (unfiltered counts)
  const fetchStats = useCallback(async () => {
    try {
      const [
        { count: total },
        { count: pending },
        { count: fixed },
        { count: wontFix }
      ] = await Promise.all([
        supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('is_archived', false),
        supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('resolution_status', 'pending').eq('is_archived', false),
        supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('resolution_status', 'fixed').eq('is_archived', false),
        supabase.from('user_feedback').select('*', { count: 'exact', head: true }).eq('resolution_status', 'wont_fix').eq('is_archived', false)
      ])

      setStats({
        total: total || 0,
        pending: pending || 0,
        fixed: fixed || 0,
        wontFix: wontFix || 0
      })
    } catch (err) {
      console.error('Error fetching stats:', err)
    }
  }, [])

  useEffect(() => {
    fetchFeedback()
  }, [fetchFeedback])

  useEffect(() => {
    fetchStats()
  }, [fetchStats])

  // Debounce search input
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchTerm) {
        updateFilter('search', searchInput)
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchInput, searchTerm, updateFilter])

  // Sync searchInput when URL changes
  useEffect(() => {
    setSearchInput(searchTerm)
  }, [searchTerm])

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0)
  }, [searchTerm, filterStatus, filterArchived, sortBy])

  // Action handlers
  const updateFeedbackStatus = useCallback(async (feedbackId, status) => {
    const { error } = await supabase
      .from('user_feedback')
      .update({
        resolution_status: status,
        resolved_at: new Date().toISOString(),
        resolved_by: user?.id
      })
      .eq('feedback_id', feedbackId)

    if (!error) {
      setFeedback(prev => prev.map(f =>
        f.feedback_id === feedbackId
          ? { ...f, resolution_status: status, resolved_at: new Date().toISOString(), resolved_by: user?.id }
          : f
      ))
      fetchStats()
    }
  }, [user?.id, fetchStats])

  const revertToPending = useCallback(async (feedbackId) => {
    const { error } = await supabase
      .from('user_feedback')
      .update({
        resolution_status: 'pending',
        resolved_at: null,
        resolved_by: null
      })
      .eq('feedback_id', feedbackId)

    if (!error) {
      setFeedback(prev => prev.map(f =>
        f.feedback_id === feedbackId
          ? { ...f, resolution_status: 'pending', resolved_at: null, resolved_by: null }
          : f
      ))
      fetchStats()
    }
  }, [fetchStats])

  const toggleArchived = useCallback(async (item) => {
    const newValue = !item.is_archived
    const { error } = await supabase
      .from('user_feedback')
      .update({ is_archived: newValue })
      .eq('feedback_id', item.feedback_id)

    if (!error) {
      // If filtering by archived state, remove from list; otherwise update
      if (filterArchived !== 'all') {
        setFeedback(prev => prev.filter(f => f.feedback_id !== item.feedback_id))
        setTotalCount(prev => prev - 1)
      } else {
        setFeedback(prev => prev.map(f =>
          f.feedback_id === item.feedback_id
            ? { ...f, is_archived: newValue }
            : f
        ))
      }
      fetchStats()
    }
  }, [filterArchived, fetchStats])

  const startEditingNotes = useCallback((item, e) => {
    e?.stopPropagation()
    setEditingNotesId(item.feedback_id)
    setEditingNotesValue(item.admin_notes || '')
  }, [])

  const saveNotes = useCallback(async (feedbackId) => {
    if (savingNotes) return
    setSavingNotes(true)

    const { error } = await supabase
      .from('user_feedback')
      .update({ admin_notes: editingNotesValue.trim() || null })
      .eq('feedback_id', feedbackId)

    if (!error) {
      setFeedback(prev => prev.map(f =>
        f.feedback_id === feedbackId
          ? { ...f, admin_notes: editingNotesValue.trim() || null }
          : f
      ))
      setEditingNotesId(null)
    }

    setSavingNotes(false)
  }, [editingNotesValue, savingNotes])

  const cancelEditingNotes = useCallback(() => {
    setEditingNotesId(null)
    setEditingNotesValue('')
  }, [])

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      const currentIndex = feedback.findIndex(f => f.feedback_id === selectedId)

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (currentIndex < feedback.length - 1) {
            setSelectedId(feedback[currentIndex + 1].feedback_id)
          } else if (currentIndex === -1 && feedback.length > 0) {
            setSelectedId(feedback[0].feedback_id)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (currentIndex > 0) {
            setSelectedId(feedback[currentIndex - 1].feedback_id)
          }
          break
        default:
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [feedback, selectedId])

  // Format date helper
  const formatDate = (dateStr) => {
    if (!dateStr) return ''
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  }

  // Get status badge styling
  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-700'
      case 'fixed':
        return 'bg-green-100 text-green-700'
      case 'wont_fix':
        return 'bg-gray-100 text-gray-600'
      default:
        return 'bg-neutral-100 text-neutral-600'
    }
  }

  const getStatusLabel = (status) => {
    switch (status) {
      case 'pending':
        return 'Pending'
      case 'fixed':
        return 'Fixed'
      case 'wont_fix':
        return "Won't Fix"
      default:
        return status
    }
  }

  if (error) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 p-8">
        <div className="text-red-600">Error: {error}</div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Active Total</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.total}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Pending</div>
          <div className="text-2xl font-semibold text-yellow-600">{stats.pending}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Fixed</div>
          <div className="text-2xl font-semibold text-green-600">{stats.fixed}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Won't Fix</div>
          <div className="text-2xl font-semibold text-gray-500">{stats.wontFix}</div>
        </div>
      </div>

      {/* Archived Tabs */}
      <div className="flex gap-1 bg-neutral-100 p-1 rounded-lg w-fit">
        {[
          { value: 'active', label: 'Active' },
          { value: 'archived', label: 'Archived' },
          { value: 'all', label: 'All' }
        ].map(tab => (
          <button
            key={tab.value}
            onClick={() => updateFilter('archived', tab.value)}
            className={`px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
              filterArchived === tab.value
                ? 'bg-white text-neutral-900 shadow-sm'
                : 'text-neutral-600 hover:text-neutral-900'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-end">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Search feedback..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Status filter */}
        <select
          value={filterStatus}
          onChange={(e) => updateFilter('status', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="pending">Pending</option>
          <option value="fixed">Fixed</option>
          <option value="wont_fix">Won't Fix</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => updateFilter('sortBy', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="newest">Newest First</option>
          <option value="oldest">Oldest First</option>
        </select>

        {/* Refresh */}
        <button
          onClick={() => { fetchFeedback(); fetchStats(); }}
          className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>

        {/* Clear filters */}
        {(searchTerm || filterStatus !== 'all' || filterArchived !== 'active') && (
          <button
            onClick={() => setSearchParams({})}
            className="px-3 py-2 text-sm text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 rounded-lg"
          >
            Clear Filters
          </button>
        )}
      </div>

      {/* Count + Pagination */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-neutral-500">
          {totalCount > 0
            ? `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalCount)} of ${totalCount.toLocaleString()} feedback items`
            : '0 feedback items'}
        </div>
        {totalCount > pageSize && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage(p => Math.max(0, p - 1))}
              disabled={page === 0}
              className="p-1.5 rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronLeft size={18} />
            </button>
            <span className="text-sm text-neutral-600">
              Page {page + 1} of {Math.ceil(totalCount / pageSize)}
            </span>
            <button
              onClick={() => setPage(p => p + 1)}
              disabled={(page + 1) * pageSize >= totalCount}
              className="p-1.5 rounded text-neutral-500 hover:bg-neutral-100 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              <ChevronRight size={18} />
            </button>
          </div>
        )}
      </div>

      {/* Keyboard hints */}
      <div className="text-xs text-gray-400 flex gap-4">
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">↑/↓</kbd> Navigate</span>
      </div>

      {/* Feedback Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-24">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-28">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  Card
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  Feedback
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide w-48">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                    Loading feedback...
                  </td>
                </tr>
              ) : feedback.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-neutral-400">
                    {searchTerm || filterStatus !== 'all' || filterArchived !== 'active'
                      ? 'No feedback matches your filters'
                      : 'No feedback submissions yet. When users report issues with flashcards, they\'ll appear here.'}
                  </td>
                </tr>
              ) : feedback.map((item) => (
                <tr
                  key={item.feedback_id}
                  onClick={() => setSelectedId(item.feedback_id)}
                  className={`cursor-pointer transition-colors ${
                    selectedId === item.feedback_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  } ${item.is_archived ? 'opacity-60' : ''}`}
                >
                  {/* Status */}
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded whitespace-nowrap ${getStatusBadge(item.resolution_status)}`}>
                      {getStatusLabel(item.resolution_status)}
                    </span>
                    {item.is_archived && (
                      <span className="ml-2 px-2 py-1 text-xs font-medium bg-neutral-100 text-neutral-500 rounded whitespace-nowrap">
                        Archived
                      </span>
                    )}
                  </td>

                  {/* Date */}
                  <td className="px-4 py-3 text-sm text-neutral-500">
                    {formatDate(item.created_at)}
                  </td>

                  {/* Card Info */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MessageSquare size={16} className="text-blue-500 flex-shrink-0" />
                      <div>
                        {item.lemmas ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/admin/lemmas/${item.lemmas.lemma_id}`)
                            }}
                            className="text-sm font-medium text-neutral-800 hover:text-blue-600 hover:underline"
                          >
                            {item.lemmas.lemma_text}
                          </button>
                        ) : item.phrases ? (
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              navigate(`/admin/phrases/${item.phrases.phrase_id}`)
                            }}
                            className="text-sm font-medium text-neutral-800 hover:text-blue-600 hover:underline"
                          >
                            {item.phrases.phrase_text}
                          </button>
                        ) : (
                          <span className="text-sm text-neutral-400 italic">Unknown card</span>
                        )}
                        <div className="text-xs text-neutral-400">
                          {item.lemmas ? 'Lemma' : item.phrases ? 'Phrase' : ''} • {item.card_side || 'unknown'} side
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Feedback Text + Admin Notes */}
                  <td className="px-4 py-3">
                    <div className="text-sm text-neutral-700 max-w-md">
                      {item.feedback_text}
                    </div>
                    {/* Admin notes */}
                    <div className="mt-2">
                      {editingNotesId === item.feedback_id ? (
                        <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingNotesValue}
                            onChange={(e) => setEditingNotesValue(e.target.value)}
                            placeholder="Add admin note..."
                            className="flex-1 px-2 py-1 text-xs border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') saveNotes(item.feedback_id)
                              if (e.key === 'Escape') cancelEditingNotes()
                            }}
                          />
                          <button
                            onClick={() => saveNotes(item.feedback_id)}
                            disabled={savingNotes}
                            className="p-1 text-green-600 hover:bg-green-50 rounded"
                          >
                            <Save size={14} />
                          </button>
                          <button
                            onClick={cancelEditingNotes}
                            className="p-1 text-neutral-400 hover:bg-neutral-100 rounded"
                          >
                            <XCircle size={14} />
                          </button>
                        </div>
                      ) : item.admin_notes ? (
                        <button
                          onClick={(e) => startEditingNotes(item, e)}
                          className="text-xs text-neutral-500 hover:text-neutral-700 italic"
                        >
                          Note: {item.admin_notes}
                        </button>
                      ) : (
                        <button
                          onClick={(e) => startEditingNotes(item, e)}
                          className="text-xs text-neutral-400 hover:text-neutral-600"
                        >
                          + Add note
                        </button>
                      )}
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 flex-nowrap">
                      {item.resolution_status === 'pending' && (
                        <>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              updateFeedbackStatus(item.feedback_id, 'fixed')
                            }}
                            className="px-2 py-1 rounded text-xs font-medium bg-green-50 text-green-700 hover:bg-green-100 transition-colors whitespace-nowrap"
                            title="Mark as Fixed"
                          >
                            <CheckCircle size={14} className="inline mr-1" />
                            Fixed
                          </button>
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              updateFeedbackStatus(item.feedback_id, 'wont_fix')
                            }}
                            className="px-2 py-1 rounded text-xs font-medium bg-neutral-50 text-neutral-600 hover:bg-neutral-100 transition-colors whitespace-nowrap"
                            title="Mark as Won't Fix"
                          >
                            <XCircle size={14} className="inline mr-1" />
                            Won't Fix
                          </button>
                        </>
                      )}
                      {(item.resolution_status === 'fixed' || item.resolution_status === 'wont_fix') && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            revertToPending(item.feedback_id)
                          }}
                          className="p-1.5 rounded text-neutral-400 hover:text-yellow-600 hover:bg-yellow-50 transition-colors"
                          title="Revert to Pending"
                        >
                          <RotateCcw size={14} />
                        </button>
                      )}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          toggleArchived(item)
                        }}
                        className="p-1.5 rounded text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                        title={item.is_archived ? 'Unarchive' : 'Archive'}
                      >
                        {item.is_archived ? <ArchiveRestore size={14} /> : <Archive size={14} />}
                      </button>
                      {(item.lemmas || item.phrases) && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            if (item.lemmas) {
                              navigate(`/admin/lemmas/${item.lemmas.lemma_id}`)
                            } else if (item.phrases) {
                              navigate(`/admin/phrases/${item.phrases.phrase_id}`)
                            }
                          }}
                          className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="View card"
                        >
                          <ExternalLink size={14} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Inline table styles */}
      <style>{`
        .admin-table {
          border-collapse: collapse;
          width: 100%;
        }
        .admin-table th {
          text-align: left;
          padding: 12px 16px;
          font-weight: 500;
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #6b7280;
          border-bottom: 1px solid #e5e7eb;
          background: #f9fafb;
        }
        .admin-table td {
          padding: 12px 16px;
          border-bottom: 1px solid #f3f4f6;
          vertical-align: top;
        }
      `}</style>
    </div>
  )
}
