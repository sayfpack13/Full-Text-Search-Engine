import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Search, LogOut, Settings } from 'lucide-react';
import axios from 'axios';
import { handleApiError } from '../utils/errorHandler';
import TaskManager from './TaskManager';

const SearchInterface = () => {
  const [stats, setStats] = useState(null);
  const { user, logout } = useAuth();

  useEffect(() => {
    //fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/search/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      handleApiError(error, 'Failed to fetch statistics');
    }
  };




  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <Search className="h-8 w-8 text-primary-600" />
              <h1 className="ml-2 text-xl font-semibold text-gray-900">
                Search Engine
              </h1>
            </div>

            <div className="flex items-center space-x-4">
              {user?.role === 'admin' && (
                <a
                  href="/admin"
                  className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
                >
                  <Settings className="h-4 w-4 mr-1" />
                  Admin
                </a>
              )}

              <button
                onClick={logout}
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

       

        {/* Background Task Management */}
        <div className="mb-8">
          <TaskManager compact={true} onTaskUpdate={fetchStats} />
        </div>


        {/* Welcome Instruction */}
        <div className="text-center py-12">
          <Search className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Background Search Engine</h3>
          <p className="mt-1 text-sm text-gray-500">
            Use the task management system above to start background search operations and view results when completed.
          </p>
        </div>
      </div>
    </div>
  );
};

export default SearchInterface;
