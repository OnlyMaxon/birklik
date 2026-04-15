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
  fetcher: (options: { 
    limit: number
    startAfter?: DocumentSnapshot
    onLastDocSnapshot?: (doc: DocumentSnapshot | undefined) => void
  }) => Promise<(T & { id: string })[]>,
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
      let lastDoc: DocumentSnapshot | undefined

      const results = await fetcher({
        limit: pageSize + 1, // Fetch one extra to know if there's more
        startAfter: lastSnapshot,
        onLastDocSnapshot: (doc) => {
          lastDoc = doc
        }
      })

      const hasMore = results.length > pageSize
      const itemsToAdd = results.slice(0, pageSize)

      // CRITICAL FIX: Update lastSnapshot for next page
      if (lastDoc) {
        setLastSnapshot(lastDoc)
      }

      setState((prev) => ({
        ...prev,
        items: [...prev.items, ...itemsToAdd],
        hasMore,
        currentPage: prev.currentPage + 1,
        isLoading: false
      }))
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
      let lastDoc: DocumentSnapshot | undefined

      const results = await fetcher({
        limit: pageSize + 1,
        onLastDocSnapshot: (doc) => {
          lastDoc = doc
        }
      })

      const hasMore = results.length > pageSize
      const itemsToShow = results.slice(0, pageSize)

      // Store last document for pagination
      if (lastDoc) {
        setLastSnapshot(lastDoc)
      }

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
