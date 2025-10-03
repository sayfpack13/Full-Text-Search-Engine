import React from 'react';
import { X, FileText, Calendar, Clock, Search, ExternalLink } from 'lucide-react';

const SearchResultsSidebar = ({ isOpen, onClose, task }) => {
  console.log('SearchResultsSidebar render:', { isOpen, hasTask: !!task, taskId: task?.id });
  
  if (!isOpen) {
    console.log('Sidebar not showing: isOpen = false');
    return null;
  }
  
  if (!task) {
    console.log('Sidebar not showing: no task provided');
    return null;
  }
  
  console.log('Sidebar rendering for task:', task.id);

  const formatTimestamp = (timestamp) => {
    if (!timestamp) return 'N/A';
    return new Date(timestamp).toLocaleString();
  };

  const formatDuration = (started, completed) => {
    if (!started || !completed) return 'N/A';
    const endTime = new Date(completed);
    const duration = Math.round((endTime - new Date(started)) / 1000);
    return `${duration}s`;
  };

  const copyResults = () => {
    const resultsText = task.result?.results?.map((result, index) => 
      `${index + 1}. ${result.content}\n` +
      `   File: ${result.path}\n` +
      `   Line: ${result.line_number + 1}\n` +
      `   Score: ${Math.round(result.score)}\n`
    ).join('\n');
    
    navigator.clipboard.writeText(resultsText).then(() => {
      alert('Results copied to clipboard!');
    }).catch(() => {
      alert('Failed to copy results');
    });
  };

  return (
    <div className="fixed inset-0 border-4 border-red-500 overflow-hidden">
      {/* Visual Debug Indicator */}
      <div className="fixed top-4 left-4 bg-red-500 text-white p-2 rounded z-50">
        SIDEBAR OPEN: {task.id}
      </div>
      
      {/* Backdrop */}
      <div 
        className="absolute inset-0 bg-black bg-opacity-50"
        onClick={onClose}
      />
      
      {/* Sidebar */}
      <div className="absolute right-0 top-0 h-full w-full sm:w-96 bg-white shadow-xl transform transition-transform duration-300 ease-out overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-gray-50">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Search className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Search Results</h2>
              <p className="text-sm text-gray-500">{task.params?.query}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors p-2 hover:bg-gray-100 rounded-lg"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        {/* Search Info */}
        <div className="p-6 border-b border-gray-200 bg-blue-50">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div className="flex items-center space-x-2">
              <FileText className="h-4 w-4 text-blue-600" />
              <span className="text-gray-700">
                <span className="font-semibold">{task.result?.filesSearched || 0}</span> files
              </span>
            </div>
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-green-600" />
              <span className="text-gray-700">
                <span className="font-semibold">{task.result?.total || task.result?.results?.length || 0}</span> matches
              </span>
            </div>
          </div>
          <div className="mt-3 flex items-center space-x-2 text-sm text-gray-600">
            <Clock className="h-4 w-4" />
            <span>Completed {formatDuration(task.started, task.completed)} ago</span>
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="space-y-4">
            {task.result?.results?.slice(0, 20).map((result, index) => (
              <div key={index} className="border border-gray-200 rounded-lg p-4 bg-white hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <h3 className="text-lg font-medium text-gray-900 flex items-center">
                    <span className="w-6 h-6 bg-blue-100 text-blue-800 text-xs rounded-full flex items-center justify-center mr-3">
                      {index + 1}
                    </span>
                    Result {index + 1}
                  </h3>
                  <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded-full font-medium">
                    Score: {Math.round(result.score)}
                  </span>
                </div>
                
                <div className="bg-gray-50 rounded-lg p-4 mb-3">
                  <p className="text-gray-800 leading-relaxed">{result.content}</p>
                </div>
                
                <div className="text-sm text-gray-600 bg-gray-100 px-3 py-2 rounded">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center">
                      <FileText className="h-4 w-4 mr-2" />
                      {result.path}
                    </span>
                    <span className="text-gray-500">
                      Line {result.line_number + 1}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            
            {task.result?.results?.length > 20 && (
              <div className="text-center py-4 text-gray-500 bg-yellow-50 rounded-lg border border-yellow-200">
                <p className="font-medium">Showing first 20 results</p>
                <p className="text-sm">Total: {task.result.results.length} results</p>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex space-x-3">
            <button
              onClick={copyResults}
              className="flex-1 flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 bg-white rounded-lg hover:bg-gray-50 transition-colors"
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Copy Results
            </button>
            <button
              onClick={onClose}
              className="flex-1 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchResultsSidebar;
