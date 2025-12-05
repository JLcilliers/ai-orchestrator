/**
 * API Route: /api/health
 * Health check endpoint - returns status compatible with UI expectations
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

  const hasKV = !!(process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN);

  return res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    storage: hasKV ? 'vercel-kv' : 'in-memory',
    version: '1.0.0',
    services: {
      backend: true,
      n8n: false,  // n8n not available in serverless mode
      database: true
    },
    config: {
      devOnlyMode: true  // Serverless mode acts like dev mode
    }
  });
}
