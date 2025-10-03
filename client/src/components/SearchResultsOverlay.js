import React, { useState, useCallback } from 'react';

// Global state for sidebar visibility and pagination
window.searchResultsState = {
  isVisible: false,
  task: null,
  listeners: [],
  pagination: {
    currentPage: 1,
    pageSize: 20,
    totalResults: 0,
    totalPages: 0
  }
};

window.searchResultsActions = {
  showResults: (task) => {
    window.searchResultsState.isVisible = true;
    window.searchResultsState.task = task;
    
    // Initialize pagination
    window.searchResultsState.pagination.currentPage = 1;
    // Note: We'll update these after results are loaded
    window.searchResultsState.pagination.totalResults = 0;
    window.searchResultsState.pagination.totalPages = 0;
    
    // Immediately populate dialog data
    window.searchResultsActions.populateDialogData(task);
    
    const backdrop = document.getElementById('search-results-backdrop');
    const dialog = document.getElementById('search-results-dialog');
    
    if (backdrop && dialog) {
      backdrop.style.display = 'flex';
      backdrop.style.opacity = '0';
      dialog.style.transform = 'scale(0.9) translateY(20px)';
      
      // Trigger animation
      setTimeout(() => {
        backdrop.style.opacity = '1';
        dialog.style.transform = 'scale(1) translateY(0)';
      }, 10);
    }
  },
  
  populateDialogData: async (task, providedResultsData = null) => {
    // Populate dialog data
    
    // Update title and subtitle
    const title = document.getElementById('dialog-title');
    const subtitle = document.getElementById('dialog-subtitle');
    if (title && subtitle) {
      title.textContent = `Search Results`;
      subtitle.textContent = `Query: "${task.params?.query || 'N/A'}"`;
      // Updated title/subtitle
    }
    
    let resultsData = providedResultsData;
    
    // Only fetch from backend if no data was provided
    if (!resultsData) {
      // Show loading state
      const loadingContainer = document.getElementById('results-container');
      if (loadingContainer) {
        loadingContainer.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #666;">
            <div style="font-size: 16px; margin-bottom: 12px;">Loading search results...</div>
            <div style="font-size: 14px; color: #999;">Fetching data from backend</div>
          </div>
        `;
      }
      
      // Always fetch results from backend (no frontend caching)
      // Loading results for task
      try {
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/${task.id}/results?limit=20&offset=0`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const responseData = await response.json();
      if (responseData.success) {
        resultsData = {
          ...task.result,
          results: responseData.data.results,
          total: responseData.data.total
        };
        // Results loaded
      } else {
        throw new Error(responseData.error || 'Failed to load results');
      }
    } catch (error) {
      console.error('Error loading results:', error);
      if (loadingContainer) {
        loadingContainer.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #f44336;">
            <div style="font-size: 16px; margin-bottom: 12px;">Error loading results</div>
            <div style="font-size: 14px; color: #999;">${error.message}</div>
          </div>
        `;
      }
      return;
    }
    }
    
    // Update pagination with loaded results
    window.searchResultsState.pagination.totalResults = resultsData.total || resultsData.results?.length || 0;
    window.searchResultsState.pagination.totalPages = Math.ceil(
      window.searchResultsState.pagination.totalResults / window.searchResultsState.pagination.pageSize
    );
    
    // Pagination debug info collected
    
    
    // Update stats cards
    const statsContainer = document.getElementById('stats-container');
    if (statsContainer) {
      const duration = task.started && task.completed ? 
        Math.round((new Date(task.completed) - new Date(task.started)) / 1000) : 0;
        
      statsContainer.innerHTML = `
        <div style="
          background: linear-gradient(135deg, #43a047, #66bb6a);
          color: white;
          padding: 16px;
          border-radius: 8px;
          text-align: center;
        ">
          <div style="font-size: 24px; font-weight: 500;">${resultsData.total || 0}</div>
          <div style="font-size: 14px; opacity: 0.9;">Matches Found</div>
        </div>
        <div style="
          background: linear-gradient(135deg, #1976d2, #42a5f5);
          color: white;
          padding: 16px;
          border-radius: 8px;
          text-align: center;
        ">
          <div style="font-size: 24px; font-weight: 500;">${resultsData.filesSearched || 0}</div>
          <div style="font-size: 14px; opacity: 0.9;">Files Searched</div>
        </div>
        <div style="
          background: linear-gradient(135deg, #7b1fa2, #ab47bc);
          color: white;
          padding: 16px;
          border-radius: 8px;
          text-align: center;
        ">
          <div style="font-size: 24px; font-weight: 500;">${duration}s</div>
          <div style="font-size: 14px; opacity: 0.9;">Duration</div>
        </div>
      `;
      // Updated stats cards
    }
    
    // Update results with pagination
    const resultsContainer = document.getElementById('results-container');
    const footerInfo = document.getElementById('footer-info');
    const paginationContainer = document.getElementById('pagination-container');
    
    if (resultsContainer && resultsData.results) {
      const { currentPage, pageSize, totalResults } = window.searchResultsState.pagination;
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const results = resultsData.results.slice(startIndex, endIndex);
      
      // Pagination mode - always use simple pagination
      resultsContainer.innerHTML = results.map((result, index) => `
        <div style="
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          background: white;
          transition: box-shadow 0.2s;
        " onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" 
           onmouseout="this.style.boxShadow='none'">
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 12px;
          ">
            <div style="
              display: flex;
              align-items: center;
              gap: 8px;
            ">
              <div style="
                width: 24px;
                height: 24px;
                background: #1976d2;
                color: white;
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 500;
              ">${startIndex + index + 1}</div>
              <h3 style="
                margin: 0;
                font-size: 16px;
                font-weight: 500;
                color: rgba(0, 0, 0, 0.87);
              ">Result ${startIndex + index + 1}</h3>
            </div>
            <div style="
              background: rgba(25, 118, 210, 0.1);
              color: #1976d2;
              padding: 4px 8px;
              border-radius: 4px;
              font-size: 12px;
              font-weight: 500;
            ">Score: ${Math.round(result.score)}</div>
          </div>
          
          <div style="
            background: rgba(0, 0, 0, 0.04);
            padding: 12px;
            border-radius: 6px;
            margin-bottom: 12px;
            border-left: 4px solid #1976d2;
          ">
            <p style="
              margin: 0;
              font-size: 14px;
              line-height: 1.5;
              color: rgba(0, 0, 0, 0.87);
            ">${result.content}</p>
          </div>
          
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: rgba(0, 0, 0, 0.6);
          ">
            <div style="gap: 16px; display: flex;">
              <span style="font-weight: 500;">📄 ${result.path.split('/').pop()}</span>
              <span style="font-weight: 500;">📍 Line ${result.line_number + 1}</span>
            </div>
            ${result.indexed_at ? `<span style="font-style: italic;">Added ${new Date(result.indexed_at).toLocaleDateString()}</span>` : ''}
          </div>
        </div>
        `).join('');
      
      // Updated results container
      
      // Update pagination controls
      if (paginationContainer) {
        const totalPages = Math.ceil(totalResults / pageSize);
        paginationContainer.innerHTML = `
          <div style="display: flex; justify-content: center; align-items: center; gap: 8px; margin-top: 16px;">
            <button id="prev-page" style="
              padding: 8px 12px; border: 1px solid #e0e0e0; background: ${currentPage === 1 ? '#f5f5f5' : 'white'};
              color: ${currentPage === 1 ? '#999' : '#1976d2'}; border-radius: 4px; cursor: ${currentPage === 1 ? 'not-allowed' : 'pointer'};
              font-size: 14px;
            " ${currentPage === 1 ? 'disabled' : ''}">← Previous</button>
            
            <span style="font-size: 14px; color: #666;">
              Page ${currentPage} of ${totalPages}
            </span>
            
            <button id="next-page" style="
              padding: 8px 12px; border: 1px solid #e0e0e0; background: ${currentPage === totalPages ? '#f5f5f5' : 'white'};
              color: ${currentPage === totalPages ? '#999' : '#1976d2'}; border-radius: 4px; cursor: ${currentPage === totalPages ? 'not-allowed' : 'pointer'};
              font-size: 14px;
            " ${currentPage === totalPages ? 'disabled' : ''}">Next →</button>
            
            <div style="margin-left: 16px;">
              <select id="page-size-select" style="padding: 6px; border: 1px solid #e0e0e0; border-radius: 4px;">
                <option value="10" ${pageSize === 10 ? 'selected' : ''}>10 per page</option>
                <option value="20" ${pageSize === 20 ? 'selected' : ''}>20 per page</option>
                <option value="50" ${pageSize === 50 ? 'selected' : ''}>50 per page</option>
                <option value="100" ${pageSize === 100 ? 'selected' : ''}>100 per page</option>
              </select>
            </div>
          </div>
        `;
        
        // Clear old listeners and add new ones for pagination
        window.searchResultsActions.clearPaginationListeners();
        // Add listeners after HTML regeneration
        setTimeout(() => {
          console.log('Adding pagination listeners after HTML regeneration');
          window.searchResultsActions.addPaginationListeners(task);
        }, 50);
      }
      
      // Footer info
      if (footerInfo) {
        const showing = Math.min(pageSize, results.length);
        footerInfo.innerHTML = `Showing ${startIndex + 1}-${startIndex + showing} of ${totalResults} results • Page ${currentPage} of ${Math.ceil(totalResults / pageSize)} • Executed ${new Date(task.completed).toLocaleString()}`;
        console.log('Updated footer info:', `${showing} of ${totalResults} results`);
      }
    } else {
      console.log('No results container or results found', { 
        hasContainer: !!resultsContainer, 
        hasResults: !!resultsData.results 
      });
    }
    
    // Debug final state
    setTimeout(() => {
      const prevBtn = document.getElementById('prev-page');
      const nextBtn = document.getElementById('next-page');
      console.log('Final pagination state debug:', {
        currentPage: window.searchResultsState.pagination.currentPage,
        totalPages: window.searchResultsState.pagination.totalPages,
        totalResults: window.searchResultsState.pagination.totalResults,
        pageSize: window.searchResultsState.pagination.pageSize,
        hasButtons: { prevBtn: !!prevBtn, nextBtn: !!nextBtn },
        buttonClickable: {
          prev: prevBtn?.style?.pointerEvents !== 'none' && !prevBtn?.disabled,
          next: nextBtn?.style?.pointerEvents !== 'none' && !nextBtn?.disabled
        }
      });
    }, 100);
  },

  clearPaginationListeners: () => {
    console.log('Clearing pagination listeners...');
    
    // Store references to prevent race conditions
    const paginationContainer = document.getElementById('pagination-container');
    if (!paginationContainer) {
      console.log('No pagination container found');
      return;
    }
    
    // Clear all listeners by removing and recreating the container content
    const html = paginationContainer.innerHTML;
    paginationContainer.innerHTML = '';
    // Give DOM time to clear
    setTimeout(() => {
      paginationContainer.innerHTML = html;
      console.log('Pagination HTML regenerated');
    }, 10);
  },

  addPaginationListeners: (task) => {
    // Previous page button
    const prevButton = document.getElementById('prev-page');
    if (prevButton) {
      prevButton.addEventListener('click', async () => {
        const { currentPage, totalResults, pageSize } = window.searchResultsState.pagination;
        console.log('Previous button clicked. Current state:', { currentPage, totalResults, pageSize });
        if (currentPage > 1) {
          console.log('Loading page:', currentPage - 1);
          await window.searchResultsActions.loadPageResults(task, currentPage - 1, pageSize);
          console.log('Navigated to page:', currentPage - 1);
        } else {
          console.log('Cannot go to previous page - already on page 1');
        }
      });
    }

    // Next page button
    const nextButton = document.getElementById('next-page');
    if (nextButton) {
      nextButton.addEventListener('click', async () => {
        const { currentPage, totalResults, pageSize } = window.searchResultsState.pagination;
        const totalPages = Math.ceil(totalResults / pageSize);
        console.log('Next button clicked. Current state:', { currentPage, totalResults, pageSize, totalPages });
        if (currentPage < totalPages) {
          console.log('Loading page:', currentPage + 1);
          await window.searchResultsActions.loadPageResults(task, currentPage + 1, pageSize);
          console.log('Navigated to page:', currentPage + 1);
        } else {
          console.log('Cannot go to next page - already on last page:', totalPages);
        }
      });
    }

    // Page size selector
    const pageSizeSelect = document.getElementById('page-size-select');
    if (pageSizeSelect) {
      pageSizeSelect.addEventListener('change', (e) => {
        const newPageSize = parseInt(e.target.value);
        const { totalResults } = window.searchResultsState.pagination;
        
        // Reset to page 1 when changing page size
        window.searchResultsState.pagination.pageSize = newPageSize;
        window.searchResultsState.pagination.currentPage = 1;
        window.searchResultsState.pagination.totalPages = Math.ceil(totalResults / newPageSize);
        
        // Call loadPageResults after a brief delay to avoid race conditions
        window.searchResultsActions.loadPageResults(task, 1, newPageSize);
        console.log('Changed page size to:', newPageSize);
      });
    }

  },

  loadPageResults: async (task, page, pageSize) => {
    console.log('loadPageResults called:', { taskId: task.id, page, pageSize });
    window.searchResultsState.pagination.currentPage = page;
    
    // Show loading state
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer) {
      resultsContainer.innerHTML = `
        <div style="text-align: center; padding: 20px; color: #666;">
          Loading page ${page}... <div style="font-size: 12px; color: #999;">Fetching results from backend</div>
        </div>
      `;
    }
    
    try {
      const offset = (page - 1) * pageSize;
      const token = localStorage.getItem('token');
      const response = await fetch(`/api/tasks/${task.id}/results?limit=${pageSize}&offset=${offset}`, {
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });
      const responseData = await response.json();
      
      if (responseData.success) {
        // Update pagination state
        window.searchResultsState.pagination.currentPage = page;
        
        // Update only the results content and pagination, don't regenerate entire dialog
        await window.searchResultsActions.updatePageResults(responseData.data, task);
        // Page results loaded
      } else {
        throw new Error(responseData.error || 'Failed to load page');
      }
    } catch (error) {
      console.error('Error loading page results:', error);
      if (resultsContainer) {
        resultsContainer.innerHTML = `
          <div style="text-align: center; padding: 20px; color: #f44336;">
            <div style="font-size: 16px; margin-bottom: 8px;">Error loading page ${page}</div>
            <div style="font-size: 14px; color: #999;">${error.message}</div>
          </div>
        `;
      }
    }
  },

  updatePageResults: (resultsData, task) => {
    console.log('Updating page results without full dialog regeneration');
    
    // Update pagination total if provided
    if (resultsData.total) {
      window.searchResultsState.pagination.totalResults = resultsData.total;
      window.searchResultsState.pagination.totalPages = Math.ceil(
        window.searchResultsState.pagination.totalResults / window.searchResultsState.pagination.pageSize
      );
    }
    
    // Update only the results container
    const resultsContainer = document.getElementById('results-container');
    if (resultsContainer && resultsData.results) {
      const { currentPage, pageSize, totalResults } = window.searchResultsState.pagination;
      const startIndex = (currentPage - 1) * pageSize;
      const endIndex = startIndex + pageSize;
      const results = resultsData.results;
      
      resultsContainer.innerHTML = results.map((result, index) => `
        <div style="
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          margin-bottom: 16px;
          background: white;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
          transition: box-shadow 0.2s ease;
        " onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.15)'" onmouseout="this.style.boxShadow='0 1px 3px rgba(0,0,0,0.1)'">
          <!-- Header -->
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 12px;
            flex-wrap: wrap;
            gap: 8px;
          ">
            <div style="flex: 1; min-width: 200px;">
              <div style="font-weight: 600; color: #1976d2; margin-bottom: 4px;">
                ${result.path ? result.path.split('/').pop() : 'Unknown File'}
              </div>
              <div style="font-size: 14px; color: #666;">
                Line ${result.line_number + 1}
              </div>
            </div>
            <div style="
              background: linear-gradient(135deg, #43a047, #66bb6a);
              color: white;
              padding: 4px 8px;
              border-radius: 12px;
              font-size: 12px;
              font-weight: 500;
            ">Score: ${Math.round(result.score * 100) || 0}</div>
          </div>
          
          <!-- Content Preview -->
          <div style="
            background: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 6px;
            padding: 12px;
            margin-bottom: 8px;
            font-family: 'Courier New', monospace;
            font-size: 13px;
            line-height: 1.4;
            color: #333;
            overflow-x: auto;
          ">${result.content || 'No content preview'}</div>
          
          <!-- Footer -->
          <div style="
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12px;
            color: #666;
          ">
            <div style="display: flex; gap: 12px; align-items: center;">
              <span style="font-weight: 500;">📄 ${result.path.split('/').pop()}</span>
              <span style="font-weight: 500;">📍 Line ${result.line_number + 1}</span>
            </div>
            ${result.indexed_at ? `<span style="font-style: italic;">Added ${new Date(result.indexed_at).toLocaleDateString()}</span>` : ''}
          </div>
        </div>
      `).join('');
    }
    
    // Update pagination display (without regenerating buttons)
    const paginationContainer = document.getElementById('pagination-container');
    if (paginationContainer) {
      const { currentPage, pageSize, totalResults, totalPages } = window.searchResultsState.pagination;
      const currentSpan = paginationContainer.querySelector('span');
      if (currentSpan) {
        currentSpan.innerHTML = `Page ${currentPage} of ${totalPages}`;
      }
      
      // Update button states
      const prevButton = document.getElementById('prev-page');
      const nextButton = document.getElementById('next-page');
      
      if (prevButton) {
        prevButton.disabled = currentPage === 1;
        prevButton.style.background = currentPage === 1 ? '#f5f5f5' : 'white';
        prevButton.style.color = currentPage === 1 ? '#999' : '#1976d2';
        prevButton.style.cursor = currentPage === 1 ? 'not-allowed' : 'pointer';
      }
      
      if (nextButton) {
        nextButton.disabled = currentPage === totalPages;
        nextButton.style.background = currentPage === totalPages ? '#f5f5f5' : 'white';
        nextButton.style.color = currentPage === totalPages ? '#999' : '#1976d2';
        nextButton.style.cursor = currentPage === totalPages ? 'not-allowed' : 'pointer';
      }
    }
    
    // Update footer info
    const footerInfo = document.getElementById('footer-info');
    if (footerInfo) {
      const { currentPage, pageSize, totalResults } = window.searchResultsState.pagination;
      const startIndex = (currentPage - 1) * pageSize;
      const showing = Math.min(pageSize, resultsData.results?.length || 0);
      footerInfo.innerHTML = `Showing ${startIndex + 1}-${startIndex + showing} of ${totalResults} results • Page ${currentPage} of ${Math.ceil(totalResults / pageSize)} • Executed ${new Date(task.completed).toLocaleString()}`;
    }
  },

  hideResults: () => {
    window.searchResultsState.isVisible = false;
    window.searchResultsState.task = null;
    
    const backdrop = document.getElementById('search-results-backdrop');
    const dialog = document.getElementById('search-results-dialog');
    
    if (backdrop && dialog) {
      backdrop.style.opacity = '0';
      dialog.style.transform = 'scale(0.9) translateY(20px)';
      
      setTimeout(() => {
        backdrop.style.display = 'none';
      }, 300);
    }
  }
};

// Create overlay element in DOM
if (typeof window !== 'undefined') {
  // Remove existing overlay if any
  const existing = document.getElementById('search-results-overlay');
  if (existing) existing.remove();
  
  // Create main container
  const overlayDiv = document.createElement('div');
  overlayDiv.id = 'search-results-overlay';
  overlayDiv.innerHTML = `
    <!-- Backdrop with Dialog Inside -->
    <div id="search-results-backdrop" style="
      position: fixed !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      bottom: 0 !important;
      background: rgba(0, 0, 0, 0.5) !important;
      z-index: 100000 !important;
      display: none !important;
      align-items: center !important;
      justify-content: center !important;
      padding: 16px !important;
      transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
      backdrop-filter: blur(4px) !important;
    ">
      <!-- Dialog -->
      <div id="search-results-dialog" style="
        transform: scale(0.9) translateY(20px) !important;
        background: white !important;
        border-radius: 12px !important;
        box-shadow: 
          0 11px 15px -7px rgba(0, 0, 0, 0.2),
          0 24px 38px 3px rgba(0, 0, 0, 0.14),
          0 9px 46px 8px rgba(0, 0, 0, 0.12) !important;
        width: 90% !important;
        max-width: 800px !important;
        max-height: 90vh !important;
        overflow: hidden !important;
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1) !important;
        font-family: 'Roboto', 'Helvetica Neue', Arial, sans-serif !important;
      ">
      <!-- Header -->
      <div style="
        padding: 24px 24px 0 24px;
        border-bottom: 1px solid #e0e0e0;
      ">
        <div style="
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 16px;
        ">
          <div style="
            display: flex;
            align-items: center;
            gap: 12px;
          ">
            <div style="
              width: 40px;
              height: 40px;
              background: linear-gradient(135deg, #1976d2, #42a5f5);
              border-radius: 8px;
              display: flex;
              align-items: center;
              justify-content: center;
            ">
              <svg width="20" height="20" fill="white" viewBox="0 0 24 24">
                <path d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
              </svg>
            </div>
            <div>
              <h2 style="
                margin: 0;
                font-size: 20px;
                font-weight: 500;
                color: rgba(0, 0, 0, 0.87);
                letter-spacing: 0.15px;
              " id="dialog-title">Search Results</h2>
              <p style="
                margin: 0;
                font-size: 14px;
                color: rgba(0, 0, 0, 0.6);
                margin-top: 2px;
              " id="dialog-subtitle">Loading...</p>
            </div>
          </div>
          <button id="close-dialog" style="
            width: 40px;
            height: 40px;
            border: none;
            background: none;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            color: rgba(0, 0, 0, 0.5);
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='rgba(0, 0, 0, 0.04)'" 
             onmouseout="this.style.backgroundColor='transparent'">
            <svg width="24" height="24" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>
        
        <!-- Stats Cards -->
        <div id="stats-container" style="
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        ">
        </div>
      </div>

      <!-- Content -->
      <div style="
        padding: 24px;
        overflow-y: auto;
        max-height: calc(90vh - 200px);
      ">
        <div id="results-container">
        </div>
        
        <!-- Pagination Controls -->
        <div id="pagination-container" style="
          display: flex;
          justify-content: center;
          align-items: center;
          gap: 8px;
          margin-top: 16px;
          padding: 16px 0;
        ">
          <!-- Pagination will be populated by JavaScript -->
        </div>
        
      </div>

      <!-- Footer -->
      <div style="
        padding: 16px 24px;
        border-top: 1px solid #e0e0e0;
        background: rgba(0, 0, 0, 0.02);
        display: flex;
        justify-content: space-between;
        align-items: center;
      ">
        <div style="
          font-size: 14px;
          color: rgba(0, 0, 0, 0.6);
        " id="footer-info">
        </div>
        <div style="gap: 8px; display: flex;">
          <button id="copy-results" style="
            background: rgba(25, 118, 210, 0.08);
            color: #1976d2;
            border: 1px solid rgba(25, 118, 210, 0.12);
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: all 0.2s;
          " onmouseover="this.style.backgroundColor='rgba(25, 118, 210, 0.12)'" 
             onmouseout="this.style.backgroundColor='rgba(25, 118, 210, 0.08)'">
            Copy Results
          </button>
          <button id="close-dialog-footer" style="
            background: #1976d2;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
          " onmouseover="this.style.backgroundColor='#1565c0'" 
             onmouseout="this.style.backgroundColor='#1976d2'">
            Close
          </button>
          <button id="debug-test" style="
            background: #ff9800;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            transition: background-color 0.2s;
            margin-left: 8px;
          " onmouseover="this.style.backgroundColor='#f57c00'" 
             onmouseout="this.style.backgroundColor='#ff9800'"">
            Debug Test
          </button>
        </div>
      </div>
      </div>
    </div>
  `;
  
  document.body.appendChild(overlayDiv);
  
  // Add event listeners
  const closeButtons = [
    document.getElementById('close-dialog'),
    document.getElementById('close-dialog-footer')
    // Removed 'search-results-backdrop' to prevent closing on outside click
  ];
  
  closeButtons.forEach(button => {
    if (button) {
      button.addEventListener('click', () => {
        window.searchResultsActions.hideResults();
      });
    }
  });

  // Prevent dialog content clicks from closing the dialog
  const dialogElement = document.getElementById('search-results-dialog');
  if (dialogElement) {
    dialogElement.addEventListener('click', (event) => {
      event.stopPropagation(); // Prevent event bubbling to backdrop
    });
  }

  // Add ESC key support for closing dialog
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && window.searchResultsState.isVisible) {
      window.searchResultsActions.hideResults();
    }
  });
  
  // Debug button
  const debugButton = document.getElementById('debug-test');
  if (debugButton) {
    debugButton.addEventListener('click', () => {
      // Debug info available
      
      // Test manual data injection
      const testTask = {
        id: 'debug-test-task',
        params: { query: 'test query' },
        result: {
          results: [
            {
              content: 'This is a test result content',
              path: '/test/file.txt',
              line_number: 1,
              score: 100
            }
          ],
          filesSearched: 1,
          total: 1
        },
        started: new Date().toISOString(),
        completed: new Date().toISOString(),
        status: 'completed'
      };
      
      console.log('Testing with mock data:', testTask);
      
      // Manually trigger data update
      if (window.searchResultsActions.logTask) {
        window.searchResultsActions.logTask();
      }
      
      // Force manual data injection to DOM
      const resultsContainer = document.getElementById('results-container');
      if (resultsContainer) {
        resultsContainer.innerHTML = '<div style="padding: 20px; background: #ffeeee; border-radius: 8px; margin: 10px 0;"><h4>DEBUG: Test Data Loaded</h4><p>If you see this, the DOM is working. Check console for data.</p></div>';
      }
    });
  }
  
  const copyButton = document.getElementById('copy-results');
  if (copyButton) {
    copyButton.addEventListener('click', () => {
      const container = document.getElementById('results-container');
      if (container) {
        const text = container.innerText;
        navigator.clipboard.writeText(text).then(() => {
          copyButton.textContent = 'Copied!';
          setTimeout(() => {
            copyButton.textContent = 'Copy Results';
          }, 2000);
        });
      }
    });
  }
  
  // Don't close on dialog click
  const dialog = document.getElementById('search-results-dialog');
  if (dialog) {
    dialog.addEventListener('click', (e) => {
      e.stopPropagation();
    });
  }
}

const SearchResultsOverlay = ({ isVisible, task, onClose }) => {
  window.searchResultsActions.logTask = () => {
    console.log('SearchResultsOverlay Debug:', { 
      isVisible, 
      task: task?.id, 
      hasResults: task?.result?.results?.length || 0,
      showResultsPanel: window.searchResultsState.isVisible 
    });
  };
  
  React.useEffect(() => {
    console.log('SearchResultsOverlay useEffect:', { isVisible, task: task?.id, hasResults: task?.result?.results?.length });
    if (task && isVisible) {
      // Update title and subtitle
      const title = document.getElementById('dialog-title');
      const subtitle = document.getElementById('dialog-subtitle');
      if (title && subtitle) {
        title.textContent = `Search Results`;
        subtitle.textContent = `Query: "${task.params?.query || 'N/A'}"`;
      }
      
      // Update stats cards
      const statsContainer = document.getElementById('stats-container');
      if (statsContainer) {
        const duration = task.started && task.completed ? 
          Math.round((new Date(task.completed) - new Date(task.started)) / 1000) : 0;
          
        statsContainer.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #43a047, #66bb6a);
            color: white;
            padding: 16px;
            border-radius: 8px;
            text-align: center;
          ">
            <div style="font-size: 24px; font-weight: 500;">${task.result?.results?.length || 0}</div>
            <div style="font-size: 14px; opacity: 0.9;">Matches Found</div>
          </div>
          <div style="
            background: linear-gradient(135deg, #1976d2, #42a5f5);
            color: white;
            padding: 16px;
            border-radius: 8px;
            text-align: center;
          ">
            <div style="font-size: 24px; font-weight: 500;">${task.result?.filesSearched || 0}</div>
            <div style="font-size: 14px; opacity: 0.9;">Files Searched</div>
          </div>
          <div style="
            background: linear-gradient(135deg, #7b1fa2, #ab47bc);
            color: white;
            padding: 16px;
            border-radius: 8px;
            text-align: center;
          ">
            <div style="font-size: 24px; font-weight: 500;">${duration}s</div>
            <div style="font-size: 14px; opacity: 0.9;">Duration</div>
          </div>
        `;
      }
      
      // Update results
      const resultsContainer = document.getElementById('results-container');
      const footerInfo = document.getElementById('footer-info');
      if (resultsContainer && task.result?.results) {
        const results = task.result.results.slice(0, 10);
        
        resultsContainer.innerHTML = results.map((result, index) => `
          <div style="
            border: 1px solid #e0e0e0;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 16px;
            background: white;
            transition: box-shadow 0.2s;
          " onmouseover="this.style.boxShadow='0 2px 8px rgba(0,0,0,0.1)'" 
             onmouseout="this.style.boxShadow='none'">
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              margin-bottom: 12px;
            ">
              <div style="
                display: flex;
                align-items: center;
                gap: 8px;
              ">
                <div style="
                  width: 24px;
                  height: 24px;
                  background: #1976d2;
                  color: white;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 12px;
                  font-weight: 500;
                ">${index + 1}</div>
                <h3 style="
                  margin: 0;
                  font-size: 16px;
                  font-weight: 500;
                  color: rgba(0, 0, 0, 0.87);
                ">Result ${index + 1}</h3>
              </div>
              <div style="
                background: rgba(25, 118, 210, 0.1);
                color: #1976d2;
                padding: 4px 8px;
                border-radius: 4px;
                font-size: 12px;
                font-weight: 500;
              ">Score: ${Math.round(result.score)}</div>
            </div>
            
            <div style="
              background: rgba(0, 0, 0, 0.04);
              padding: 12px;
              border-radius: 6px;
              margin-bottom: 12px;
              border-left: 4px solid #1976d2;
            ">
              <p style="
                margin: 0;
                font-size: 14px;
                line-height: 1.5;
                color: rgba(0, 0, 0, 0.87);
              ">${result.content}</p>
            </div>
            
            <div style="
              display: flex;
              justify-content: space-between;
              align-items: center;
              font-size: 12px;
              color: rgba(0, 0, 0, 0.6);
            ">
              <div style="gap: 16px; display: flex;">
                <span style="font-weight: 500;">📄 ${result.path.split('/').pop()}</span>
                <span style="font-weight: 500;">📍 Line ${result.line_number + 1}</span>
              </div>
              ${result.indexed_at ? `<span style="font-style: italic;">Added ${new Date(result.indexed_at).toLocaleDateString()}</span>` : ''}
            </div>
          </div>
        `).join('');
        
        // Footer info
        if (footerInfo) {
          const total = task.result.results.length;
          const showing = Math.min(10, total);
          footerInfo.innerHTML = `Showing ${showing} of ${total} results • Executed on ${new Date(task.completed).toLocaleString()}`;
        }
      }
    }
  }, [task, isVisible]);
  
  return null; // This component manages DOM directly
};

export default SearchResultsOverlay;