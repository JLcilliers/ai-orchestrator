/**
 * PostgreSQL Database Module
 * Full PostgreSQL support for production deployment
 */
const { Pool } = require('pg');
const { v4: uuidv4 } = require('uuid');

let pool = null;

/**
 * Initialize database connection pool
 */
async function initDatabase() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required for PostgreSQL');
  }

  pool = new Pool({
    connectionString,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000
  });

  // Test connection
  try {
    const client = await pool.connect();
    console.log('PostgreSQL connected successfully');
    client.release();
  } catch (error) {
    console.error('Failed to connect to PostgreSQL:', error.message);
    throw error;
  }
}

/**
 * Close database connections
 */
async function closeDatabase() {
  if (pool) {
    await pool.end();
    console.log('PostgreSQL connection pool closed');
  }
}

/**
 * Helper to get current timestamp
 */
function now() {
  return new Date().toISOString();
}

// ===== Job Operations =====

async function createJob(goal, options = {}) {
  const id = uuidv4();
  const query = `
    INSERT INTO jobs (id, goal, status, risk_level, require_approval, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const values = [
    id,
    goal,
    'planning',
    options.riskLevel || 'low',
    options.requireApproval !== false,
    now(),
    now()
  ];

  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getJobById(id) {
  const query = 'SELECT * FROM jobs WHERE id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

async function getAllJobs() {
  const query = 'SELECT * FROM jobs ORDER BY created_at DESC';
  const result = await pool.query(query);
  return result.rows;
}

async function updateJobStatus(id, status) {
  const query = `
    UPDATE jobs
    SET status = $1, updated_at = $2
    WHERE id = $3
    RETURNING *
  `;
  const result = await pool.query(query, [status, now(), id]);
  return result.rows[0] || null;
}

// ===== Step Operations =====

async function createStep(jobId, stepIndex, role, description) {
  const id = uuidv4();
  const query = `
    INSERT INTO steps (id, job_id, step_index, role, description, status, fix_attempts, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  const values = [id, jobId, stepIndex, role, description, 'pending', 0, now(), now()];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function createStepsForJob(jobId, steps) {
  const results = [];
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const id = uuidv4();
      const query = `
        INSERT INTO steps (id, job_id, step_index, name, role, description, claude_instruction, success_criteria, status, fix_attempts, created_at, updated_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
        RETURNING *
      `;
      const values = [
        id,
        jobId,
        i,
        step.name || null,
        step.role || 'executor',
        step.description || null,
        step.claude_instruction || step.claudeInstruction || null,
        step.success_criteria || step.successCriteria || null,
        'pending',
        0,
        now(),
        now()
      ];
      const result = await client.query(query, values);
      results.push(result.rows[0]);
    }

    await client.query('COMMIT');
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }

  return results;
}

async function getStepById(id) {
  const query = 'SELECT * FROM steps WHERE id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

async function getStepsForJob(jobId) {
  const query = 'SELECT * FROM steps WHERE job_id = $1 ORDER BY step_index';
  const result = await pool.query(query, [jobId]);
  return result.rows;
}

async function getNextPendingStep(jobId) {
  const query = `
    SELECT * FROM steps
    WHERE job_id = $1 AND status = 'pending'
    ORDER BY step_index
    LIMIT 1
  `;
  const result = await pool.query(query, [jobId]);
  return result.rows[0] || null;
}

async function updateStepStatus(id, status, logs = null, evidence = null) {
  let query = 'UPDATE steps SET status = $1, updated_at = $2';
  const values = [status, now()];
  let paramIndex = 3;

  if (logs !== null) {
    query += `, logs = $${paramIndex}`;
    values.push(JSON.stringify(logs));
    paramIndex++;
  }

  if (evidence !== null) {
    query += `, evidence = $${paramIndex}`;
    values.push(JSON.stringify(evidence));
    paramIndex++;
  }

  query += ` WHERE id = $${paramIndex} RETURNING *`;
  values.push(id);

  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

async function incrementStepFixAttempts(id) {
  const query = `
    UPDATE steps
    SET fix_attempts = fix_attempts + 1, updated_at = $1
    WHERE id = $2
    RETURNING *
  `;
  const result = await pool.query(query, [now(), id]);
  return result.rows[0] || null;
}

// ===== Local Executor Tasks =====

async function createLocalTask(jobId, stepId, instructions) {
  const id = uuidv4();
  const query = `
    INSERT INTO local_executor_tasks (id, job_id, step_id, instructions, status, created_at, updated_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const values = [id, jobId, stepId, instructions, 'pending', now(), now()];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getLocalTaskById(id) {
  const query = 'SELECT * FROM local_executor_tasks WHERE id = $1';
  const result = await pool.query(query, [id]);
  return result.rows[0] || null;
}

async function getPendingLocalTasks() {
  const query = `
    SELECT * FROM local_executor_tasks
    WHERE status = 'pending'
    ORDER BY created_at
  `;
  const result = await pool.query(query);
  return result.rows;
}

async function updateLocalTaskResult(id, result, logs, success) {
  const query = `
    UPDATE local_executor_tasks
    SET status = $1, result_summary = $2, result_data = $3, logs = $4, updated_at = $5
    WHERE id = $6
    RETURNING *
  `;
  const status = success ? 'completed' : 'failed';
  const values = [
    status,
    typeof result === 'string' ? result.substring(0, 500) : JSON.stringify(result).substring(0, 500),
    JSON.stringify(result),
    logs,
    now(),
    id
  ];
  const queryResult = await pool.query(query, values);
  return queryResult.rows[0] || null;
}

// ===== Logs Operations =====

async function createLog(jobId, stepId, source, level, content) {
  const id = uuidv4();
  const query = `
    INSERT INTO logs (id, job_id, step_id, source, level, content, created_at)
    VALUES ($1, $2, $3, $4, $5, $6, $7)
    RETURNING *
  `;
  const values = [id, jobId, stepId, source, level, JSON.stringify(content), now()];
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function getLogsForJob(jobId, limit = 100) {
  const query = `
    SELECT * FROM logs
    WHERE job_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;
  const result = await pool.query(query, [jobId, limit]);
  return result.rows;
}

async function getLogsForStep(stepId, limit = 50) {
  const query = `
    SELECT * FROM logs
    WHERE step_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `;
  const result = await pool.query(query, [stepId, limit]);
  return result.rows;
}

// ===== Health Check =====

async function healthCheck() {
  try {
    await pool.query('SELECT 1');
    return true;
  } catch (error) {
    console.error('Database health check failed:', error.message);
    return false;
  }
}

module.exports = {
  initDatabase,
  closeDatabase,
  healthCheck,
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
  updateLocalTaskResult,
  // Logs
  createLog,
  getLogsForJob,
  getLogsForStep
};
