/**
 * API Route: /api/jobs
 * Handles GET (list jobs) and POST (create job)
 */

import { getAllJobs, createJob } from '../db.js';

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
      // List all jobs
      const jobs = await getAllJobs();
      return res.status(200).json(jobs);
    }

    if (req.method === 'POST') {
      // Create new job
      const { goal, riskLevel, requireApproval } = req.body;

      if (!goal || !goal.trim()) {
        return res.status(400).json({ error: 'Goal is required' });
      }

      const job = await createJob(goal.trim(), {
        riskLevel: riskLevel || 'low',
        requireApproval: requireApproval !== false
      });

      console.log(`Created job ${job.id}: ${goal.substring(0, 50)}...`);
      return res.status(201).json(job);
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Error in /api/jobs:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
