/**
 * API Route: /api/jobs/[id]/logs
 * Handles GET (get job logs)
 *
 * Note: Logs are only available with PostgreSQL backend.
 * This returns an empty array for Vercel KV deployments.
 */

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

  // Logs are not implemented in Vercel KV storage
  // Return empty array to prevent 404 errors
  return res.status(200).json([]);
}
