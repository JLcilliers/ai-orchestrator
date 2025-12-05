# AI Orchestrator Deployment Guide

This guide covers deploying the AI Orchestrator to production using Railway, Render, or Vercel.

## Architecture Overview

The system consists of three main components:

1. **Frontend (Vercel)** - React UI deployed on Vercel with serverless API routes
2. **n8n Workflow Engine** - Self-hosted n8n instance (Railway/Render)
3. **Backend API** - Express.js API with PostgreSQL (Railway/Render/Vercel Serverless)

## Option 1: Vercel (Recommended for Frontend)

The frontend is already configured for Vercel deployment.

### Deploy UI to Vercel

1. Push to GitHub
2. Import project in Vercel dashboard
3. Set root directory to `ui`
4. Configure environment variables:
   ```
   VITE_API_URL=https://your-backend.railway.app
   ```

The UI includes serverless API routes in `/api` that can serve as a lightweight backend.

### Environment Variables (Vercel)

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (optional) |
| `OPENAI_API_KEY` | OpenAI API key for planner |
| `ANTHROPIC_API_KEY` | Anthropic API key for executor |
| `N8N_WEBHOOK_URL` | n8n webhook URL |

## Option 2: Railway (Recommended for Backend)

Railway provides easy deployment with built-in PostgreSQL.

### Quick Deploy

1. Click "New Project" in Railway dashboard
2. Select "Deploy from GitHub repo"
3. Choose the ai-orchestrator repository
4. Railway will detect the `railway.json` config

### Services to Deploy

**Backend API:**
- Root directory: `/`
- Start command: `node backend/server.js`
- Add PostgreSQL plugin for database

**n8n Workflow Engine:**
- Use Docker image: `n8nio/n8n:latest`
- Or deploy from `/infra/Dockerfile.n8n`

### Environment Variables (Railway)

```bash
# Backend
NODE_ENV=production
DATABASE_URL=${{Postgres.DATABASE_URL}}
PORT=3001
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
N8N_WEBHOOK_URL=https://your-n8n.railway.app/webhook/...

# n8n
N8N_BASIC_AUTH_ACTIVE=true
N8N_BASIC_AUTH_USER=admin
N8N_BASIC_AUTH_PASSWORD=secure-password
N8N_ENCRYPTION_KEY=random-32-char-string
DB_TYPE=postgresdb
DB_POSTGRESDB_HOST=${{Postgres.PGHOST}}
DB_POSTGRESDB_PORT=${{Postgres.PGPORT}}
DB_POSTGRESDB_DATABASE=${{Postgres.PGDATABASE}}
DB_POSTGRESDB_USER=${{Postgres.PGUSER}}
DB_POSTGRESDB_PASSWORD=${{Postgres.PGPASSWORD}}
```

## Option 3: Render (Full Blueprint)

Render supports deploying multiple services with a single `render.yaml` file.

### Deploy with Blueprint

1. Push to GitHub
2. Go to Render dashboard → Blueprints
3. Click "New Blueprint Instance"
4. Select your repository
5. Render will read `render.yaml` and create all services

### Manual Configuration

If not using the blueprint, create services manually:

1. **PostgreSQL Database**
   - Create a new PostgreSQL database
   - Note the connection string

2. **Backend API**
   - Type: Web Service
   - Runtime: Node
   - Build: `npm install`
   - Start: `node backend/server.js`

3. **n8n Service**
   - Type: Web Service
   - Runtime: Docker
   - Dockerfile: `infra/Dockerfile.n8n`

## Database Setup

### PostgreSQL Schema

Run the initialization script on your database:

```bash
psql $DATABASE_URL < infra/init-db.sql
```

Or the schema will be auto-created if using the PostgreSQL module.

### Tables

- `jobs` - Main job records
- `steps` - Execution steps for each job
- `local_executor_tasks` - Tasks for Claude Code
- `logs` - Execution logs

## n8n Workflow Setup

After deploying n8n:

1. Access n8n at your deployed URL
2. Import the workflow from `infra/n8n-workflows/orchestrator.json`
3. Configure credentials:
   - OpenAI API (for ChatGPT planner)
   - HTTP Request (for backend callbacks)
4. Activate the workflow

### Webhook URLs

After activating, get your webhook URLs:
- Start job: `https://your-n8n.domain/webhook/start-job`
- Step callback: `https://your-n8n.domain/webhook/step-complete`

Update your backend's `N8N_WEBHOOK_URL` environment variable.

## Connecting Components

### 1. Frontend → Backend

Update `VITE_API_URL` in Vercel to point to your backend:
```
VITE_API_URL=https://ai-orchestrator-backend.railway.app
```

### 2. Backend → n8n

Set the n8n webhook URL in backend environment:
```
N8N_WEBHOOK_URL=https://your-n8n.domain/webhook/start-job
```

### 3. n8n → Backend

Configure HTTP Request nodes in n8n to call:
```
Backend URL: https://ai-orchestrator-backend.railway.app
```

### 4. Local Executor → Backend

Run the local executor with:
```bash
BACKEND_URL=https://ai-orchestrator-backend.railway.app npm run local-executor
```

## Security Considerations

### API Keys
- Never commit API keys to git
- Use environment variables
- Rotate keys periodically

### n8n Security
- Enable basic auth: `N8N_BASIC_AUTH_ACTIVE=true`
- Use strong passwords
- Set up execution limits

### CORS
The backend allows CORS from any origin by default. In production:
```javascript
// Restrict to specific origins
const allowedOrigins = [
  'https://your-frontend.vercel.app',
  'https://your-n8n.domain'
];
```

### Rate Limiting
Consider adding rate limiting for production:
```javascript
const rateLimit = require('express-rate-limit');
app.use(rateLimit({ windowMs: 15 * 60 * 1000, max: 100 }));
```

## Monitoring

### Health Checks

All services expose health endpoints:
- Backend: `GET /health`
- n8n: `GET /healthz`

### Logs

- Railway: View logs in dashboard
- Render: View logs in service dashboard
- Vercel: Function logs in dashboard

## Troubleshooting

### Common Issues

**Database connection fails:**
- Check DATABASE_URL format
- Ensure SSL is configured for production
- Verify network access rules

**n8n workflows not triggering:**
- Check webhook URL is correct
- Verify workflow is activated
- Check n8n logs for errors

**CORS errors:**
- Verify allowed origins in backend
- Check if preflight requests are handled

**Local executor can't connect:**
- Check BACKEND_URL is accessible
- Verify network/firewall settings
- Check for HTTPS certificate issues

## Scaling

### Horizontal Scaling

- Backend: Stateless, can run multiple instances
- n8n: Single instance recommended (uses DB for state)
- PostgreSQL: Consider read replicas for heavy load

### Performance Tips

1. Use connection pooling for database
2. Enable response caching for static data
3. Use CDN for frontend assets
4. Monitor and optimize slow queries
