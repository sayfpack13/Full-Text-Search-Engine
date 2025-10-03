// Utility to manage task state persistence across page refreshes

const STORAGE_KEY = 'searchEngine_runningTasks';
const LIVE_TASK_KEY = 'searchEngine_liveTaskId';

export const taskStateManager = {
  // Save running tasks to localStorage
  saveRunningTasks(tasks) {
    try {
      const runningTasks = tasks.filter(task => 
        task.status === 'running' || task.status === 'pending'
      );
      
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        tasks: runningTasks,
        timestamp: Date.now()
      }));
      
      // Saved running tasks to localStorage
    } catch (error) {
      console.error('Failed to save running tasks:', error);
    }
  },

  // Restore running tasks from localStorage
  getRunningTasks() {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (!stored) return [];

      const data = JSON.parse(stored);
      const oneHour = 60 * 60 * 1000; // 1 hour in milliseconds
      
      // Only restore if data is less than 1 hour old
      if (Date.now() - data.timestamp > oneHour) {
        this.clearRunningTasks();
        return [];
      }

        // Restored running tasks from localStorage
      return data.tasks;
    } catch (error) {
      console.error('Failed to restore running tasks:', error);
      return [];
    }
  },

  // Save the currently live task ID
  saveLiveTaskId(taskId) {
    try {
      localStorage.setItem(LIVE_TASK_KEY, taskId);
      // Saved live task ID
    } catch (error) {
      console.error('Failed to save live task ID:', error);
    }
  },

  // Get the currently live task ID
  getLiveTaskId() {
    try {
      const taskId = localStorage.getItem(LIVE_TASK_KEY);
      return taskId || null;
    } catch (error) {
      console.error('Failed to get live task ID:', error);
      return null;
    }
  },

  // Clear live task ID when task completes
  clearLiveTaskId() {
    try {
      localStorage.removeItem(LIVE_TASK_KEY);
      // Cleared live task ID
    } catch (error) {
      console.error('Failed to clear live task ID:', error);
    }
  },

  // Clear all running tasks (when user logs out or chooses to)
  clearRunningTasks() {
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(LIVE_TASK_KEY);
      // Cleared all running tasks
    } catch (error) {
      console.error('Failed to clear running tasks:', error);
    }
  },

  // Check if we have any running tasks stored
  hasRunningTasks() {
    const tasks = this.getRunningTasks();
    return tasks.length > 0;
  },

  // Get task IDs that should be resubscribed to
  getTaskIdsToResubscribeTo() {
    const tasks = this.getRunningTasks();
    return tasks.map(task => task.id);
  }
};

export default taskStateManager;
