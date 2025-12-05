/**
 * API Route: /api/jobs/[id]
 * Handles GET (get job) and PATCH (update job status)
 */

import { getJobById, getStepsForJob, updateJobStatus } from '../db.js';

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const { id } = req.query;

  try {
    if (req.method === 'GET') {
      // Get job with steps
      const job = await getJobById(id);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      const steps = await getStepsForJob(id);
      return res.status(200).json({ ...job, steps });
    }

    if (req.method === 'PATCH') {
      // Update job status
      const { status } = req.body;
      const validStatuses = ['planning', 'running', 'waiting_approval', 'completed', 'failed'];

      if (!validStatuses.includes(status)) {
        return res.status(400).json({
          error: `Invalid status. Must be one of: ${validStatuses.join(', ')}`
        });
      }

      const job = await updateJobStatus(id, status);

      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }

      console.log(`Updated job ${job.id} status to: ${status}`);
      return res.status(200).json(job);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in /api/jobs/[id]:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
