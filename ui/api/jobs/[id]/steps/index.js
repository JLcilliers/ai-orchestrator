/**
 * API Route: /api/jobs/[id]/steps
 * Handles GET (list steps) and POST (create steps)
 */

import { getJobById, getStepsForJob, createStepsForJob } from '../../../db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  try {
    // Verify job exists
    const job = await getJobById(id);
    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (req.method === 'GET') {
      const steps = await getStepsForJob(id);
      return res.status(200).json(steps);
    }

    if (req.method === 'POST') {
      const { steps } = req.body;

      if (!steps || !Array.isArray(steps) || steps.length === 0) {
        return res.status(400).json({ error: 'Steps array is required' });
      }

      const createdSteps = await createStepsForJob(id, steps);
      console.log(`Created ${createdSteps.length} steps for job ${id}`);

      return res.status(201).json(createdSteps);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in /api/jobs/[id]/steps:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
