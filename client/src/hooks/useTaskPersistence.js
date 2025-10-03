import { useState, useEffect, useCallback } from 'react';
import { taskStateManager } from '../utils/taskStateManager';

// Hook to manage task persistence and auto-resubscription
export const useTaskPersistence = (socket, connected, tasks) => {
  const [hasRestoredTasks, setHasRestoredTasks] = useState(false);
  const [resubscribedTasks, setResubscribedTasks] = useState(new Set());

  // Auto-restore running tasks on component mount
  useEffect(() => {
    if (!hasRestoredTasks) {
      const runningTasks = taskStateManager.getRunningTasks();
      const savedLiveTaskId = taskStateManager.getLiveTaskId();
      
      if (runningTasks.length > 0) {
        // Restoring running tasks on page refresh
        // Tasks will be merged with fetched tasks by parent component
        
        // Show notification to user
        if (window.toast) {
          window.toast.success(`Restored ${runningTasks.length} running task(s) after page refresh!`);
        }
      }
      
      setHasRestoredTasks(true);
    }
  }, [hasRestoredTasks]);

  // Auto-resubscribe to running tasks when WebSocket reconnects
  useEffect(() => {
    if (socket && connected && !hasRestoredTasks) {
      const taskIdsToResubscribe = taskStateManager.getTaskIdsToResubscribeTo();
      
      if (taskIdsToResubscribe.length > 0) {
        // Auto-resubscribing to running tasks
        
        taskIdsToResubscribe.forEach(taskId => {
          if (!resubscribedTasks.has(taskId)) {
            socket.emit('subscribe_to_task', taskId);
            setResubscribedTasks(prev => new Set([...prev, taskId]));
            
            // Auto-resubscribed to task
          }
        });
        
        if (window.toast) {
          window.toast.success(`Auto-resubscribed to ${taskIdsToResubscribe.length} running task(s)!`);
        }
      }
    }
  }, [socket, connected, hasRestoredTasks, resubscribedTasks]);

  // Save running tasks whenever tasks change
  useEffect(() => {
    if (tasks && tasks.length > 0 && hasRestoredTasks) {
      taskStateManager.saveRunningTasks(tasks);
    }
  }, [tasks, hasRestoredTasks]);

  // Function to save live task ID
  const saveLiveTaskId = useCallback((taskId) => {
    if (taskId) {
      taskStateManager.saveLiveTaskId(taskId);
    }
  }, []);

  // Function to clear live task ID
  const clearLiveTaskId = useCallback(() => {
    taskStateManager.clearLiveTaskId();
  }, []);

  // Function to manually resubscribe to all running tasks
  const resubscribeToAllRunningTasks = useCallback(() => {
    if (socket && connected) {
      const taskIdsToResubscribe = taskStateManager.getTaskIdsToResubscribeTo();
      
      taskIdsToResubscribe.forEach(taskId => {
        socket.emit('subscribe_to_task', taskId);
        setResubscribedTasks(prev => new Set([...prev, taskId]));
      });
      
      return taskIdsToResubscribe;
    }
    return [];
  }, [socket, connected]);

  // Function to check if task should be auto-tracked
  const shouldAutoTrackTask = useCallback((task) => {
    if (!task || (task.status !== 'running' && task.status !== 'pending')) {
      return false;
    }
    
    // If it's a search task that's currently running, auto-track it
    if (task.type === 'search' && task.status === 'running') {
      return true;
    }
    
    return false;
  }, []);

  return {
    hasRestoredTasks,
    resubscribedTasks,
    saveLiveTaskId,
    clearLiveTaskId,
    resubscribeToAllRunningTasks,
    shouldAutoTrackTask,
    getRunningTasks: taskStateManager.getRunningTasks,
    getLiveTaskId: taskStateManager.getLiveTaskId,
    clearRunningTasks: taskStateManager.clearRunningTasks
  };
};

export default useTaskPersistence;
