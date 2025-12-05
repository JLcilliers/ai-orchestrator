/**
 * API Route: /api/jobs/[id]/request-changes
 * Handles POST (request changes to job plan)
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
  const { feedback } = req.body;

  try {
    const job = await getJobById(id);

    if (!job) {
      return res.status(404).json({ error: 'Job not found' });
    }

    if (job.status !== 'waiting_approval') {
      return res.status(400).json({
        error: `Cannot request changes for job in status: ${job.status}`
      });
    }

    // Update job back to planning status for revision
    const updatedJob = await updateJobStatus(id, 'planning');
    console.log(`Requested changes for job ${id}: ${feedback || 'No feedback provided'}`);

    return res.status(200).json({
      ...updatedJob,
      message: 'Changes requested. Job returned to planning phase.'
    });
  } catch (error) {
    console.error('Error in /api/jobs/[id]/request-changes:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
