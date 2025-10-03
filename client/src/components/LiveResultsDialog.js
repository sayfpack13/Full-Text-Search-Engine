import React from 'react';
import { X, FileText, Eye, TrendingUp, Clock } from 'lucide-react';

const LiveResultsDialog = ({ isVisible, onClose, task, liveResults, liveProgress, liveOperation }) => {
  if (!isVisible || !task) return null;

  // Combine live results with cached results for a complete view
  const cachedResults = task.result?.results || [];
  const liveResultsArray = liveResults || [];
  
  // Merge results, prioritizing live results if available
  const allResults = [...liveResultsArray];
  
  // Add cached results that aren't already in live results (for non-live tasks)
  if (liveResultsArray.length === 0 && cachedResults.length > 0) {
    allResults.push(...cachedResults);
  } else if (liveResultsArray.length > 0) {
    // Add cached results that aren't in the live array (for hybrid view)
    const liveResultIds = new Set(liveResultsArray.map(r => r.id));
    const uniqueCached = cachedResults.filter(r => !liveResultIds.has(r.id));
    allResults.push(...uniqueCached);
  }

  const isLiveTask = liveResults.length > 0;
  const hasResults = allResults.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-semibold text-gray-900 flex items-center">
              Search Results for "{task.params?.query || 'Unknown'}"
              {isLiveTask && (
                <span className="ml-2 text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                  🔴 LIVE
                </span>
              )}
              {!isLiveTask && task.status === 'running' && (
                <span className="ml-2 text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded-full">
                  PREVIEW
                </span>
              )}
            </h2>
            <p className="text-sm text-gray-500 mt-1">
              Task Status: {task.status} 
              {isLiveTask && (
                <span className="ml-2 text-green-600">• Streaming Results Live</span>
              )}
              {!isLiveTask && task.status === 'running' && cachedResults.length > 0 && (
                <span className="ml-2 text-orange-600">• Showing Cached Results</span>
              )}
              {task.status === 'failed' && task.result?.saved && (
                <span className="ml-2 text-yellow-600">• Task Cancelled - Results Saved</span>
              )}
              {task.status === 'failed' && !task.result?.saved && (
                <span className="ml-2 text-gray-500">• Task Cancelled - No Results</span>
              )}
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Task Stats */}
        <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="flex items-center space-x-3">
              <FileText className="h-5 w-5 text-blue-500" />
              <div>
                <div className="font-semibold text-gray-900">
                  {task.result?.filesSearched || 'N/A'}
                </div>
                <div className="text-xs text-gray-600">Files Searched</div>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <TrendingUp className="h-5 w-5 text-green-500" />
              <div>
                <div className="font-semibold text-gray-900">
                  {isLiveTask ? `${liveResultsArray.length} live` : `${allResults.length} cached`}
                </div>
                <div className="text-xs text-gray-600">
                  {isLiveTask ? 'Live Results' : 'Stored Results'}
                  {task.status === 'running' && !isLiveTask && ' (Updated Soon)'}
                </div>
              </div>
            </div>
            {liveProgress > 0 && (
              <div className="flex items-center space-x-3">
                <Clock className="h-5 w-5 text-purple-500" />
                <div>
                  <div className="font-semibold text-gray-900">
                    {liveProgress}%
                  </div>
                  <div className="text-xs text-gray-600">Progress</div>
                </div>
              </div>
            )}
            <div className="flex items-center space-x-3">
              <Eye className="h-5 w-5 text-orange-500" />
              <div>
                <div className="font-semibold text-gray-900">
                  {task.status === 'running' ? 'Running' : 'Completed'}
                </div>
                <div className="text-xs text-gray-600">Status</div>
              </div>
            </div>
          </div>
          
          {/* Live Progress Bar */}
          {liveProgress > 0 && task.status === 'running' && (
            <div className="mt-4">
              <div className="flex items-center justify-between text-sm text-gray-600 mb-1">
                <span>{liveOperation || 'Processing...'}</span>
                <span>{liveProgress}%</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div 
                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${liveProgress}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* Results List */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {allResults.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <FileText className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No results found yet.</p>
              {task.status === 'running' && (
                <p className="text-sm text-blue-600 mt-2 animate-pulse">
                  Search is running... results will appear here as they're found.
                </p>
              )}
            </div>
          ) : (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h3 className="text-lg font-medium text-gray-900">
                  {isLiveTask ? '🔴 Live Results' : '📊 Current Results'}
                </h3>
                <div className="text-sm text-gray-600 flex items-center space-x-4">
                  <span>
                    {isLiveTask 
                      ? `📡 ${liveResultsArray.length} live results`
                      : `💾 ${allResults.length} cached results`
                    }
                  </span>
                  {task.status === 'running' && (
                    <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                      {isLiveTask ? 'Live Updates' : 'Updating Soon'}
                    </span>
                  )}
                </div>
              </div>
              
              <div className="space-y-4">
                {allResults.map((result, index) => (
                  <div 
                    key={result.id || index} 
                    className={`border rounded-lg p-4 shadow-sm ${
                      isLiveTask 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200 bg-white'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-sm font-medium text-gray-900 flex items-center">
                        <FileText className="h-4 w-4 mr-2 text-blue-500" />
                        {result.title || `Result ${index + 1}`}
                        {isLiveTask && (
                          <span className="ml-2 text-xs bg-green-200 text-green-800 px-1 rounded">
                            🔴 LIVE
                          </span>
                        )}
                        {!isLiveTask && task.status === 'running' && (
                          <span className="ml-2 text-xs bg-orange-200 text-orange-800 px-1 rounded">
                            📋 CACHED
                          </span>
                        )}
                      </h4>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                        Score: {Math.round(result.score || 0)}
                      </span>
                    </div>
                    
                    <div className="text-sm text-gray-700 mb-3 leading-relaxed">
                      {result.content || 'No content available'}
                    </div>
                    
                    <div className="text-xs text-gray-500 flex items-center justify-between">
                      <span className="flex items-center">
                        <FileText className="h-3 w-3 mr-1" />
                        {result.path || 'Unknown path'}
                      </span>
                      <span>Line {result.line_number + 1 || 'Unknown'}</span>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 text-center">
          <p className="text-sm text-gray-600">
            {task.status === 'running' && isLiveTask
              ? '🔴 Live results are being added in real-time. This dialog stays open automatically.'
              : task.status === 'running' && !isLiveTask
              ? '📋 Showing cached results. Live updates will be available when the task is live-tracked.'
              : task.status === 'failed' && task.result?.saved
              ? '⚠️ Task was cancelled but results were saved before stopping.'
              : task.status === 'failed' && !task.result?.saved  
              ? '❌ Task was cancelled and no results were saved.'
              : '✅ Results are complete and saved to the task history.'
            }
          </p>
          <button
            onClick={onClose}
            className="mt-3 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveResultsDialog;
