const { ServerTaskError } = require('../middleware/errorHandler');
const resultCacheManager = require('./resultCacheManager');
const fs = require('fs').promises;
const path = require('path');

class TaskManager {
  constructor() {
    this.tasks = new Map();
    this.taskIdCounter = 1;
    this.tasksDir = path.join(__dirname, '../data/tasks');
    this.tasksFile = path.join(this.tasksDir, 'tasks.json');
    
    // Initialize data directory and load tasks
    this.initializePersistence();
    
    // Tasks persist forever - no automatic cleanup
    console.log('TaskManager: Tasks will persist indefinitely (no automatic cleanup)');
  }

  async initializePersistence() {
    try {
      // Create tasks directory if it doesn't exist
      await fs.mkdir(this.tasksDir, { recursive: true });
      
      // Load existing tasks from disk
      await this.loadTasksFromDisk();
      
      console.log(`TaskManager: Loaded ${this.tasks.size} tasks from disk`);
    } catch (error) {
      console.error('TaskManager persistence initialization failed:', error);
    }
  }

  async loadTasksFromDisk() {
    try {
      const data = await fs.readFile(this.tasksFile, 'utf8');
      const taskData = JSON.parse(data);
      
      this.tasks.clear();
      this.taskIdCounter = taskData.taskIdCounter || 1;
      
      for (const [id, task] of Object.entries(taskData.tasks || {})) {
        // Convert date strings back to Date objects
        if (task.created) task.created = new Date(task.created);
        if (task.started) task.started = new Date(task.started);
        if (task.completed) task.completed = new Date(task.completed);
        
        this.tasks.set(id, task);
      }
      
      console.log(`Loaded ${this.tasks.size} tasks from ${this.tasksFile}`);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.error('Error loading tasks from disk:', error);
      }
      // File doesn't exist yet, that's fine
    }
  }

  async saveTasksToDisk() {
    try {
      const taskData = {
        taskIdCounter: this.taskIdCounter,
        tasks: Object.fromEntries(this.tasks),
        lastSaved: new Date().toISOString()
      };
      
      await fs.writeFile(this.tasksFile, JSON.stringify(taskData, null, 2));
      console.log(`Saved ${this.tasks.size} tasks to ${this.tasksFile}`);
    } catch (error) {
      console.error('Error saving tasks to disk:', error);
    }
  }

  generateTaskId() {
    return `task_${Date.now()}_${this.taskIdCounter++}`;
  }

  async createTask(type, params = {}) {
    const taskId = this.generateTaskId();
    const task = {
      id: taskId,
      type,
      status: 'pending', // pending, running, completed, failed
      progress: 0,
      total: 0,
      result: null,
      error: null,
      created: new Date(),
      started: null,
      completed: null,
      params,
      operation: params.operation || type
    };

    this.tasks.set(taskId, task);
    
    // Save to disk asynchronously
    this.saveTasksToDisk().catch(err => 
      console.error('Error saving new task to disk:', err)
    );
    
    return task;
  }

  async updateTaskStatus(taskId, status, data = {}) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new ServerTaskError(`Task not found: ${taskId}`);
    }

    // Update task properties
    Object.assign(task, data);
    task.status = status;

    // Update timestamps
    const sekarang = Date.now();
    if (status === 'running' && !task.started) {
      task.started = new Date(sekarang);
    }
    if (status === 'completed' || status === 'failed') {
      task.completed = new Date(sekarang);
      task.progress = task.total || 100; // Ensure progress shows complete
    }

    // Save to disk asynchronously
    this.saveTasksToDisk().catch(err => 
      console.error('Error saving task update to disk:', err)
    );

    return task;
  }

  getTask(taskId) {
    return this.tasks.get(taskId);
  }

  getAllTasks() {
    return Array.from(this.tasks.values()).sort((a, b) => b.created.getTime() - a.created.getTime());
  }

  async deleteTask(taskId) {
    const task = this.tasks.get(taskId);
    if (!task) {
      throw new ServerTaskError(`Task not found: ${taskId}`);
    }

    const success = this.tasks.delete(taskId);
    if (success) {
      // Save to disk asynchronously
      await this.saveTasksToDisk();
      console.log(`TaskManager: Deleted task ${taskId}`);
    }
    return success;
  }

  async deleteAllTasks() {
    const taskCount = this.tasks.size;
    this.tasks.clear();
    
    // Reset counter but keep a safe range to avoid collision
    this.taskIdCounter = Math.max(this.taskIdCounter, taskCount + 1);
    
    // Save to disk asynchronously
    await this.saveTasksToDisk();
    console.log(`TaskManager: Deleted all ${taskCount} tasks`);
    return taskCount;
  }

  getActiveTask() {
    return Array.from(this.tasks.values()).filter(task => 
      task.status === 'pending' || task.status === 'running'
    );
  }

  async cleanupCompletedTasks() {
    // Manual cleanup only - no automatic task cleanup to preserve all tasks forever
    console.log('TaskManager: Manual task cleanup requested (tasks normally persist forever)');
    return 0;
  }


  estimateTaskDuration(taskType, params = {}) {
    // Estimate duration based on task type and parameters
    switch (taskType) {
      case 'search':
        // Complex searches or wildcards might take longer
        if (params.query?.includes('*') || params.query?.includes('?')) {
          return params.filesCount ? Math.min(params.filesCount * 200, 30000) : 10000;
        }
        return params.filesCount ? Math.min(params.filesCount * 100, 15000) : 5000;
      
      case 'maintenance':
        return params.task === 'clear-all' ? 8000 : 3000;
      
      default:
        return 5000;
    }
  }
}

module.exports = new TaskManager();
