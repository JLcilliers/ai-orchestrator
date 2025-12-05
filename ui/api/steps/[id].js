/**
 * API Route: /api/steps/[id]
 * Handles PATCH (update step status)
 */

import { updateStepStatus, incrementStepFixAttempts } from '../db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'PATCH') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  const { status, logs, evidence, incrementFix } = req.body;

  try {
    const validStatuses = ['pending', 'running', 'completed', 'failed', 'needs_fix'];

    if (status && !validStatuses.includes(status)) {
      return res.status(400).json({
        error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
      });
    }

    let step;

    if (incrementFix) {
      step = await incrementStepFixAttempts(id);
    }

    if (status) {
      step = await updateStepStatus(id, status, logs || null, evidence || null);
    }

    if (!step) {
      return res.status(404).json({ error: 'Step not found' });
    }

    console.log(`Updated step ${id}: status=${status || 'unchanged'}`);
    return res.status(200).json(step);
  } catch (error) {
    console.error('Error in /api/steps/[id]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
