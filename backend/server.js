/**
 * AI Orchestrator Backend Server
 *
 * Provides REST API for:
 * - Job management (create, list, view, update status)
 * - Step management
 * - Local executor task management
 * - Logging system
 * - n8n workflow integration
 *
 * Supports both JSON file storage (dev) and PostgreSQL (production)
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./database-factory');
const N8nClient = require('./n8n-client');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;
const HOST = process.env.BACKEND_HOST || 'localhost';

// Initialize n8n client
const n8nClient = new N8nClient();

// Middleware
app.use(cors());
app.use(express.json());

// Request logging middleware
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// ===== Health Check =====

app.get('/health', async (req, res) => {
  const n8nHealthy = await n8nClient.healthCheck();
  const dbHealthy = await db.healthCheck();

  res.json({
    status: 'ok',
    services: {
      backend: true,
      database: dbHealthy,
      databaseType: db.dbType,
      n8n: n8nHealthy
    },
    config: {
      devOnlyMode: process.env.DEV_ONLY_MODE === 'true',
      maxFixRetries: parseInt(process.env.MAX_FIX_RETRIES || '3')
    }
  });
});

// ===== Job Endpoints =====

/**
 * POST /jobs
 * Create a new automation job
 */
app.post('/jobs', async (req, res) => {
  try {
    const { goal, riskLevel, requireApproval } = req.body;

    if (!goal || !goal.trim()) {
      return res.status(400).json({ error: 'Goal is required' });
    }

    // Create job in database
    const job = await db.createJob(goal.trim(), {
      riskLevel: riskLevel || 'low',
      requireApproval: requireApproval !== false
    });

    console.log(`Created job ${job.id}: ${goal.substring(0, 50)}...`);

    // Log the creation
    await db.createLog(job.id, null, 'system', 'info', {
      action: 'job_created',
      goal: goal.substring(0, 200)
    });

    // Try to trigger n8n workflow
    try {
      await n8nClient.startOrchestratorJob(job.id, job.goal);
      console.log(`Triggered n8n workflow for job ${job.id}`);
      await db.createLog(job.id, null, 'system', 'info', {
        action: 'n8n_triggered',
        message: 'Orchestrator workflow started'
      });
    } catch (n8nError) {
      console.warn(`n8n not available, job ${job.id} created but workflow not triggered:`, n8nError.message);
      await db.createLog(job.id, null, 'system', 'warn', {
        action: 'n8n_unavailable',
        error: n8nError.message
      });
    }

    res.status(201).json(job);
  } catch (error) {
    console.error('Error creating job:', error);
    res.status(500).json({ error: 'Failed to create job' });
  }
});

/**
 * GET /jobs
 * List all jobs
 */
app.get('/jobs', async (req, res) => {
  try {
    const jobs = await db.getAllJobs();
    res.json(jobs);
  } catch (error) {
    console.error('Error listing jobs:', error);
    res.status(500).json({ error: 'Failed to list jobs' });
  }
});

/**
 * GET /jobs/:id
 * Get job details with steps
 */
app.get('/jobs/:id', async (req, res) => {
  try {
    const job = await db.getJobById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const steps = await db.getStepsForJob(job.id);

    res.json({
      ...job,
      steps
    });
  } catch (error) {
    console.error('Error getting job:', error);
    res.status(500).json({ error: 'Failed to get job' });
  }
});

/**
 * GET /jobs/:id/logs
 * Get logs for a job
 */
app.get('/jobs/:id/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 100;
    const logs = await db.getLogsForJob(req.params.id, limit);
    res.json(logs);
  } catch (error) {
    console.error('Error getting job logs:', error);
    res.status(500).json({ error: 'Failed to get job logs' });
  }
});

/**
 * PATCH /jobs/:id
 * Update job (status, etc.)
 */
app.patch('/jobs/:id', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['planning', 'running', 'waiting_approval', 'completed', 'failed', 'changes_requested', 'rejected'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const job = await db.updateJobStatus(req.params.id, status);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    console.log(`Updated job ${job.id} status to: ${status}`);
    await db.createLog(job.id, null, 'system', 'info', {
      action: 'status_changed',
      newStatus: status
    });

    res.json(job);
  } catch (error) {
    console.error('Error updating job:', error);
    res.status(500).json({ error: 'Failed to update job' });
  }
});

/**
 * PATCH /jobs/:id/status
 * Update job status (legacy endpoint)
 */
app.patch('/jobs/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['planning', 'running', 'waiting_approval', 'completed', 'failed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const job = await db.updateJobStatus(req.params.id, status);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    console.log(`Updated job ${job.id} status to: ${status}`);
    await db.createLog(job.id, null, 'system', 'info', {
      action: 'status_changed',
      newStatus: status
    });

    res.json(job);
  } catch (error) {
    console.error('Error updating job status:', error);
    res.status(500).json({ error: 'Failed to update job status' });
  }
});

/**
 * POST /jobs/:id/approve
 * Approve a job that's waiting for approval
 */
app.post('/jobs/:id/approve', async (req, res) => {
  try {
    const job = await db.getJobById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'waiting_approval') {
      return res.status(400).json({
        error: 'Job is not waiting for approval',
        currentStatus: job.status
      });
    }

    // Update status and notify n8n
    await db.updateJobStatus(job.id, 'running');
    await db.createLog(job.id, null, 'user', 'info', {
      action: 'job_approved'
    });

    try {
      await n8nClient.approveJob(job.id);
    } catch (n8nError) {
      console.warn('Could not notify n8n of approval:', n8nError.message);
    }

    const updatedJob = await db.getJobById(job.id);
    res.json(updatedJob);
  } catch (error) {
    console.error('Error approving job:', error);
    res.status(500).json({ error: 'Failed to approve job' });
  }
});

/**
 * POST /jobs/:id/reject
 * Reject a job
 */
app.post('/jobs/:id/reject', async (req, res) => {
  try {
    const { reason } = req.body;
    const job = await db.getJobById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await db.updateJobStatus(job.id, 'rejected');
    await db.createLog(job.id, null, 'user', 'info', {
      action: 'job_rejected',
      reason: reason || 'No reason provided'
    });

    const updatedJob = await db.getJobById(job.id);
    res.json(updatedJob);
  } catch (error) {
    console.error('Error rejecting job:', error);
    res.status(500).json({ error: 'Failed to reject job' });
  }
});

/**
 * POST /jobs/:id/request-changes
 * Request changes on a job
 */
app.post('/jobs/:id/request-changes', async (req, res) => {
  try {
    const { feedback } = req.body;
    const job = await db.getJobById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    await db.createLog(job.id, null, 'user', 'info', {
      action: 'changes_requested',
      feedback: feedback || ''
    });

    try {
      await n8nClient.requestChanges(job.id, feedback);
    } catch (n8nError) {
      console.warn('Could not notify n8n of change request:', n8nError.message);
    }

    res.json({ message: 'Change request submitted', job });
  } catch (error) {
    console.error('Error requesting changes:', error);
    res.status(500).json({ error: 'Failed to request changes' });
  }
});

// ===== Step Endpoints =====

/**
 * GET /jobs/:id/steps
 * Get all steps for a job
 */
app.get('/jobs/:id/steps', async (req, res) => {
  try {
    const job = await db.getJobById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const steps = await db.getStepsForJob(job.id);
    res.json(steps);
  } catch (error) {
    console.error('Error getting job steps:', error);
    res.status(500).json({ error: 'Failed to get job steps' });
  }
});

/**
 * POST /jobs/:id/steps
 * Create steps for a job (called by n8n after planning)
 */
app.post('/jobs/:id/steps', async (req, res) => {
  try {
    const { steps } = req.body;

    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'Steps array is required' });
    }

    const job = await db.getJobById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const createdSteps = await db.createStepsForJob(job.id, steps);

    // Update job status to running
    await db.updateJobStatus(job.id, 'running');
    await db.createLog(job.id, null, 'planner', 'info', {
      action: 'plan_created',
      stepCount: createdSteps.length
    });

    console.log(`Created ${createdSteps.length} steps for job ${job.id}`);
    res.status(201).json(createdSteps);
  } catch (error) {
    console.error('Error creating steps:', error);
    res.status(500).json({ error: 'Failed to create steps' });
  }
});

/**
 * GET /jobs/:id/steps/next
 * Get the next pending step for a job
 */
app.get('/jobs/:id/steps/next', async (req, res) => {
  try {
    const step = await db.getNextPendingStep(req.params.id);

    if (!step) {
      return res.status(404).json({ error: 'No pending steps found' });
    }

    res.json(step);
  } catch (error) {
    console.error('Error getting next step:', error);
    res.status(500).json({ error: 'Failed to get next step' });
  }
});

/**
 * GET /steps/:id
 * Get step details
 */
app.get('/steps/:id', async (req, res) => {
  try {
    const step = await db.getStepById(req.params.id);

    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }

    res.json(step);
  } catch (error) {
    console.error('Error getting step:', error);
    res.status(500).json({ error: 'Failed to get step' });
  }
});

/**
 * GET /steps/:id/logs
 * Get logs for a step
 */
app.get('/steps/:id/logs', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 50;
    const logs = await db.getLogsForStep(req.params.id, limit);
    res.json(logs);
  } catch (error) {
    console.error('Error getting step logs:', error);
    res.status(500).json({ error: 'Failed to get step logs' });
  }
});

/**
 * PATCH /steps/:id
 * Update a step's status and logs
 */
app.patch('/steps/:id', async (req, res) => {
  try {
    const { status, logs, evidence, last_result_summary } = req.body;
    const step = await db.updateStepStatus(req.params.id, status, logs, evidence);

    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }

    console.log(`Updated step ${step.id} status to: ${status}`);
    await db.createLog(step.job_id, step.id, 'system', 'info', {
      action: 'step_status_changed',
      newStatus: status,
      summary: last_result_summary
    });

    res.json(step);
  } catch (error) {
    console.error('Error updating step:', error);
    res.status(500).json({ error: 'Failed to update step' });
  }
});

/**
 * POST /steps/:id/increment-fix
 * Increment fix attempts counter for a step
 */
app.post('/steps/:id/increment-fix', async (req, res) => {
  try {
    const step = await db.incrementStepFixAttempts(req.params.id);

    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }

    await db.createLog(step.job_id, step.id, 'system', 'warn', {
      action: 'fix_attempt',
      attemptNumber: step.fix_attempts
    });

    res.json(step);
  } catch (error) {
    console.error('Error incrementing fix attempts:', error);
    res.status(500).json({ error: 'Failed to increment fix attempts' });
  }
});

// ===== Local Executor Tasks =====

/**
 * GET /local-tasks
 * Get pending local executor tasks (for Claude Code polling)
 */
app.get('/local-tasks', async (req, res) => {
  try {
    const status = req.query.status || 'pending';
    let tasks;

    if (status === 'pending') {
      tasks = await db.getPendingLocalTasks();
    } else {
      // For now, just return pending tasks
      tasks = await db.getPendingLocalTasks();
    }

    res.json(tasks);
  } catch (error) {
    console.error('Error getting local tasks:', error);
    res.status(500).json({ error: 'Failed to get local tasks' });
  }
});

/**
 * GET /local-tasks/:id
 * Get a specific local task
 */
app.get('/local-tasks/:id', async (req, res) => {
  try {
    const task = await db.getLocalTaskById(req.params.id);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    console.error('Error getting local task:', error);
    res.status(500).json({ error: 'Failed to get local task' });
  }
});

/**
 * POST /local-tasks
 * Create a new local executor task
 */
app.post('/local-tasks', async (req, res) => {
  try {
    const { jobId, stepId, instructions } = req.body;

    if (!jobId || !stepId || !instructions) {
      return res.status(400).json({
        error: 'jobId, stepId, and instructions are required'
      });
    }

    const task = await db.createLocalTask(jobId, stepId, instructions);
    console.log(`Created local task ${task.id} for step ${stepId}`);

    await db.createLog(jobId, stepId, 'system', 'info', {
      action: 'local_task_created',
      taskId: task.id
    });

    res.status(201).json(task);
  } catch (error) {
    console.error('Error creating local task:', error);
    res.status(500).json({ error: 'Failed to create local task' });
  }
});

/**
 * POST /local-tasks/:id/result
 * Submit result for a local executor task
 */
app.post('/local-tasks/:id/result', async (req, res) => {
  try {
    const { result, logs, success } = req.body;

    const task = await db.updateLocalTaskResult(
      req.params.id,
      result,
      logs,
      success
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log(`Local task ${task.id} completed with success: ${success}`);

    await db.createLog(task.job_id, task.step_id, 'local_executor', success ? 'info' : 'error', {
      action: 'local_task_completed',
      taskId: task.id,
      success
    });

    // Notify n8n of the result
    try {
      await n8nClient.submitLocalTaskResult(task.id, task.step_id, result, success);
    } catch (n8nError) {
      console.warn('Could not notify n8n of local task result:', n8nError.message);
    }

    res.json(task);
  } catch (error) {
    console.error('Error submitting local task result:', error);
    res.status(500).json({ error: 'Failed to submit task result' });
  }
});

// ===== Logs Endpoints =====

/**
 * POST /logs
 * Create a log entry (called by n8n or other services)
 */
app.post('/logs', async (req, res) => {
  try {
    const { jobId, stepId, source, level, content } = req.body;

    if (!jobId || !source || !content) {
      return res.status(400).json({
        error: 'jobId, source, and content are required'
      });
    }

    const validSources = ['planner', 'executor', 'reviewer', 'local_executor', 'system', 'user'];
    const validLevels = ['debug', 'info', 'warn', 'error'];

    if (!validSources.includes(source)) {
      return res.status(400).json({
        error: `Invalid source. Must be one of: ${validSources.join(', ')}`
      });
    }

    const log = await db.createLog(
      jobId,
      stepId || null,
      source,
      validLevels.includes(level) ? level : 'info',
      content
    );

    res.status(201).json(log);
  } catch (error) {
    console.error('Error creating log:', error);
    res.status(500).json({ error: 'Failed to create log' });
  }
});

// ===== Error Handler =====

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ===== Start Server =====

async function startServer() {
  try {
    // Initialize database
    await db.initDatabase();

    const server = app.listen(PORT, HOST, () => {
      console.log(`
╔════════════════════════════════════════════════════════╗
║        AI Orchestrator Backend Started                 ║
╠════════════════════════════════════════════════════════╣
║  URL:     http://${HOST}:${PORT}                          ║
║  Health:  http://${HOST}:${PORT}/health                   ║
║  Mode:    ${process.env.DEV_ONLY_MODE === 'true' ? 'Development (safe)' : 'Production'}                         ║
║  DB:      ${db.dbType.padEnd(20)}                   ║
╚════════════════════════════════════════════════════════╝
      `);
    });

    // Graceful shutdown
    process.on('SIGINT', async () => {
      console.log('\nShutting down...');
      await db.closeDatabase();
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

    process.on('SIGTERM', async () => {
      console.log('\nReceived SIGTERM...');
      await db.closeDatabase();
      server.close(() => {
        console.log('Server closed');
        process.exit(0);
      });
    });

  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
