/**
 * API Route: /api/local-tasks
 * Handles GET (list pending tasks) and POST (create task)
 */

import { getPendingLocalTasks, createLocalTask } from '../db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  try {
    if (req.method === 'GET') {
      const tasks = await getPendingLocalTasks();
      return res.status(200).json(tasks);
    }

    if (req.method === 'POST') {
      const { jobId, stepId, instructions } = req.body;

      if (!jobId || !stepId || !instructions) {
        return res.status(400).json({
          error: 'jobId, stepId, and instructions are required'
        });
      }

      const task = await createLocalTask(jobId, stepId, instructions);
      console.log(`Created local task ${task.id} for step ${stepId}`);

      return res.status(201).json(task);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in /api/local-tasks:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
