import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { 
  Play, 
  Square, 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2,
  RefreshCw,
  Search,
  Settings,
  Eye,
  FileText,
  ChevronDown,
  ChevronUp,
  X,
  TrendingUp,
  Trash2
} from 'lucide-react';
import SearchResultsOverlay from './SearchResultsOverlay';


// Compact Task Card Component
const CompactTaskCard = ({ task, onCancel, onDelete, resultPages, getTaskResultsPage, formatTimestamp, setTaskResultPage, onOpenDialog }) => {
  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-3 w-3 text-yellow-500" />;
      case 'running':
        return <Loader2 className="h-3 w-3 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-3 w-3 text-green-500" />;
      case 'failed':
        return <XCircle className="h-3 w-3 text-red-500" />;
      default:
        return <Clock className="h-3 w-3 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center space-x-2">
          {getStatusIcon(task.status)}
          <span className="text-sm font-medium text-gray-900">
            {task.type === 'search' ? `"${task.params?.query?.substring(0, 30)}${task.params?.query?.length > 30 ? '...' : ''}"` : task.params?.task}
          </span>
          <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
            {task.status}
          </span>
        </div>
        <div className="flex items-center space-x-1">
          {onCancel && task.status !== 'completed' && task.status !== 'failed' && (
            <button
              onClick={() => onCancel(task.id)}
              className="text-orange-600 hover:text-orange-700 text-xs"
              title="Cancel task"
            >
              <Square className="h-3 w-3" />
            </button>
          )}
          {onDelete && (
            <button
              onClick={() => onDelete(task.id)}
              className="text-red-600 hover:text-red-700 text-xs"
              title="Delete task"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
          {task.status === 'completed' && task.type === 'search' && task.result && (
            <button 
              onClick={() => onOpenDialog(task)}
              className="px-3 py-1 text-xs bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors flex items-center space-x-1 font-medium shadow-sm"
            >
              <Eye className="h-3 w-3" />
              <span>View {task.result.total || task.result.resultsFound || task.result.results?.length || 0} Results</span>
            </button>
          )}
        </div>
      </div>
      
      {/* Completion Insights for completed search tasks */}
      {task.status === 'completed' && task.type === 'search' && task.result && (
        <div className="mt-3 pt-3 border-t border-gray-300">
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
            <div className="flex items-center space-x-2">
              <FileText className="h-3 w-3 text-blue-500" />
              <span className="text-gray-600">
                {task.result.filesSearched || 0} files searched
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <TrendingUp className="h-3 w-3 text-green-500" />
              <span className="text-gray-600">
                {task.result.total || task.result.resultsFound || task.result.results?.length || 0} matches found
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Clock className="h-3 w-3 text-purple-500" />
              <span className="text-gray-600">
                {task.started && task.completed ? 
                  `${Math.round((new Date(task.completed) - new Date(task.started)) / 1000)}s` : 
                  'duration unknown'
                }
              </span>
            </div>
          </div>
        </div>
      )}
      
      {task.status === 'running' && task.progress > 0 && (
        <div className="mb-2">
          <div className="w-full bg-gray-200 rounded-full h-1">
            <div 
              className="bg-blue-600 h-1 rounded-full transition-all duration-500"
              style={{ width: `${task.progress}%` }}
            />
          </div>
          <p className="text-xs text-gray-500 mt-1">{task.operation}</p>
        </div>
      )}

    </div>
  );
};

// Pagination Component
const Pagination = ({ pageInfo, onPageChange }) => {
  const { currentPage, totalPages, totalResults } = pageInfo;
  
  if (totalPages <= 1) return null;
  
  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages) {
      onPageChange(newPage);
    }
  };
  
  return (
    <div className="flex items-center justify-between mt-4 px-4 py-2 bg-gray-50 rounded-lg">
      <div className="text-sm text-gray-600">
        Showing page {currentPage} of {totalPages} ({totalResults} total results)
      </div>
      
      <div className="flex items-center space-x-2">
        <button
          onClick={() => handlePageChange(currentPage - 1)}
          disabled={currentPage === 1}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Previous
        </button>
        
        {/* Page Numbers */}
        <div className="flex items-center space-x-1">
          {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
            let pageNum;
            if (totalPages <= 5) {
              pageNum = i + 1;
            } else if (currentPage <= 3) {
              pageNum = i + 1;
            } else if (currentPage >= totalPages - 2) {
              pageNum = totalPages - 4 + i;
            } else {
              pageNum = currentPage - 2 + i;
            }
            
            return (
              <button
                key={pageNum}
                onClick={() => handlePageChange(pageNum)}
                className={`px-3 py-1 text-sm border rounded-md transition-colors ${
                  currentPage === pageNum
                    ? 'bg-primary-600 text-white border-primary-600'
                    : 'border-gray-300 hover:bg-gray-100'
                }`}
              >
                {pageNum}
              </button>
            );
          })}
        </div>
        
        <button
          onClick={() => handlePageChange(currentPage + 1)}
          disabled={currentPage === totalPages}
          className="px-3 py-1 text-sm border border-gray-300 rounded-md hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Next
        </button>
      </div>
    </div>
  );
};

const TaskManager = ({ onTaskUpdate, compact = false }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [activeSearchQuery, setActiveSearchQuery] = useState('');
  const [searchLimit, setSearchLimit] = useState(50);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [apiAvailable, setApiAvailable] = useState(true);
  const [expandedResults, setExpandedResults] = useState({});
  const [currentView, setCurrentView] = useState('active'); // 'active' or 'history'
  const [resultPages, setResultPages] = useState({}); // Track pagination for each task
  const [selectedTaskForResults, setSelectedTaskForResults] = useState(null);
  const [showResultsPanel, setShowResultsPanel] = useState(false);
  

  useEffect(() => {
    fetchTasks();
  }, []);

  useEffect(() => {
    let interval;
    if (autoRefresh) {
      interval = setInterval(fetchTasks, 2000); // Refresh every 2 seconds
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [autoRefresh]);

  const fetchTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        console.error('No auth token found');
        return;
      }

      const response = await axios.get('/api/tasks?limit=20', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (response.data.success) {
        setTasks(response.data.data.tasks);
      } else {
        console.error('API returned error:', response.data.error);
      }
    } catch (error) {
      console.error('Failed to fetch tasks:', error);
      if (error.response?.status === 404) {
        console.warn('Task management endpoints not available. Make sure server is running with task routes.');
      }
    }
  };

  const handleApiError = (error, defaultMessage) => {
    const message = error.response?.data?.error?.message || defaultMessage;
    toast.error(message);
  };

  const startSearchTask = async () => {
    if (!activeSearchQuery.trim()) {
      toast.error('Please enter a search query');
      return;
    }

    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.post('/api/tasks/search', {
        query: activeSearchQuery,
        limit: searchLimit,
        offset: 0,
        async: true
      }, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Search task started!');
      setActiveSearchQuery('');
      
      // Refresh tasks after starting
      setTimeout(fetchTasks, 500);
      
      // Notify parent component if needed
      if (onTaskUpdate) {
        onTaskUpdate(response.data.data);
      }

    } catch (error) {
      handleApiError(error, 'Failed to start search task');
    } finally {
      setLoading(false);
    }
  };

  const cancelTask = async (taskId) => {
    try {
      const token = localStorage.getItem('token');
      await axios.delete(`/api/tasks/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('Task cancelled successfully');
      fetchTasks();
    } catch (error) {
      handleApiError(error, 'Failed to cancel task');
    }
  };

  const deleteTask = async (taskId) => {
    // eslint-disable-next-line no-restricted-globals
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete(`/api/tasks/delete/${taskId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success('Task deleted successfully');
        fetchTasks();
        if (onTaskUpdate) onTaskUpdate(); // Refresh stats if needed
      } else {
        toast.error(response.data.error || 'Failed to delete task');
      }
    } catch (error) {
      handleApiError(error, 'Failed to delete task');
    }
  };

  const deleteAllTasks = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete('/api/tasks/', {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        toast.success(`Deleted all ${response.data.data.deletedCount} tasks`);
        setTasks([]);
        if (onTaskUpdate) onTaskUpdate(); // Refresh stats if needed
      } else {
        toast.error(response.data.error || 'Failed to delete all tasks');
      }
    } catch (error) {
      handleApiError(error, 'Failed to delete all tasks');
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'pending':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      case 'running':
        return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      default:
        return <Clock className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'running':
        return 'bg-blue-100 text-blue-800';
      case 'completed':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  const formatDuration = (started, completed) => {
    if (!started) return '-';
    const endTime = completed ? new Date(completed) : new Date();
    const duration = Math.round((endTime - new Date(started)) / 1000);
    return `${duration}s`;
  };

  const formatTimestamp = (timestamp) => {
    return new Date(timestamp).toLocaleString();
  };

  // Pagination helpers
  const RESULTS_PER_PAGE = 5;
  
  const getTaskResultsPage = (taskId, page = 1) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task?.result?.results) return { results: [], totalPages: 0, currentPage: 1 };
    
    const totalResults = task.result.results.length;
    const totalPages = Math.ceil(totalResults / RESULTS_PER_PAGE);
    const startIndex = (page - 1) * RESULTS_PER_PAGE;
    const endIndex = Math.min(startIndex + RESULTS_PER_PAGE, totalResults);
    
    return {
      results: task.result.results.slice(startIndex, endIndex),
      totalPages,
      currentPage: page,
      totalResults
    };
  };

  const setTaskResultPage = (taskId, page) => {
    setResultPages(prev => ({
      ...prev,
      [taskId]: page
    }));
  };

  const activeTasks = tasks.filter(task => task.status === 'pending' || task.status === 'running');
  const completedTasks = tasks.filter(task => task.status === 'completed' || task.status === 'failed');
  
  // Debug: log tasks with results
  console.log('All tasks:', tasks);
    console.log('Completed tasks:', tasks.filter(task => task.status === 'completed' && task.type === 'search'));

  if (compact) {
    return (
      <div className="space-y-4">
        {/* Compact Task Control Panel */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-3">
            <h4 className="text-md font-semibold text-gray-900">Background Tasks</h4>
            <div className="flex items-center space-x-2">
              <button
                onClick={fetchTasks}
                className="flex items-center px-2 py-1 text-xs font-medium text-gray-700 hover:text-primary-600 transition-colors"
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Refresh
              </button>
              <label className="flex items-center text-xs">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="mr-1"
                />
                Auto-refresh
              </label>
            </div>
          </div>

          {/* View Tabs */}
          <div className="flex space-x-4 mb-3">
            <button
              onClick={() => setCurrentView('active')}
              className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                currentView === 'active'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              Active ({activeTasks.length})
            </button>
            <button
              onClick={() => setCurrentView('history')}
              className={`px-3 py-1 text-sm font-medium rounded-lg transition-colors ${
                currentView === 'history'
                  ? 'bg-primary-100 text-primary-700'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              History ({completedTasks.length})
            </button>
            <button
              onClick={deleteAllTasks}
              className="px-3 py-1 text-sm font-medium rounded-lg transition-colors text-red-600 hover:text-red-800 hover:bg-red-50 flex items-center space-x-1"
              title="Delete all tasks immediately (no confirmation)"
            >
              <Trash2 className="h-4 w-4" />
              <span>Delete All</span>
            </button>
          </div>

          {/* Compact Search Input */}
          <div className="flex gap-2 mb-3">
            <input
              type="text"
              value={activeSearchQuery}
              onChange={(e) => setActiveSearchQuery(e.target.value)}
              placeholder="New search task..."
              className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
            <button
              onClick={startSearchTask}
              disabled={loading || !activeSearchQuery.trim()}
              className="flex items-center px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-sm"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <Play className="h-3 w-3" />
              )}
            </button>
          </div>

          {/* Compact Task List */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {currentView === 'active' ? (
              activeTasks.length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500">
                  No active tasks
                </div>
              ) : (
                activeTasks.map(task => (
                  <CompactTaskCard 
                    key={task.id} 
                    task={task} 
                    onCancel={cancelTask}
                    onDelete={deleteTask} 
                    resultPages={resultPages}
                    getTaskResultsPage={getTaskResultsPage}
                    formatTimestamp={formatTimestamp}
                    setTaskResultPage={setTaskResultPage}
                    onOpenDialog={(task) => {
                      console.log('TaskManager onOpenDialog:', { 
                        taskId: task.id, 
                        hasResults: task?.result?.results?.length || 0,
                        taskData: task 
                      });
                      
                      setSelectedTaskForResults(task);
                      setShowResultsPanel(true);
                      
                      // Show results instantly using DOM-based overlay
                      setTimeout(() => {
                        console.log('Calling showResults with task:', task.id);
                        window.searchResultsActions.showResults(task);
                        
                        // Debug check
                        setTimeout(() => {
                          console.log('Dialog state after showResults:', {
                            backdropDisplay: document.getElementById('search-results-backdrop')?.style.display,
                            dialogTransform: document.getElementById('search-results-dialog')?.style.transform,
                            backdropOpacity: document.getElementById('search-results-backdrop')?.style.opacity
                          });
                        }, 100);
                      }, 50);
                    }}
                  />
                ))
              )
            ) : (
              completedTasks.length === 0 ? (
                <div className="text-center py-4 text-sm text-gray-500">
                  No completed tasks
                </div>
              ) : (
                completedTasks.map(task => (
                  <CompactTaskCard 
                    key={task.id} 
                    task={task} 
                    onCancel={null}
                    onDelete={deleteTask} 
                    resultPages={resultPages}
                    getTaskResultsPage={getTaskResultsPage}
                    formatTimestamp={formatTimestamp}
                    setTaskResultPage={setTaskResultPage}
                    onOpenDialog={(task) => {
                      console.log('TaskManager onOpenDialog:', { 
                        taskId: task.id, 
                        hasResults: task?.result?.results?.length || 0,
                        taskData: task 
                      });
                      
                      setSelectedTaskForResults(task);
                      setShowResultsPanel(true);
                      
                      // Show results instantly using DOM-based overlay
                      setTimeout(() => {
                        console.log('Calling showResults with task:', task.id);
                        window.searchResultsActions.showResults(task);
                        
                        // Debug check
                        setTimeout(() => {
                          console.log('Dialog state after showResults:', {
                            backdropDisplay: document.getElementById('search-results-backdrop')?.style.display,
                            dialogTransform: document.getElementById('search-results-dialog')?.style.transform,
                            backdropOpacity: document.getElementById('search-results-backdrop')?.style.opacity
                          });
                        }, 100);
                      }, 50);
                    }}
                  />
                ))
              )
            )}
          </div>
        </div>
      </div>
    );
    }

  return (
    <div className="space-y-6">
      {/* Full Task Control Panel */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Task Management</h3>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchTasks}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </button>
            <label className="flex items-center text-sm">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="mr-2"
              />
              Auto-refresh
            </label>
          </div>
        </div>

        {/* Start New Search Task */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <input
              type="text"
              value={activeSearchQuery}
              onChange={(e) => setActiveSearchQuery(e.target.value)}
              placeholder="Enter search query for task..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
          <div className="flex gap-2">
            <select
              value={searchLimit}
              onChange={(e) => setSearchLimit(parseInt(e.target.value))}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value={50}>50 results</option>
              <option value={100}>100 results</option>
              <option value={200}>200 results</option>
              <option value={500}>500 results</option>
              <option value={1000}>1000 results</option>
              <option value={-1}>All results</option>
            </select>
            <button
              onClick={startSearchTask}
              disabled={loading || !activeSearchQuery.trim()}
              className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Start Search
            </button>
          </div>
        </div>
      </div>

      {/* Active Tasks */}
      {activeTasks.length > 0 && (
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h4 className="text-lg font-medium text-gray-900">Active Tasks ({activeTasks.length})</h4>
          </div>
          <div className="divide-y divide-gray-200">
            {activeTasks.map((task) => (
              <div key={task.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(task.status)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {task.type === 'search' ? 'Search' : 'Maintenance'}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {task.type === 'search' ? `Query: "${task.params?.query}"` : `Task: ${task.params?.task}`}
                      </p>
                      <p className="text-xs text-gray-500">
                        {task.operation}
                        {task.progress > 0 && ` - ${Math.round(task.progress)}%`}
                      </p>
                      {task.status === 'running' && task.total && (
                        <div className="mt-1">
                          <div className="w-full bg-gray-200 rounded-full h-1">
                            <div 
                              className="bg-blue-600 h-1 rounded-full transition-all duration-500"
                              style={{ width: `${task.progress}%` }}
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => cancelTask(task.id)}
                    className="flex items-center px-3 py-1 text-sm text-red-600 hover:text-red-700 transition-colors"
                  >
                    <Square className="h-4 w-4 mr-1" />
                    Cancel
                  </button>
                </div>
                
                {/* Progress Bar */}
                {task.status === 'running' && task.progress > 0 && (
                  <div className="mt-3">
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className="bg-primary-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${task.progress}%` }}
                      />
                    </div>
                  </div>
                )}

                {/* Partial Results for Running Tasks */}
                {task.status === 'running' && task.type === 'search' && task.result && task.result.results && task.result.results.length > 0 && expandedResults[task.id] && (
                  <div className="mt-4 border-t pt-4">
                    <div className="mb-3">
                      <h5 className="text-sm font-medium text-gray-900 flex items-center">
                        <Loader2 className="h-4 w-4 mr-2 text-blue-500 animate-spin" />
                        Partial Results (Search in Progress...)
                      </h5>
                    </div>
                    
                    <div className="space-y-3 max-h-64 overflow-y-auto">
                      {task.result.results.slice(0, 3).map((result, index) => (
                        <div key={index} className="border border-gray-200 rounded-lg p-3 bg-blue-50 shadow-sm">
                          <div className="flex items-start justify-between mb-2">
                            <h6 className="text-sm font-medium text-gray-900 flex items-center">
                              <FileText className="h-4 w-4 mr-2 text-blue-500" />
                              {result.title || `Result ${index + 1}`}
                            </h6>
                            <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                              Score: {Math.round(result.score)}
                            </span>
                          </div>
                          
                          <p className="text-sm text-gray-700 mb-2 leading-relaxed">
                            {result.content.length > 150 ? result.content.substring(0, 150) + '...' : result.content}
                          </p>
                          
                          <div className="text-xs text-gray-500 flex items-center justify-between">
                            <span className="flex items-center">
                              <FileText className="h-3 w-3 mr-1" />
                              {result.path}
                            </span>
                            <span>Line {result.line_number + 1}</span>
                          </div>
                        </div>
                      ))}
                      
                      {task.result.results.length > 3 && (
                        <div className="text-center py-2 text-sm text-blue-600 bg-blue-100 rounded">
                          ... and {task.result.results.length - 3} more results (final results will be shown when complete)
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task History */}
      <div className="bg-white rounded-lg shadow">
        <div className="px-6 py-4 border-b border-gray-200">
          <h4 className="text-lg font-medium text-gray-900">Task History</h4>
        </div>
        <div className="divide-y divide-gray-200">
          {completedTasks.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              <Clock className="h-8 w-8 mx-auto mb-2" />
              <p>No completed tasks yet</p>
              <p className="text-xs mt-1">Search tasks will show results inline when completed</p>
            </div>
          ) : (
            completedTasks.map((task) => (
              <div key={task.id} className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(task.status)}
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-medium text-gray-900">
                          {task.type === 'search' ? 'Search' : 'Maintenance'}
                        </span>
                        <span className={`px-2 py-1 text-xs rounded-full ${getStatusColor(task.status)}`}>
                          {task.status}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">
                        {task.type === 'search' ? `Query: "${task.params?.query}"` : `Task: ${task.params?.task}`}
                      </p>
                      <div className="flex items-center space-x-4 text-xs text-gray-500 mt-1">
                        <span>{formatTimestamp(task.created)}</span>
                        <span>{formatDuration(task.started, task.completed)}</span>
                        {task.result && task.type === 'search' && task.result.results && task.result.results.length > 0 && (
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              setSelectedTaskForResults(task);
                              setShowResultsPanel(true);
                            }}
                            className="px-4 py-2 text-sm bg-blue-100 text-blue-700 rounded-full hover:bg-blue-200 transition-colors flex items-center space-x-2 font-medium shadow-sm border border-blue-200"
                          >
                            <Eye className="h-4 w-4" />
                            <span>View Results with Pagination</span>
                            <span className="px-2 py-1 bg-blue-200 text-blue-800 rounded-full text-xs">
                              {task.result.total || task.result.results.length}
                            </span>
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                
                {/* Enhanced Task Result Summary */}
                {task.result && task.type === 'search' && (
                  <div className="mt-4 p-4 bg-gradient-to-r from-green-50 to-blue-50 rounded-lg border border-green-200">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-sm font-semibold text-gray-800 flex items-center">
                        <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                        Search Completed Successfully
                      </h4>
                      <span className="text-xs text-gray-500">
                        Completed {formatTimestamp(task.completed)}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200">
                        <FileText className="h-5 w-5 text-blue-500" />
                        <div>
                          <div className="font-semibold text-gray-900">{task.result.filesSearched}</div>
                          <div className="text-xs text-gray-600">Files Searched</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200">
                        <TrendingUp className="h-5 w-5 text-green-500" />
                        <div>
                          <div className="font-semibold text-gray-900">{task.result.resultsFound || task.result.results?.length}</div>
                          <div className="text-xs text-gray-600">Matches Found</div>
                        </div>
                      </div>
                      <div className="flex items-center space-x-3 p-3 bg-white rounded-lg border border-gray-200">
                        <Clock className="h-5 w-5 text-purple-500" />
                        <div>
                          <div className="font-semibold text-gray-900">{formatDuration(task.started, task.completed)}</div>
                          <div className="text-xs text-gray-600">Execution Time</div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

              </div>
            ))
          )}
        </div>
      </div>


      
      {/* Search Results Overlay */}
      <SearchResultsOverlay
        isVisible={showResultsPanel}
        onClose={() => {
          setShowResultsPanel(false);
          setSelectedTaskForResults(null);
          window.searchResultsActions.hideResults();
        }}
        task={selectedTaskForResults}
      />

    </div>
  );
};

export default TaskManager;
