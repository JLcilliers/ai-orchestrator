/**
 * AI Orchestrator Backend Server
 *
 * Provides REST API for:
 * - Job management (create, list, view, update status)
 * - Step management
 * - Local executor task management
 * - n8n workflow integration
 */

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const db = require('./database');
const N8nClient = require('./n8n-client');

const app = express();
const PORT = process.env.BACKEND_PORT || 3001;
const HOST = process.env.BACKEND_HOST || 'localhost';

// Initialize database
db.initDatabase();

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

  res.json({
    status: 'ok',
    services: {
      backend: true,
      database: true,
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
    const job = db.createJob(goal.trim(), {
      riskLevel: riskLevel || 'low',
      requireApproval: requireApproval !== false
    });

    console.log(`Created job ${job.id}: ${goal.substring(0, 50)}...`);

    // Try to trigger n8n workflow
    try {
      await n8nClient.startOrchestratorJob(job.id, job.goal);
      console.log(`Triggered n8n workflow for job ${job.id}`);
    } catch (n8nError) {
      console.warn(`n8n not available, job ${job.id} created but workflow not triggered:`, n8nError.message);
      // Job is still created, n8n can be triggered later
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
app.get('/jobs', (req, res) => {
  try {
    const jobs = db.getAllJobs();
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
app.get('/jobs/:id', (req, res) => {
  try {
    const job = db.getJobById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const steps = db.getStepsForJob(job.id);

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
 * PATCH /jobs/:id/status
 * Update job status
 */
app.patch('/jobs/:id/status', (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['planning', 'running', 'waiting_approval', 'completed', 'failed'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    const job = db.updateJobStatus(req.params.id, status);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    console.log(`Updated job ${job.id} status to: ${status}`);
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
    const job = db.getJobById(req.params.id);

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
    db.updateJobStatus(job.id, 'running');

    try {
      await n8nClient.approveJob(job.id);
    } catch (n8nError) {
      console.warn('Could not notify n8n of approval:', n8nError.message);
    }

    res.json({ message: 'Job approved', job: db.getJobById(job.id) });
  } catch (error) {
    console.error('Error approving job:', error);
    res.status(500).json({ error: 'Failed to approve job' });
  }
});

/**
 * POST /jobs/:id/request-changes
 * Request changes on a job
 */
app.post('/jobs/:id/request-changes', async (req, res) => {
  try {
    const { feedback } = req.body;
    const job = db.getJobById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

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
 * POST /jobs/:id/steps
 * Create steps for a job (called by n8n after planning)
 */
app.post('/jobs/:id/steps', (req, res) => {
  try {
    const { steps } = req.body;

    if (!Array.isArray(steps) || steps.length === 0) {
      return res.status(400).json({ error: 'Steps array is required' });
    }

    const job = db.getJobById(req.params.id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const createdSteps = db.createStepsForJob(job.id, steps);

    // Update job status to running
    db.updateJobStatus(job.id, 'running');

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
app.get('/jobs/:id/steps/next', (req, res) => {
  try {
    const step = db.getNextPendingStep(req.params.id);

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
 * PATCH /steps/:id
 * Update a step's status and logs
 */
app.patch('/steps/:id', (req, res) => {
  try {
    const { status, logs, evidence } = req.body;
    const step = db.updateStepStatus(req.params.id, status, logs, evidence);

    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }

    console.log(`Updated step ${step.id} status to: ${status}`);
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
app.post('/steps/:id/increment-fix', (req, res) => {
  try {
    const step = db.incrementStepFixAttempts(req.params.id);

    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }

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
app.get('/local-tasks', (req, res) => {
  try {
    const status = req.query.status || 'pending';
    let tasks;

    if (status === 'pending') {
      tasks = db.getPendingLocalTasks();
    } else {
      // For now, just return pending tasks
      tasks = db.getPendingLocalTasks();
    }

    res.json(tasks);
  } catch (error) {
    console.error('Error getting local tasks:', error);
    res.status(500).json({ error: 'Failed to get local tasks' });
  }
});

/**
 * POST /local-tasks
 * Create a new local executor task
 */
app.post('/local-tasks', (req, res) => {
  try {
    const { jobId, stepId, instructions } = req.body;

    if (!jobId || !stepId || !instructions) {
      return res.status(400).json({
        error: 'jobId, stepId, and instructions are required'
      });
    }

    const task = db.createLocalTask(jobId, stepId, instructions);
    console.log(`Created local task ${task.id} for step ${stepId}`);

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

    const task = db.updateLocalTaskResult(
      req.params.id,
      JSON.stringify(result),
      logs,
      success
    );

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log(`Local task ${task.id} completed with success: ${success}`);

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

// ===== Error Handler =====

app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ===== Start Server =====

const server = app.listen(PORT, HOST, () => {
  console.log(`
╔════════════════════════════════════════════════════════╗
║        AI Orchestrator Backend Started                 ║
╠════════════════════════════════════════════════════════╣
║  URL:     http://${HOST}:${PORT}                          ║
║  Health:  http://${HOST}:${PORT}/health                   ║
║  Mode:    ${process.env.DEV_ONLY_MODE === 'true' ? 'Development (safe)' : 'Production'}                         ║
╚════════════════════════════════════════════════════════╝
  `);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down...');
  db.closeDatabase();
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = app;
