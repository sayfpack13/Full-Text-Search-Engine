import { useEffect, useRef, useState, useCallback } from 'react';
import { io } from 'socket.io-client';

export const useWebSocket = (url = 'http://localhost:5007') => {
  const [socket, setSocket] = useState(null);
  const [connected, setConnected] = useState(false);
  const [connectionError, setConnectionError] = useState(null);
  const reconnectAttempts = useRef(0);
  const maxReconnectAttempts = 5;
  const reconnectTimeoutRef = useRef(null);

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(url, {
      transports: ['websocket', 'polling'],
      upgrade: true,
      rememberUpgrade: true,
      timeout: 20000,
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionAttempts: maxReconnectAttempts,
    });

    // Connection event handlers
    newSocket.on('connect', () => {
        // WebSocket connected
      setConnected(true);
      setConnectionError(null);
      reconnectAttempts.current = 0;
    });

    newSocket.on('disconnect', (reason) => {
      // WebSocket disconnected
      setConnected(false);
      if (reason === 'io server disconnect') {
        // Server initiated disconnect, don't reconnect
        newSocket.disconnect();
      }
    });

    newSocket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
      setConnected(false);
      setConnectionError(error.message);
      reconnectAttempts.current++;
      
      if (reconnectAttempts.current >= maxReconnectAttempts) {
        console.error(`Max reconnection attempts (${maxReconnectAttempts}) reached`);
        newSocket.disconnect();
      }
    });

    newSocket.on('error', (error) => {
      console.error('WebSocket error:', error);
      setConnectionError(error.message);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      newSocket.disconnect();
    };
  }, [url]);

  return { socket, connected, connectionError };
};

// Hook for subscribing to specific tasks with auto-reconnection support
export const useTaskSubscription = (socket, taskId) => {
  const [taskData, setTaskData] = useState(null);
  const [liveResults, setLiveResults] = useState([]);
  const [progress, setProgress] = useState(0);
  const [operation, setOperation] = useState('');
  const [error, setError] = useState(null);
  const [isCompleted, setIsCompleted] = useState(false);

  const subscribeToTask = useCallback(() => {
    if (!socket || !taskId) return;

    // Subscribing to task
    
    // Listen for task updates
    const handleProgressUpdate = (data) => {
      // Task progress update
      setProgress(data.progress || 0);
      setOperation(data.operation || '');
      
      if (data.resultsSoFar !== undefined) {
        // Update task data with current results count
        setTaskData(prev => ({
          ...prev,
          result: {
            ...prev?.result,
            resultsFound: data.resultsSoFar,
            total: data.totalResults || data.resultsSoFar
          }
        }));
      }
    };

    const handleResultsUpdate = (data) => {
      // Task results update
      
      setTaskData(prev => ({
        ...prev,
        result: {
          ...prev?.result,
          results: [...(prev?.result?.results || []), ...data.results],
          total: data.totalResults,
          resultsFound: data.totalFound
        }
      }));

      // Add new results to live results array
      setLiveResults(prev => [...prev, ...data.results]);
    };

    const handleCompletion = (data) => {
      // Task completion
      setIsCompleted(true);
      setProgress(100);
      setOperation('Search completed successfully');
      
      setTaskData(prev => ({
        ...prev,
        status: 'completed',
        completed: new Date().toISOString(),
        result: {
          ...prev?.result,
          ...data.result
        }
      }));
    };

    const handleError = (data) => {
      console.error('Task error:', data);
      setError(data.message || data.error || 'Unknown error');
      setIsCompleted(true);
      
      setTaskData(prev => ({
        ...prev,
        status: 'failed',
        error: data.message || data.error
      }));
    };

    const handleTaskStatus = (data) => {
      console.log('Task status response:', data);
      if (data.task) {
        setTaskData(data.task);
        setProgress(data.task.progress || 0);
        setOperation(data.task.operation || '');
        setIsCompleted(data.task.status === 'completed' || data.task.status === 'failed');
        
        if (data.task.error) {
          setError(data.task.error);
        }
      }
    };

    // Subscribe to the task
    socket.emit('subscribe_to_task', taskId);

    // Set up event listeners
    socket.on('task_progress_update', handleProgressUpdate);
    socket.on('task_results_update', handleResultsUpdate);
    socket.on('task_completion', handleCompletion);
    socket.on('task_error', handleError);
    socket.on('task_status', handleTaskStatus);

    // Request initial task status
    socket.emit('request_task_status', taskId);

    // Cleanup function
    return () => {
      // Unsubscribing from task
      socket.emit('unsubscribe_from_task', taskId);
      socket.off('task_progress_update', handleProgressUpdate);
      socket.off('task_results_update', handleResultsUpdate);
      socket.off('task_completion', handleCompletion);
      socket.off('task_error', handleError);
      socket.off('task_status', handleTaskStatus);
    };
  }, [socket, taskId]);

  const unsubscribeFromTask = useCallback(() => {
    if (!socket || !taskId) return;
    socket.emit('unsubscribe_from_task', taskId);
  }, [socket, taskId]);

  useEffect(() => {
    if (!taskId) return;
    
    const cleanup = subscribeToTask();
    return cleanup;
  }, [subscribeToTask, taskId]);

  // Auto-resubscribe when socket reconnects
  useEffect(() => {
    if (socket && taskId && socket.connected && !liveResults.length && taskData === null) {
      console.log('Auto-resubscribing to task after reconnection:', taskId);
      subscribeToTask();
    }
  }, [socket?.connected, taskId, liveResults.length, taskData, subscribeToTask]);

  return {
    taskData,
        liveResults,
        progress,
        operation,
        error,
        isCompleted,
        subscribeToTask,
        unsubscribeFromTask
  };
};

// Hook for dashboard live updates
export const useDashboardUpdates = (socket) => {
  const [liveTasks, setLiveTasks] = useState(new Map());
  const [taskUpdates, setTaskUpdates] = useState([]);

  useEffect(() => {
    if (!socket) return;

    const handleProgressUpdate = (data) => {
      setLiveTasks(prev => {
        const newMap = new Map(prev);
        const existingTask = newMap.get(data.taskId) || {};
        newMap.set(data.taskId, {
          ...existingTask,
          progress: data.progress,
          operation: data.operation,
          resultsSoFar: data.resultsSoFar,
          currentBatch: data.currentBatch
        });
        return newMap;
      });

      // Add to task updates log
      setTaskUpdates(prev => [
        {
          taskId: data.taskId,
          type: 'progress',
          timestamp: data.timestamp,
          progress: data.progress,
          operation: data.operation
        },
        ...prev.slice(0, 99) // Keep only last 100 updates
      ]);
    };

    const handleResultsUpdate = (data) => {
      setLiveTasks(prev => {
        const newMap = new Map(prev);
        const existingTask = newMap.get(data.taskId) || {};
        const existingResults = existingTask.results || [];
        
        newMap.set(data.taskId, {
          ...existingTask,
          results: [...existingResults, ...data.results],
          totalResults: data.totalResults,
          totalFound: data.totalFound
        });
        return newMap;
      });

      // Add to task updates log
      setTaskUpdates(prev => [
        {
          taskId: data.taskId,
          type: 'results',
          timestamp: data.timestamp,
          resultsCount: data.results.length,
          totalResults: data.totalResults
        },
        ...prev.slice(0, 99)
      ]);
    };

    const handleCompletion = (data) => {
      setLiveTasks(prev => {
        const newMap = new Map(prev);
        const existingTask = newMap.get(data.taskId) || {};
        
        newMap.set(data.taskId, {
          ...existingTask,
          status: 'completed',
          completed: data.timestamp,
          progress: 100,
          results: data.result?.results || existingTask.results || [],
          totalResults: data.result?.total || existingTask.totalResults
        });
        return newMap;
      });
    };

    socket.on('task_progress_update', handleProgressUpdate);
    socket.on('task_results_update', handleResultsUpdate);
    socket.on('task_completion', handleCompletion);

    return () => {
      socket.off('task_progress_update', handleProgressUpdate);
      socket.off('task_results_update', handleResultsUpdate);
      socket.off('task_completion', handleCompletion);
    };
  }, [socket]);

  return { liveTasks, taskUpdates };
};
