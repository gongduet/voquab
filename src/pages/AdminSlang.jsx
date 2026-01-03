/**
 * AdminSlang - Manage slang terms for lyrics-based learning
 *
 * Features:
 * - View all slang terms
 * - Filter by region, formality, approval status
 * - Search by term or definition
 * - Toggle approval status
 * - Link to Slang Deep Dive
 */

import { useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import {
  Search,
  RefreshCw,
  ExternalLink,
  CheckCircle,
  Circle,
  MessageCircle,
  Plus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

export default function AdminSlang() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // Read filters from URL
  const searchTerm = searchParams.get('search') || ''
  const filterRegion = searchParams.get('region') || 'all'
  const filterFormality = searchParams.get('formality') || 'all'
  const filterApproved = searchParams.get('approved') || 'all'
  const sortBy = searchParams.get('sortBy') || 'term'
  const sortOrder = searchParams.get('sortOrder') || 'asc'

  // State
  const [slangTerms, setSlangTerms] = useState([])
  const [regions, setRegions] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [searchInput, setSearchInput] = useState(searchTerm)

  // Pagination
  const [page, setPage] = useState(0)
  const [totalCount, setTotalCount] = useState(0)
  const pageSize = 50

  // Stats
  const [stats, setStats] = useState({
    total: 0,
    approved: 0,
    unapproved: 0
  })

  const updateFilter = useCallback((key, value) => {
    const newParams = new URLSearchParams(searchParams)
    const defaults = {
      search: '',
      region: 'all',
      formality: 'all',
      approved: 'all',
      sortBy: 'term',
      sortOrder: 'asc'
    }
    if (value === defaults[key]) {
      newParams.delete(key)
    } else {
      newParams.set(key, value)
    }
    setSearchParams(newParams, { replace: true })
  }, [searchParams, setSearchParams])

  const fetchSlangTerms = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      // Build query with filters
      let query = supabase
        .from('slang_terms')
        .select('*', { count: 'exact' })

      // Apply search filter
      if (searchTerm) {
        query = query.or(`term.ilike.%${searchTerm}%,definition.ilike.%${searchTerm}%`)
      }

      // Apply region filter
      if (filterRegion !== 'all') {
        query = query.eq('region', filterRegion)
      }

      // Apply formality filter
      if (filterFormality !== 'all') {
        query = query.eq('formality', filterFormality)
      }

      // Apply approval status filter
      if (filterApproved === 'approved') {
        query = query.eq('is_approved', true)
      } else if (filterApproved === 'unapproved') {
        query = query.eq('is_approved', false)
      }

      // Apply sorting
      query = query.order(sortBy, { ascending: sortOrder === 'asc' })

      // Apply pagination
      const from = page * pageSize
      const to = from + pageSize - 1
      query = query.range(from, to)

      const { data, error: fetchError, count } = await query

      if (fetchError) throw fetchError

      setSlangTerms(data || [])
      setTotalCount(count || 0)

      // Fetch unique regions for filter dropdown (only once)
      if (regions.length === 0) {
        const { data: allSlang } = await supabase
          .from('slang_terms')
          .select('region')

        const uniqueRegions = [...new Set(allSlang?.map(s => s.region).filter(Boolean))]
        setRegions(uniqueRegions)
      }

    } catch (err) {
      console.error('Error fetching slang terms:', err)
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }, [searchTerm, filterRegion, filterFormality, filterApproved, sortBy, sortOrder, page, pageSize, regions.length])

  useEffect(() => {
    fetchSlangTerms()
  }, [fetchSlangTerms])

  // Update stats based on current page data and total count
  useEffect(() => {
    const approved = slangTerms.filter(s => s.is_approved).length
    setStats({ total: totalCount, approved, unapproved: slangTerms.length - approved })
  }, [slangTerms, totalCount])

  // Debounce search input - wait 300ms after user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchInput !== searchTerm) {
        updateFilter('search', searchInput)
      }
    }, 300)

    return () => clearTimeout(timer)
  }, [searchInput, searchTerm, updateFilter])

  // Sync searchInput when URL changes (e.g., clear filters button)
  useEffect(() => {
    setSearchInput(searchTerm)
  }, [searchTerm])

  // Reset to page 0 when filters change
  useEffect(() => {
    setPage(0)
  }, [searchTerm, filterRegion, filterFormality, filterApproved, sortBy, sortOrder])

  const toggleApproved = useCallback(async (slang) => {
    const newValue = !slang.is_approved
    const { error } = await supabase
      .from('slang_terms')
      .update({ is_approved: newValue })
      .eq('slang_id', slang.slang_id)

    if (!error) {
      setSlangTerms(prev => prev.map(s =>
        s.slang_id === slang.slang_id
          ? { ...s, is_approved: newValue }
          : s
      ))
    }
  }, [])

  // Keyboard navigation (uses slangTerms which is already filtered/sorted server-side)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      const currentIndex = slangTerms.findIndex(s => s.slang_id === selectedId)

      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          if (currentIndex < slangTerms.length - 1) {
            setSelectedId(slangTerms[currentIndex + 1].slang_id)
          } else if (currentIndex === -1 && slangTerms.length > 0) {
            setSelectedId(slangTerms[0].slang_id)
          }
          break
        case 'ArrowUp':
          e.preventDefault()
          if (currentIndex > 0) {
            setSelectedId(slangTerms[currentIndex - 1].slang_id)
          }
          break
        case 'Enter':
          e.preventDefault()
          if (selectedId) {
            navigate(`/admin/slang/${selectedId}`)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [slangTerms, selectedId, navigate])

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Total Terms</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.total}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Approved</div>
          <div className="text-2xl font-semibold text-green-600">{stats.approved}</div>
        </div>
        <div className="bg-white border border-neutral-200 rounded-lg p-4">
          <div className="text-xs text-neutral-500 uppercase tracking-wide mb-1">Needs Review</div>
          <div className="text-2xl font-semibold text-neutral-900">{stats.unapproved}</div>
        </div>
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
            placeholder="Search slang..."
            className="w-full pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Region filter */}
        <select
          value={filterRegion}
          onChange={(e) => updateFilter('region', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Regions</option>
          {regions.map(region => (
            <option key={region} value={region}>{region}</option>
          ))}
        </select>

        {/* Formality filter */}
        <select
          value={filterFormality}
          onChange={(e) => updateFilter('formality', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Formality</option>
          <option value="informal">Informal</option>
          <option value="vulgar">Vulgar</option>
          <option value="neutral">Neutral</option>
        </select>

        {/* Approval filter */}
        <select
          value={filterApproved}
          onChange={(e) => updateFilter('approved', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="all">All Status</option>
          <option value="approved">Approved</option>
          <option value="unapproved">Needs Review</option>
        </select>

        {/* Sort */}
        <select
          value={sortBy}
          onChange={(e) => updateFilter('sortBy', e.target.value)}
          className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
        >
          <option value="term">Sort by Term</option>
          <option value="region">Sort by Region</option>
          <option value="formality">Sort by Formality</option>
        </select>

        {/* Sort order */}
        <button
          onClick={() => updateFilter('sortOrder', sortOrder === 'asc' ? 'desc' : 'asc')}
          className="px-3 py-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-700 rounded-lg text-sm"
        >
          {sortOrder === 'asc' ? '↑' : '↓'}
        </button>

        {/* Refresh */}
        <button
          onClick={fetchSlangTerms}
          className="p-2 bg-neutral-100 hover:bg-neutral-200 text-neutral-600 rounded-lg"
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>

        {/* Clear filters */}
        {(searchTerm || filterRegion !== 'all' || filterFormality !== 'all' || filterApproved !== 'all') && (
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
            ? `Showing ${page * pageSize + 1}–${Math.min((page + 1) * pageSize, totalCount)} of ${totalCount.toLocaleString()} slang terms`
            : '0 slang terms'}
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
        <span><kbd className="px-1.5 py-0.5 bg-gray-100 rounded text-gray-600">Enter</kbd> Open details</span>
      </div>

      {/* Slang Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="admin-table w-full">
            <thead>
              <tr className="bg-neutral-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  Term
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide">
                  Definition
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-32">
                  Region
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-neutral-500 uppercase tracking-wide w-28">
                  Formality
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-neutral-500 uppercase tracking-wide w-24">
                  Approved
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-neutral-500 uppercase tracking-wide w-24">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-neutral-400">
                    Loading slang terms...
                  </td>
                </tr>
              ) : slangTerms.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-12 text-center text-neutral-400">
                    No slang terms match your filters
                  </td>
                </tr>
              ) : slangTerms.map((slang) => (
                <tr
                  key={slang.slang_id}
                  onClick={() => setSelectedId(slang.slang_id)}
                  className={`cursor-pointer transition-colors ${
                    selectedId === slang.slang_id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <MessageCircle size={16} className="text-purple-500" />
                      <span className="font-medium text-neutral-800">
                        {slang.term}
                      </span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-neutral-600">
                    {slang.definition}
                  </td>
                  <td className="px-4 py-3">
                    {slang.region && (
                      <span className="px-2 py-1 text-xs font-medium bg-blue-100 text-blue-700 rounded">
                        {slang.region}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded ${
                      slang.formality === 'vulgar' ? 'bg-red-100 text-red-700' :
                      slang.formality === 'informal' ? 'bg-yellow-100 text-yellow-700' :
                      slang.formality === 'neutral' ? 'bg-green-100 text-green-700' :
                      'bg-neutral-100 text-neutral-600'
                    }`}>
                      {slang.formality || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        toggleApproved(slang)
                      }}
                      className={`p-1 rounded transition-colors ${
                        slang.is_approved
                          ? 'text-green-600 hover:bg-green-50'
                          : 'text-neutral-300 hover:bg-neutral-50 hover:text-neutral-500'
                      }`}
                    >
                      {slang.is_approved ? (
                        <CheckCircle size={18} className="fill-green-100" />
                      ) : (
                        <Circle size={18} />
                      )}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        navigate(`/admin/slang/${slang.slang_id}`)
                      }}
                      className="p-1.5 rounded text-neutral-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                      title="View slang details"
                    >
                      <ExternalLink size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
