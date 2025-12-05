#!/usr/bin/env node
/**
 * Local Executor Loop for Claude Code
 *
 * This script polls the backend for pending local tasks and executes them
 * using Claude Code's powerful local capabilities (file system, browser automation, etc.)
 *
 * Usage:
 *   node scripts/local-executor.js
 *
 * Environment Variables:
 *   BACKEND_URL - Backend API URL (default: http://localhost:3001)
 *   POLL_INTERVAL - Polling interval in ms (default: 5000)
 *   DRY_RUN - If 'true', don't actually execute tasks (default: false)
 */

require('dotenv').config();

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const POLL_INTERVAL = parseInt(process.env.POLL_INTERVAL || '5000');
const DRY_RUN = process.env.DRY_RUN === 'true';

let isRunning = true;
let currentTask = null;

/**
 * Fetch pending tasks from the backend
 */
async function fetchPendingTasks() {
  try {
    const response = await fetch(`${BACKEND_URL}/local-tasks?status=pending`);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    return await response.json();
  } catch (error) {
    console.error('[Local Executor] Failed to fetch tasks:', error.message);
    return [];
  }
}

/**
 * Submit task result to the backend
 */
async function submitTaskResult(taskId, result, logs, success) {
  try {
    const response = await fetch(`${BACKEND_URL}/local-tasks/${taskId}/result`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ result, logs, success })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.error('[Local Executor] Failed to submit result:', error.message);
    throw error;
  }
}

/**
 * Execute a local task
 *
 * This is a placeholder that outputs the task instructions.
 * In a real implementation, this would:
 * 1. Parse the instructions
 * 2. Execute the appropriate actions (file operations, browser automation, etc.)
 * 3. Return the results
 *
 * For now, this is designed to be used with Claude Code interactively.
 */
async function executeTask(task) {
  console.log('\n' + '='.repeat(80));
  console.log('[Local Executor] NEW TASK RECEIVED');
  console.log('='.repeat(80));
  console.log(`Task ID:    ${task.id}`);
  console.log(`Job ID:     ${task.job_id}`);
  console.log(`Step ID:    ${task.step_id}`);
  console.log(`Created:    ${task.created_at}`);
  console.log('-'.repeat(80));
  console.log('INSTRUCTIONS:');
  console.log('-'.repeat(80));
  console.log(task.instructions);
  console.log('-'.repeat(80));

  if (DRY_RUN) {
    console.log('[DRY RUN] Would execute task but DRY_RUN is enabled');
    return {
      success: true,
      result: { status: 'dry_run', message: 'Task would be executed' },
      logs: 'Dry run mode - no execution'
    };
  }

  // Interactive mode: Wait for manual execution
  // In production, this would be automated based on instruction type
  console.log('\n[Local Executor] Waiting for manual execution...');
  console.log('[Local Executor] This task requires Claude Code to execute the instructions above.');
  console.log('[Local Executor] Press Ctrl+C to skip this task and mark as failed.\n');

  // For now, return a placeholder - real implementation would parse and execute
  return new Promise((resolve) => {
    // Set a timeout for manual tasks (30 minutes)
    const timeout = setTimeout(() => {
      console.log('[Local Executor] Task timed out after 30 minutes');
      resolve({
        success: false,
        result: { status: 'timeout', message: 'Task timed out waiting for manual execution' },
        logs: 'Task timed out'
      });
    }, 30 * 60 * 1000);

    // Allow interrupt to skip task
    const handler = () => {
      clearTimeout(timeout);
      process.removeListener('SIGINT', handler);
      console.log('\n[Local Executor] Task skipped by user');
      resolve({
        success: false,
        result: { status: 'skipped', message: 'Task skipped by user' },
        logs: 'User interrupted task'
      });
    };

    process.once('SIGINT', handler);

    // In interactive mode, Claude Code would execute and call completeCurrentTask()
    // For automated mode, parse instructions and execute here
  });
}

/**
 * Complete the current task with a result
 * Called by Claude Code when it finishes executing a task
 */
function completeCurrentTask(success, result, logs = '') {
  if (!currentTask) {
    console.log('[Local Executor] No current task to complete');
    return;
  }

  const taskId = currentTask.id;
  currentTask = null;

  return submitTaskResult(taskId, result, logs, success)
    .then(() => {
      console.log(`[Local Executor] Task ${taskId} completed with success: ${success}`);
    })
    .catch((error) => {
      console.error(`[Local Executor] Failed to submit result for task ${taskId}:`, error.message);
    });
}

/**
 * Main polling loop
 */
async function pollLoop() {
  console.log('[Local Executor] Starting polling loop...');
  console.log(`[Local Executor] Backend URL: ${BACKEND_URL}`);
  console.log(`[Local Executor] Poll interval: ${POLL_INTERVAL}ms`);
  console.log(`[Local Executor] Dry run: ${DRY_RUN}`);
  console.log('');

  while (isRunning) {
    try {
      // Skip polling if we're currently executing a task
      if (currentTask) {
        await sleep(POLL_INTERVAL);
        continue;
      }

      const tasks = await fetchPendingTasks();

      if (tasks.length > 0) {
        console.log(`[Local Executor] Found ${tasks.length} pending task(s)`);

        // Process one task at a time
        const task = tasks[0];
        currentTask = task;

        try {
          const result = await executeTask(task);
          await submitTaskResult(task.id, result.result, result.logs, result.success);
          console.log(`[Local Executor] Task ${task.id} completed`);
        } catch (error) {
          console.error(`[Local Executor] Task ${task.id} failed:`, error.message);
          await submitTaskResult(
            task.id,
            { error: error.message },
            error.stack || '',
            false
          );
        } finally {
          currentTask = null;
        }
      } else {
        // No tasks, just log a dot to show we're alive
        process.stdout.write('.');
      }
    } catch (error) {
      console.error('[Local Executor] Poll loop error:', error.message);
    }

    await sleep(POLL_INTERVAL);
  }
}

/**
 * Sleep helper
 */
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Graceful shutdown
 */
function shutdown() {
  console.log('\n[Local Executor] Shutting down...');
  isRunning = false;

  if (currentTask) {
    console.log(`[Local Executor] Note: Task ${currentTask.id} was in progress`);
  }

  process.exit(0);
}

// Handle signals
process.on('SIGTERM', shutdown);

// Only handle SIGINT if not in task execution mode
let sigintCount = 0;
process.on('SIGINT', () => {
  sigintCount++;
  if (sigintCount >= 2 || !currentTask) {
    shutdown();
  }
});

// Export for use in Claude Code
module.exports = {
  fetchPendingTasks,
  submitTaskResult,
  completeCurrentTask,
  getCurrentTask: () => currentTask
};

// Start polling if run directly
if (require.main === module) {
  console.log('');
  console.log('╔══════════════════════════════════════════════════════════════════╗');
  console.log('║           AI Orchestrator - Local Executor                       ║');
  console.log('╠══════════════════════════════════════════════════════════════════╣');
  console.log('║  This script polls for tasks that need local execution.          ║');
  console.log('║  When a task arrives, Claude Code should execute the             ║');
  console.log('║  instructions and report the result.                             ║');
  console.log('║                                                                   ║');
  console.log('║  Press Ctrl+C twice to exit.                                     ║');
  console.log('╚══════════════════════════════════════════════════════════════════╝');
  console.log('');

  pollLoop().catch(console.error);
}
