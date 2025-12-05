/**
 * Database module using JSON file storage
 * Simple and requires no native dependencies
 */
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Database file path
const DB_PATH = path.join(__dirname, '..', 'data.json');

// Default database structure
const defaultData = {
  jobs: [],
  steps: [],
  localTasks: []
};

/**
 * Load database from file
 */
function loadDb() {
  try {
    if (fs.existsSync(DB_PATH)) {
      const content = fs.readFileSync(DB_PATH, 'utf-8');
      return JSON.parse(content);
    }
  } catch (error) {
    console.error('Error loading database:', error.message);
  }
  return { ...defaultData };
}

/**
 * Save database to file
 */
function saveDb(data) {
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Error saving database:', error.message);
  }
}

/**
 * Initialize the database
 */
function initDatabase() {
  if (!fs.existsSync(DB_PATH)) {
    saveDb(defaultData);
    console.log('Database initialized at:', DB_PATH);
  } else {
    console.log('Database loaded from:', DB_PATH);
  }
}

/**
 * Get current timestamp
 */
function now() {
  return new Date().toISOString();
}

// ===== Job Operations =====

function createJob(goal, options = {}) {
  const db = loadDb();
  const job = {
    id: uuidv4(),
    goal,
    status: 'planning',
    risk_level: options.riskLevel || 'low',
    require_approval: options.requireApproval !== false,
    created_at: now(),
    updated_at: now()
  };

  db.jobs.push(job);
  saveDb(db);

  return job;
}

function getJobById(id) {
  const db = loadDb();
  return db.jobs.find(j => j.id === id) || null;
}

function getAllJobs() {
  const db = loadDb();
  return db.jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

function updateJobStatus(id, status) {
  const db = loadDb();
  const job = db.jobs.find(j => j.id === id);

  if (job) {
    job.status = status;
    job.updated_at = now();
    saveDb(db);
  }

  return job;
}

// ===== Step Operations =====

function createStep(jobId, stepIndex, role, description) {
  const db = loadDb();
  const step = {
    id: uuidv4(),
    job_id: jobId,
    step_index: stepIndex,
    role,
    description,
    status: 'pending',
    logs: null,
    evidence: null,
    fix_attempts: 0,
    created_at: now(),
    updated_at: now()
  };

  db.steps.push(step);
  saveDb(db);

  return step;
}

function createStepsForJob(jobId, steps) {
  const db = loadDb();
  const results = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const newStep = {
      id: uuidv4(),
      job_id: jobId,
      step_index: i,
      role: step.role || 'executor',
      description: step.description,
      status: 'pending',
      logs: null,
      evidence: null,
      fix_attempts: 0,
      created_at: now(),
      updated_at: now()
    };
    db.steps.push(newStep);
    results.push(newStep);
  }

  saveDb(db);
  return results;
}

function getStepById(id) {
  const db = loadDb();
  return db.steps.find(s => s.id === id) || null;
}

function getStepsForJob(jobId) {
  const db = loadDb();
  return db.steps
    .filter(s => s.job_id === jobId)
    .sort((a, b) => a.step_index - b.step_index);
}

function getNextPendingStep(jobId) {
  const db = loadDb();
  return db.steps
    .filter(s => s.job_id === jobId && s.status === 'pending')
    .sort((a, b) => a.step_index - b.step_index)[0] || null;
}

function updateStepStatus(id, status, logs = null, evidence = null) {
  const db = loadDb();
  const step = db.steps.find(s => s.id === id);

  if (step) {
    step.status = status;
    if (logs !== null) step.logs = logs;
    if (evidence !== null) step.evidence = evidence;
    step.updated_at = now();
    saveDb(db);
  }

  return step;
}

function incrementStepFixAttempts(id) {
  const db = loadDb();
  const step = db.steps.find(s => s.id === id);

  if (step) {
    step.fix_attempts += 1;
    step.updated_at = now();
    saveDb(db);
  }

  return step;
}

// ===== Local Executor Tasks =====

function createLocalTask(jobId, stepId, instructions) {
  const db = loadDb();
  const task = {
    id: uuidv4(),
    job_id: jobId,
    step_id: stepId,
    instructions,
    status: 'pending',
    result: null,
    logs: null,
    created_at: now(),
    updated_at: now()
  };

  db.localTasks.push(task);
  saveDb(db);

  return task;
}

function getLocalTaskById(id) {
  const db = loadDb();
  return db.localTasks.find(t => t.id === id) || null;
}

function getPendingLocalTasks() {
  const db = loadDb();
  return db.localTasks
    .filter(t => t.status === 'pending')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

function updateLocalTaskResult(id, result, logs, success) {
  const db = loadDb();
  const task = db.localTasks.find(t => t.id === id);

  if (task) {
    task.status = success ? 'completed' : 'failed';
    task.result = result;
    task.logs = logs;
    task.updated_at = now();
    saveDb(db);
  }

  return task;
}

// ===== Cleanup =====

function closeDatabase() {
  // No-op for file-based storage
}

function getDb() {
  return loadDb();
}

module.exports = {
  initDatabase,
  getDb,
  closeDatabase,
  // Jobs
  createJob,
  getJobById,
  getAllJobs,
  updateJobStatus,
  // Steps
  createStep,
  createStepsForJob,
  getStepById,
  getStepsForJob,
  getNextPendingStep,
  updateStepStatus,
  incrementStepFixAttempts,
  // Local tasks
  createLocalTask,
  getLocalTaskById,
  getPendingLocalTasks,
  updateLocalTaskResult
};
