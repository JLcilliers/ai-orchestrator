#!/usr/bin/env node
/**
 * Local Executor Script
 *
 * This script polls the backend for pending local tasks and provides
 * instructions for Claude Code to execute them.
 *
 * Usage:
 *   node scripts/local-executor.js           # One-time check
 *   node scripts/local-executor.js --watch   # Continuous polling
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';
const POLL_INTERVAL = 5000; // 5 seconds

async function fetchPendingTasks() {
  try {
    const response = await fetch(`${BACKEND_URL}/local-tasks?status=pending`);

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    if (error.cause?.code === 'ECONNREFUSED') {
      console.error('Backend not running. Start it with: npm run backend');
      return [];
    }
    throw error;
  }
}

async function submitTaskResult(taskId, result, logs, success) {
  const response = await fetch(`${BACKEND_URL}/local-tasks/${taskId}/result`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ result, logs, success })
  });

  if (!response.ok) {
    throw new Error(`Failed to submit result: ${response.statusText}`);
  }

  return await response.json();
}

function formatTaskForClaude(task) {
  return `
╔══════════════════════════════════════════════════════════════════╗
║  LOCAL EXECUTOR TASK                                             ║
╠══════════════════════════════════════════════════════════════════╣
║  Task ID:  ${task.id}
║  Job ID:   ${task.job_id}
║  Step ID:  ${task.step_id}
║  Created:  ${task.created_at}
╠══════════════════════════════════════════════════════════════════╣
║  INSTRUCTIONS FOR CLAUDE CODE:
╠══════════════════════════════════════════════════════════════════╣

${task.instructions}

╠══════════════════════════════════════════════════════════════════╣
║  When complete, submit results using:
║
║  curl -X POST ${BACKEND_URL}/local-tasks/${task.id}/result \\
║    -H "Content-Type: application/json" \\
║    -d '{"result": {...}, "logs": "...", "success": true}'
╚══════════════════════════════════════════════════════════════════╝
`;
}

async function checkOnce() {
  console.log('Checking for pending local tasks...');

  const tasks = await fetchPendingTasks();

  if (tasks.length === 0) {
    console.log('No pending tasks found.');
    return;
  }

  console.log(`Found ${tasks.length} pending task(s):\n`);

  for (const task of tasks) {
    console.log(formatTaskForClaude(task));
  }
}

async function watchMode() {
  console.log('Starting local executor in watch mode...');
  console.log(`Polling ${BACKEND_URL} every ${POLL_INTERVAL / 1000}s`);
  console.log('Press Ctrl+C to stop.\n');

  const processedTasks = new Set();

  async function poll() {
    try {
      const tasks = await fetchPendingTasks();

      for (const task of tasks) {
        if (!processedTasks.has(task.id)) {
          processedTasks.add(task.id);
          console.log('\n🔔 NEW TASK RECEIVED:\n');
          console.log(formatTaskForClaude(task));
        }
      }
    } catch (error) {
      console.error('Poll error:', error.message);
    }
  }

  // Initial poll
  await poll();

  // Continue polling
  setInterval(poll, POLL_INTERVAL);
}

// Main
const args = process.argv.slice(2);

if (args.includes('--watch') || args.includes('-w')) {
  watchMode();
} else {
  checkOnce().catch(console.error);
}

// Export for programmatic use
module.exports = {
  fetchPendingTasks,
  submitTaskResult,
  formatTaskForClaude
};
