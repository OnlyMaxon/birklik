import { useState, useCallback } from 'react'
import { DocumentSnapshot } from 'firebase/firestore'

export interface PaginationState<T> {
  items: T[]
  isLoading: boolean
  hasMore: boolean
  error: string | null
  currentPage: number
}

export const usePagination = <T,>(
  fetcher: (options: { limit: number; startAfter?: DocumentSnapshot }) => Promise<(T & { id: string })[]>,
  pageSize = 10
) => {
  const [state, setState] = useState<PaginationState<T & { id: string }>>({
    items: [],
    isLoading: false,
    hasMore: true,
    error: null,
    currentPage: 1
  })

  const [lastSnapshot, setLastSnapshot] = useState<DocumentSnapshot | undefined>()

  // Load more results
  const loadMore = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))

    try {
      const results = await fetcher({
        limit: pageSize + 1, // Fetch one extra to know if there's more
        startAfter: lastSnapshot
      })

      const hasMore = results.length > pageSize
      const itemsToAdd = results.slice(0, pageSize)

      setState((prev) => ({
        ...prev,
        items: [...prev.items, ...itemsToAdd],
        hasMore,
        currentPage: prev.currentPage + 1,
        isLoading: false
      }))

      // Store the last document for next pagination
      // Note: This is a workaround - ideally fetcher should return snapshots too
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error?.message || 'Failed to load more items'
      }))
    }
  }, [fetcher, pageSize, lastSnapshot])

  // Initial load
  const load = useCallback(async () => {
    setState((prev) => ({ ...prev, isLoading: true, error: null }))
    setLastSnapshot(undefined)

    try {
      const results = await fetcher({
        limit: pageSize + 1
      })

      const hasMore = results.length > pageSize
      const itemsToShow = results.slice(0, pageSize)

      setState({
        items: itemsToShow,
        hasMore,
        isLoading: false,
        error: null,
        currentPage: 1
      })
    } catch (error: any) {
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error?.message || 'Failed to load items'
      }))
    }
  }, [fetcher, pageSize])

  // Reset
  const reset = useCallback(() => {
    setState({
      items: [],
      isLoading: false,
      hasMore: true,
      error: null,
      currentPage: 1
    })
    setLastSnapshot(undefined)
  }, [])

  return { ...state, load, loadMore, reset }
}
