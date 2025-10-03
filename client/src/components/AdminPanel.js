import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { 
  Upload, 
  BarChart3, 
  FileText, 
  Clock, 
  TrendingUp,
  LogOut,
  Search,
  CheckCircle,
  AlertCircle,
  Trash2,
  Database,
  RefreshCw
} from 'lucide-react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { handleApiError } from '../utils/errorHandler';

const AdminPanel = () => {
  const [status, setStatus] = useState(null);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [deleteLoading, setDeleteLoading] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    fetchStatus();
    fetchStats();
  }, []);

  const fetchStatus = async () => {
    try {
      const token = localStorage.getItem('token');
      const response = await axios.get('/api/admin/status', {
        headers: { Authorization: `Bearer ${token}` }
      });
      setStatus(response.data.data);
    } catch (error) {
      console.error('Failed to fetch status:', error);
      handleApiError(error, 'Failed to fetch system status');
    }
  };

  const fetchStats = async () => {
    try {
      const response = await axios.get('/api/search/stats');
      setStats(response.data.data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
      handleApiError(error, 'Failed to fetch statistics');
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      // Validate file extension
      const fileName = file.name.toLowerCase();
      if (!fileName.endsWith('.txt')) {
        toast.error('Please select a .txt file');
        e.target.value = '';
        return;
      }
      
      // Validate file size (max 10MB)
      if (file.size > 10 * 1024 * 1024) {
        toast.error('File size must be less than 10MB');
        e.target.value = '';
        return;
      }
      
      setSelectedFile(file);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      toast.error('Please select a file to upload');
      return;
    }

    setUploadLoading(true);
    try {
      const token = localStorage.getItem('token');
      const formData = new FormData();
      formData.append('document', selectedFile);

      const response = await axios.post('/api/admin/upload', formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });

       toast.success('Document uploaded successfully and is now searchable!');
      setSelectedFile(null);
      document.getElementById('file-input').value = '';
      fetchStatus();
      fetchStats();
    } catch (error) {
      handleApiError(error, 'Upload failed. Please try again.');
    } finally {
      setUploadLoading(false);
    }
  };

  const handleDeleteAllFiles = async () => {
    if (!window.confirm('Are you sure you want to delete ALL search files? This action cannot be undone.')) {
      return;
    }

    if (!window.confirm('This will permanently delete all uploaded documents from the search system. Are you absolutely sure?')) {
      return;
    }

    setDeleteLoading(true);
    try {
      const token = localStorage.getItem('token');
      const response = await axios.delete('/api/admin/files', {
        headers: { Authorization: `Bearer ${token}` }
      });

      toast.success('All search files deleted successfully!');
      fetchStatus();
      fetchStats();
    } catch (error) {
      handleApiError(error, 'Failed to delete search files');
    } finally {
      setDeleteLoading(false);
    }
  };

  const refreshData = () => {
    fetchStatus();
    fetchStats();
    toast.success('Data refreshed successfully!');
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
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
                Admin Panel
              </h1>
            </div>
            
            <div className="flex items-center space-x-4">
              <a
                href="/"
                className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
              >
                <Search className="h-4 w-4 mr-1" />
                Search
              </a>
              
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
        {/* System Status */}
        {status && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">System Status</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  {status.index_healthy ? (
                    <CheckCircle className="h-8 w-8 text-green-600" />
                  ) : (
                    <AlertCircle className="h-8 w-8 text-red-600" />
                  )}
                  <div className="ml-4">
                     <p className="text-sm font-medium text-gray-500">Search System Status</p>
                    <p className="text-lg font-semibold text-gray-900">
                        {status.index_healthy ? 'Search Ready' : 'Not Available'}
                    </p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-primary-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Searchable Files</p>
                    <p className="text-lg font-semibold text-gray-900">{status.total_documents}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Statistics */}
        {stats && (
          <div className="mb-8">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Statistics</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <FileText className="h-8 w-8 text-primary-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Searchable Files</p>
                    <p className="text-2xl font-semibold text-gray-900">{stats.total_documents}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <TrendingUp className="h-8 w-8 text-primary-600" />
                  <div className="ml-4">
                     <p className="text-sm font-medium text-gray-500">Total File Size</p>
                    <p className="text-2xl font-semibold text-gray-900">{formatFileSize(stats.index_size_bytes)}</p>
                  </div>
                </div>
              </div>
              
              <div className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <Clock className="h-8 w-8 text-primary-600" />
                  <div className="ml-4">
                    <p className="text-sm font-medium text-gray-500">Last Updated</p>
                    <p className="text-2xl font-semibold text-gray-900">{formatDate(stats.last_updated)}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* File Management */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
             <h2 className="text-lg font-semibold text-gray-900">File Management</h2>
            <button
              onClick={refreshData}
              className="flex items-center px-3 py-2 text-sm font-medium text-gray-700 hover:text-primary-600 transition-colors"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </button>
          </div>
          
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-md font-medium text-gray-900 mb-2">Search Files Control</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Manage search files. Delete all files will permanently remove all uploaded documents and reset the search engine.
                </p>
              </div>
              <div className="space-x-4">
                <button
                  onClick={handleDeleteAllFiles}
                  disabled={deleteLoading}
                  className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {deleteLoading ? (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  ) : (
                    <Trash2 className="h-4 w-4 mr-2" />
                  )}
                  Delete All Files
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Admin Actions */}
        <div className="space-y-6">
          <h2 className="text-lg font-semibold text-gray-900">Document Management</h2>
          
          {/* File Upload */}
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-md font-medium text-gray-900 mb-4">Upload Document</h3>
            <div className="space-y-4">
              <div>
                <label htmlFor="file-input" className="block text-sm font-medium text-gray-700 mb-2">
                   Select a .txt file to add to search
                </label>
                <p className="text-xs text-gray-500 mb-2">Only UTF-8 encoded .txt files are supported (max 10MB)</p>
                <input
                  id="file-input"
                  type="file"
                  accept=".txt"
                  onChange={handleFileSelect}
                  className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
                />
              </div>
              
              {selectedFile && (
                <div className="text-sm text-gray-600">
                  Selected: {selectedFile.name} ({(selectedFile.size / 1024).toFixed(1)} KB)
                </div>
              )}
              
              <button
                onClick={handleUpload}
                disabled={!selectedFile || uploadLoading}
                className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {uploadLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                ) : (
                  <Upload className="h-4 w-4 mr-2" />
                )}
                   Upload File
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
};

export default AdminPanel;
