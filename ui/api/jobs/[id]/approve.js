/**
 * API Route: /api/jobs/[id]/approve
 * Handles POST (approve job for execution)
 */

import { getJobById, updateJobStatus } from '../../db.js';

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

  try {
    const job = await getJobById(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'waiting_approval') {
      return res.status(400).json({
        error: `Cannot approve job in status: ${job.status}`
      });
    }

    const updatedJob = await updateJobStatus(id, 'running');
    console.log(`Approved job ${id} - now running`);

    return res.status(200).json(updatedJob);
  } catch (error) {
    console.error('Error in /api/jobs/[id]/approve:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
