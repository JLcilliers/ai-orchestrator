/**
 * API Route: /api/jobs/[id]/steps/next
 * Handles GET (get next pending step)
 */

import { getJobById, getNextPendingStep } from '../../../db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;

  try {
    // Verify job exists
    const job = await getJobById(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    const nextStep = await getNextPendingStep(id);

    if (!nextStep) {
      return res.status(200).json({
        message: 'No pending steps',
        step: null
      });
    }

    return res.status(200).json(nextStep);
  } catch (error) {
    console.error('Error in /api/jobs/[id]/steps/next:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
