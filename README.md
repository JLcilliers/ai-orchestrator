# AI Orchestrator

An n8n-based automation system that uses ChatGPT (Planner/Reviewer) and Claude (Executor) to accomplish complex tasks through an orchestrated workflow.

## What it does

1. You describe a goal in the UI
2. ChatGPT (Planner) breaks it into actionable steps
3. Claude (Executor) performs each step
4. ChatGPT (Reviewer) validates the work
5. Steps requiring local execution are handed to Claude Code
6. You can approve or request changes at any point

## Quick Start

### 1. Install dependencies

```bash
npm install
cd ui && npm install && cd ..
```

### 2. Install n8n globally (one-time setup)

```bash
npm install -g n8n
```

### 3. Configure environment

```bash
cp .env.local .env
```

Edit `.env` and add your API keys:

- `OPENAI_API_KEY` - Get from https://platform.openai.com/api-keys
- `ANTHROPIC_API_KEY` - Get from https://console.anthropic.com/settings/keys
- `N8N_ENCRYPTION_KEY` - Generate a random 32-character string

### 4. Start the services

**Terminal 1 - Backend:**
```bash
npm run backend
```

**Terminal 2 - n8n:**
```bash
n8n start
```

**Terminal 3 - UI:**
```bash
cd ui && npm run dev
```

### 5. Set up n8n workflow

1. Open n8n at http://localhost:5678
2. Create an account when prompted
3. Go to Workflows > Import from File
4. Import `config/n8n-workflow-main.json`
5. Configure credentials:
   - OpenAI API credentials
   - Anthropic API credentials
6. Activate the workflow

### 6. Open the UI

Open http://localhost:3000 in your browser.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                         UI (React)                          │
│                    http://localhost:3000                    │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                    Backend (Express)                        │
│                    http://localhost:3001                    │
│  - Job management                                           │
│  - Step tracking                                            │
│  - Local task queue                                         │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                      n8n Orchestrator                       │
│                    http://localhost:5678                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐         │
│  │   Planner   │──│  Executor   │──│  Reviewer   │         │
│  │  (OpenAI)   │  │ (Anthropic) │  │  (OpenAI)   │         │
│  └─────────────┘  └─────────────┘  └─────────────┘         │
└────────────────────────────┬────────────────────────────────┘
                             │
┌────────────────────────────▼────────────────────────────────┐
│                     Claude Code (Local)                     │
│  - File operations                                          │
│  - MCP tools (Playwright, etc.)                             │
│  - Local command execution                                  │
└─────────────────────────────────────────────────────────────┘
```

## Configuration

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | Required |
| `ANTHROPIC_API_KEY` | Anthropic API key | Required |
| `N8N_PORT` | n8n port | 5678 |
| `BACKEND_PORT` | Backend API port | 3001 |
| `UI_PORT` | UI dev server port | 3000 |
| `DEV_ONLY_MODE` | Restrict to safe operations | true |
| `MAX_FIX_RETRIES` | Max retry attempts for fixes | 3 |

### Safety Settings

- **DEV_ONLY_MODE=true**: Prevents production deployments
- **requireApproval**: Jobs wait for your approval before deploying
- **Risk levels**: Low (read-only), Medium (dev changes), High (production)

## Running Tests

```bash
# Integration tests (requires backend running)
npm run test:integration

# UI smoke test checklist
npm run smoke-test
```

## Using with Claude Code

Claude Code can execute local tasks from the orchestrator:

```bash
# Check for pending tasks
node scripts/local-executor.js

# Watch for new tasks continuously
node scripts/local-executor.js --watch
```

When tasks appear, Claude Code can:
1. Read the instructions
2. Perform file operations
3. Run commands
4. Submit results back to the API

## Importing the n8n Workflow

The workflow is in `config/n8n-workflow-main.json`. To import:

1. Open n8n UI
2. Click Workflows > Import from File
3. Select the JSON file
4. Configure the OpenAI and Anthropic credentials
5. Activate the workflow

## Troubleshooting

### Backend won't start
- Check if port 3001 is in use: `netstat -ano | findstr 3001`
- Ensure SQLite can create the database file

### n8n connection errors
- Verify n8n is running on port 5678
- Check n8n credentials are configured
- Ensure workflow is activated

### Steps not progressing
- Check n8n execution logs
- Verify API keys are valid
- Check backend logs for errors

## API Endpoints

### Jobs
- `POST /jobs` - Create new job
- `GET /jobs` - List all jobs
- `GET /jobs/:id` - Get job with steps
- `PATCH /jobs/:id/status` - Update job status
- `POST /jobs/:id/approve` - Approve waiting job

### Steps
- `POST /jobs/:id/steps` - Create steps for job
- `GET /jobs/:id/steps/next` - Get next pending step
- `PATCH /steps/:id` - Update step status

### Local Tasks
- `GET /local-tasks` - Get pending local tasks
- `POST /local-tasks` - Create local task
- `POST /local-tasks/:id/result` - Submit task result

## License

MIT
