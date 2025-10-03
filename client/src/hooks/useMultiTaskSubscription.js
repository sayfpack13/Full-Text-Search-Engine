import { useState, useEffect, useCallback } from 'react';
import io from 'socket.io-client';
import { toast } from 'react-hot-toast';

// Hook for subscribing to multiple tasks simultaneously with real-time updates
export const useMultiTaskSubscription = (socket, runningTaskIds = []) => {
  const [taskUpdates, setTaskUpdates] = useState({}); // taskId -> { progress, operation, resultsCount, error }
  const [liveResults, setLiveResults] = useState({}); // taskId -> results array
  const [connected, setConnected] = useState(false);
  const [subscribedTasks, setSubscribedTasks] = useState(new Set()); // Track currently subscribed tasks

  // Incremental subscription management - only subscribe/unsubscribe when tasks change
  useEffect(() => {
    if (!socket) {
      console.log('❌ Multi-task: No socket available');
      return;
    }
    if (!socket.connected) {
      console.log('❌ Multi-task: Socket not connected');
      return;
    }
    if (runningTaskIds.length === 0) {
      console.log('📝 Multi-task: No running tasks to subscribe to');
      return;
    }

    const currentSubscriptions = new Set(runningTaskIds);
    const newTasks = runningTaskIds.filter(taskId => !subscribedTasks.has(taskId));
    const tasksToUnsubscribe = Array.from(subscribedTasks).filter(taskId => !currentSubscriptions.has(taskId));

    // Subscribe to new tasks
    if (newTasks.length > 0) {
      console.log('🔄 Multi-task: Subscribing to new tasks:', newTasks);
      newTasks.forEach(taskId => {
        socket.emit('subscribe_to_task', taskId);
        console.log(`✅ Subscribed to task: ${taskId}`);
      });
    }

    // Unsubscribe from tasks no longer needed
    if (tasksToUnsubscribe.length > 0) {
      // Unsubscribing from completed tasks
      tasksToUnsubscribe.forEach(taskId => {
        socket.emit('unsubscribe_from_task', taskId);
      });
    }

    // Update subscribed tasks set
    setSubscribedTasks(currentSubscriptions);

  }, [socket, runningTaskIds.join(',')]); // Only depend on actual task IDs, not array reference

  // Set up event listeners once
  useEffect(() => {
    if (!socket) return;

    // Listen for task progress updates for any subscribed task
    const handleProgressUpdate = (data) => {
      const taskId = data.taskId;
      if (subscribedTasks.has(taskId)) {
        setTaskUpdates(prev => ({
          ...prev,
          [taskId]: {
            progress: data.progress || 0,
            operation: data.operation || '',
            resultsCount: data.resultsSoFar || data.totalFound || 0,
            error: null
          }
        }));
        // Progress update received
      }
    };

    // Listen for task results updates for any subscribed task
    const handleResultsUpdate = (data) => {
      const taskId = data.taskId;
      if (subscribedTasks.has(taskId)) {
        setLiveResults(prev => ({
          ...prev,
          [taskId]: [
            ...(prev[taskId] || []),
            ...(data.results || [])
          ]
        }));
        
        // Update task data with new results count
        setTaskUpdates(prev => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            resultsCount: data.totalFound || data.totalResults || ((prev[taskId]?.resultsCount || 0) + (data.results?.length || 0))
          }
        }));
        // Results update received
      }
    };

    // Listen for task completion for any subscribed task
    const handleTaskCompleted = (data) => {
      const taskId = data.taskId;
      if (subscribedTasks.has(taskId)) {
        setTaskUpdates(prev => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            progress: 100,
            operation: 'Task completed',
            completed: true
          }
        }));
        // Task completed
      }
    };

    // Listen for task errors for any subscribed task
    const handleTaskError = (data) => {
      const taskId = data.taskId;
      if (subscribedTasks.has(taskId)) {
        setTaskUpdates(prev => ({
          ...prev,
          [taskId]: {
            ...prev[taskId],
            error: data.error || data.message || 'An unknown error occurred',
            failed: true
          }
        }));
        // Task error
      }
    };

    // Handle connection status
    const handleConnect = () => setConnected(true);
    const handleDisconnect = () => setConnected(false);

    // Set up event listeners
    socket.on('task_progress_update', handleProgressUpdate);
    socket.on('task_results_update', handleResultsUpdate);
    socket.on('task_completed', handleTaskCompleted);
    socket.on('task_error', handleTaskError);
    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('connect_error', () => setConnected(false));

    // Return cleanup function
    return () => {
      socket.off('task_progress_update', handleProgressUpdate);
      socket.off('task_results_update', handleResultsUpdate);
      socket.off('task_completed', handleTaskCompleted);
      socket.off('task_error', handleTaskError);
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('connect_error');
      
      // Unsubscribe from all tasks before cleanup
      Array.from(subscribedTasks).forEach(taskId => {
        socket.emit('unsubscribe_from_task', taskId);
      });
    };
  }, [socket, subscribedTasks]);

  // Clean up completed/failed tasks from tracking
  useEffect(() => {
    setTaskUpdates(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(taskId => {
        if (!runningTaskIds.includes(taskId)) {
          delete updated[taskId];
        }
      });
      return updated;
    });

    setLiveResults(prev => {
      const updated = { ...prev };
      Object.keys(updated).forEach(taskId => {
        if (!runningTaskIds.includes(taskId)) {
          delete updated[taskId];
        }
      });
      return updated;
    });
  }, [runningTaskIds]);

  return {
    taskUpdates,
    liveResults,
    connected,
    // Helper functions
    getTaskUpdate: (taskId) => taskUpdates[taskId] || {},
    getTaskResults: (taskId) => liveResults[taskId] || [],
    isTaskTracked: (taskId) => runningTaskIds.includes(taskId) && taskUpdates[taskId],
  };
};

// Helper hook for individual task access
export const useTaskData = (taskUpdates, taskId) => {
  const update = taskUpdates[taskId] || {};
  
  return {
    progress: update.progress || 0,
    operation: update.operation || '',
    resultsCount: update.resultsCount || 0,
    error: update.error,
    isCompleted: update.completed || false,
    isFailed: update.failed || false,
  };
};
