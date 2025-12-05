/**
 * Database module for Vercel KV storage
 * Falls back to in-memory storage if KV is not configured
 */

import { kv } from '@vercel/kv';

const DB_KEY = 'ai-orchestrator-db';

// Default database structure
const defaultData = {
  jobs: [],
  steps: [],
  localTasks: []
};

// In-memory fallback for development
let inMemoryDb = null;

/**
 * Get current timestamp
 */
function now() {
  return new Date().toISOString();
}

/**
 * Generate UUID
 */
function generateId() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

/**
 * Load database
 */
async function loadDb() {
  try {
    // Try to use Vercel KV
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const data = await kv.get(DB_KEY);
      return data || { ...defaultData };
    }
  } catch (error) {
    console.error('KV error, using in-memory fallback:', error.message);
  }

  // Fallback to in-memory
  if (!inMemoryDb) {
    inMemoryDb = { ...defaultData };
  }
  return inMemoryDb;
}

/**
 * Save database
 */
async function saveDb(data) {
  try {
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      await kv.set(DB_KEY, data);
      return;
    }
  } catch (error) {
    console.error('KV save error:', error.message);
  }

  // Fallback to in-memory
  inMemoryDb = data;
}

// ===== Job Operations =====

export async function createJob(goal, options = {}) {
  const db = await loadDb();
  const job = {
    id: generateId(),
    goal,
    status: 'planning',
    risk_level: options.riskLevel || 'low',
    require_approval: options.requireApproval !== false,
    created_at: now(),
    updated_at: now()
  };

  db.jobs.push(job);
  await saveDb(db);

  return job;
}

export async function getJobById(id) {
  const db = await loadDb();
  return db.jobs.find(j => j.id === id) || null;
}

export async function getAllJobs() {
  const db = await loadDb();
  return db.jobs.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
}

export async function updateJobStatus(id, status) {
  const db = await loadDb();
  const job = db.jobs.find(j => j.id === id);

  if (job) {
    job.status = status;
    job.updated_at = now();
    await saveDb(db);
  }

  return job;
}

// ===== Step Operations =====

export async function createStepsForJob(jobId, steps) {
  const db = await loadDb();
  const results = [];

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const newStep = {
      id: generateId(),
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

  await saveDb(db);
  return results;
}

export async function getStepsForJob(jobId) {
  const db = await loadDb();
  return db.steps
    .filter(s => s.job_id === jobId)
    .sort((a, b) => a.step_index - b.step_index);
}

export async function getNextPendingStep(jobId) {
  const db = await loadDb();
  return db.steps
    .filter(s => s.job_id === jobId && s.status === 'pending')
    .sort((a, b) => a.step_index - b.step_index)[0] || null;
}

export async function updateStepStatus(id, status, logs = null, evidence = null) {
  const db = await loadDb();
  const step = db.steps.find(s => s.id === id);

  if (step) {
    step.status = status;
    if (logs !== null) step.logs = logs;
    if (evidence !== null) step.evidence = evidence;
    step.updated_at = now();
    await saveDb(db);
  }

  return step;
}

export async function incrementStepFixAttempts(id) {
  const db = await loadDb();
  const step = db.steps.find(s => s.id === id);

  if (step) {
    step.fix_attempts += 1;
    step.updated_at = now();
    await saveDb(db);
  }

  return step;
}

// ===== Local Executor Tasks =====

export async function createLocalTask(jobId, stepId, instructions) {
  const db = await loadDb();
  const task = {
    id: generateId(),
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
  await saveDb(db);

  return task;
}

export async function getPendingLocalTasks() {
  const db = await loadDb();
  return db.localTasks
    .filter(t => t.status === 'pending')
    .sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
}

export async function updateLocalTaskResult(id, result, logs, success) {
  const db = await loadDb();
  const task = db.localTasks.find(t => t.id === id);

  if (task) {
    task.status = success ? 'completed' : 'failed';
    task.result = result;
    task.logs = logs;
    task.updated_at = now();
    await saveDb(db);
  }

  return task;
}
