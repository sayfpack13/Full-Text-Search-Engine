import { useState, useEffect, useCallback } from 'react';

const usePaginatedSearch = (searchFunction, options = {}) => {
  const {
    initialLimit = 20,
    enableVirtualScroll = false,
    maxResults = 10000,
    enableStreaming = false
  } = options;

  const [state, setState] = useState({
    results: [],
    total: 0,
    loading: false,
    error: null,
    hasMore: true,
    currentOffset: 0,
    sessionId: null,
    cached: false,
    timestamp: null
  });

  const [pagination, setPagination] = useState({
    limit: initialLimit,
    page: 1,
    totalPages: 0
  });

  // Generate session ID
  const getSessionId = () => {
    return 'search_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  };

  const performSearch = useCallback(async (query, reset = true) => {
    if (!query?.trim()) return;

    const sessionId = getSessionId();
    
    setState(prev => ({
      ...prev,
      loading: true,
      error: null,
      sessionId
    }));

    if (reset) {
      setState(prev => ({
        ...prev,
        results: [],
        currentOffset: 0
      }));
    }

    try {
      const searchParams = {
        query: query.trim(),
        limit: enableVirtualScroll ? Math.max(pagination.limit * 2, 100) : pagination.limit,
        offset: reset ? 0 : state.currentOffset,
        sessionId,
        stream: enableStreaming && pagination.limit > 100
      };

      const response = await fetch('/api/search/query', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(searchParams)
      });

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error?.message || 'Search failed');
      }

      const result = data.data;
      
      setState(prev => ({
        ...prev,
        results: reset ? result.results : [...prev.results, ...result.results],
        total: result.total || 0,
        currentOffset: result.pagination?.nextOffset || (prev.currentOffset + pagination.limit),
        hasMore: result.pagination?.hasMore || false,
        loading: false,
        cached: result.cached || false,
        timestamp: result.timestamp || new Date().toISOString()
      }));

      setPagination(prev => ({
        ...prev,
        page: result.pagination ? 
          Math.floor(result.currentOffset / pagination.limit) + 1 : 
          prev.page,
        totalPages: result.total ? 
          Math.ceil(result.total / pagination.limit) : 
          prev.totalPages
      }));

    } catch (error) {
      setState(prev => ({
        ...prev,
        loading: false,
        error: error.message
      }));
    }
  }, [pagination.limit, enableVirtualScroll, enableStreaming, state.currentOffset]);

  const loadMore = useCallback(async (query) => {
    if (!state.hasMore || state.loading) return;
    await performSearch(query, false);
  }, [state.hasMore, state.loading, performSearch]);

  const changePage = useCallback((newPage, query) => {
    if (newPage < 1 || newPage === pagination.page) return;
    
    const newOffset = (newPage - 1) * pagination.limit;
    setState(prev => ({
      ...prev,
      currentOffset: newOffset
    }));
    
    performSearch(query, true);
  }, [pagination.page, pagination.limit, performSearch]);

  const changePageSize = useCallback((newSize, query) => {
    if (newSize === pagination.limit) return;
    
    setPagination(prev => ({
      ...prev,
      limit: newSize,
      page: 1,
      totalPages: 0
    }));
    
    setState(prev => ({
      ...prev,
      currentOffset: 0,
      results: [],
      hasMore: true
    }));
    
    performSearch(query, true);
  }, [pagination.limit, performSearch]);

  const clearResults = useCallback(() => {
    setState({
      results: [],
      total: 0,
      loading: false,
      error: null,
      hasMore: true,
      currentOffset: 0,
      sessionId: null,
      cached: false,
      timestamp: null
    });
    
    setPagination({
      limit: initialLimit,
      page: 1,
      totalPages: 0
    });
  }, [initialLimit]);

  // Auto-clear error after a delay
  useEffect(() => {
    if (state.error) {
      const timer = setTimeout(() => {
        setState(prev => ({ ...prev, error: null }));
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [state.error]);

  return {
    // Data
    results: state.results,
    total: state.total,
    hasMore: state.hasMore,
    
    // Loading states
    loading: state.loading,
    error: state.error,
    
    // Pagination
    pagination: {
      page: pagination.page,
      limit: pagination.limit,
      totalPages: pagination.totalPages,
      currentOffset: state.currentOffset
    },
    
    // Actions
    search: performSearch,
    loadMore,
    changePage,
    changePageSize,
    clearResults,
    
    // Metadata
    sessionId: state.sessionId,
    cached: state.cached,
    timestamp: state.timestamp,
    
    // Utilities
    isVirtualScroll: enableVirtualScroll && state.results.length > pagination.limit,
    canStream: enableStreaming && state.total > maxResults
  };
};

export default usePaginatedSearch;

