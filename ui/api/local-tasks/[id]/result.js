/**
 * API Route: /api/local-tasks/[id]/result
 * Handles POST (submit task result)
 */

import { updateLocalTaskResult } from '../../db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { result, logs, success } = req.body || {};

  try {
    if (typeof success !== 'boolean') {
      return res.status(400).json({ error: 'success (boolean) is required' });
    }

    const task = await updateLocalTaskResult(id, result || '', logs || '', success);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    console.log(`Submitted result for local task ${id}: success=${success}`);
    return res.status(200).json(task);
  } catch (error) {
    console.error('Error in /api/local-tasks/[id]/result:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
