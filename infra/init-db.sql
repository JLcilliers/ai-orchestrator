-- AI Orchestrator Database Schema
-- This script runs on first database initialization

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Jobs table
CREATE TABLE IF NOT EXISTS jobs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    goal TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'planning',
    risk_level VARCHAR(20) NOT NULL DEFAULT 'low',
    require_approval BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT jobs_status_check CHECK (status IN ('planning', 'running', 'waiting_approval', 'completed', 'failed')),
    CONSTRAINT jobs_risk_level_check CHECK (risk_level IN ('low', 'medium', 'high'))
);

-- Steps table
CREATE TABLE IF NOT EXISTS steps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    step_index INTEGER NOT NULL,
    name VARCHAR(255),
    role VARCHAR(50) NOT NULL DEFAULT 'executor',
    description TEXT,
    claude_instruction TEXT,
    success_criteria TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    last_result_summary TEXT,
    logs JSONB,
    evidence JSONB,
    fix_attempts INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT steps_role_check CHECK (role IN ('planner', 'executor', 'reviewer', 'local_executor')),
    CONSTRAINT steps_status_check CHECK (status IN ('pending', 'running', 'waiting_review', 'waiting_local_execution', 'waiting_approval', 'completed', 'failed'))
);

-- Logs table
CREATE TABLE IF NOT EXISTS logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    step_id UUID REFERENCES steps(id) ON DELETE SET NULL,
    source VARCHAR(50) NOT NULL,
    level VARCHAR(20) NOT NULL DEFAULT 'info',
    content JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT logs_source_check CHECK (source IN ('planner', 'executor', 'reviewer', 'local_executor', 'system', 'user')),
    CONSTRAINT logs_level_check CHECK (level IN ('debug', 'info', 'warn', 'error'))
);

-- Local Executor Tasks table
CREATE TABLE IF NOT EXISTS local_executor_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    step_id UUID REFERENCES steps(id) ON DELETE SET NULL,
    instructions TEXT NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    result_summary TEXT,
    result_data JSONB,
    logs TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

    CONSTRAINT local_tasks_status_check CHECK (status IN ('pending', 'running', 'completed', 'failed'))
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_steps_job_id ON steps(job_id);
CREATE INDEX IF NOT EXISTS idx_steps_status ON steps(status);
CREATE INDEX IF NOT EXISTS idx_logs_job_id ON logs(job_id);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_local_tasks_status ON local_executor_tasks(status);
CREATE INDEX IF NOT EXISTS idx_local_tasks_job_id ON local_executor_tasks(job_id);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
DROP TRIGGER IF EXISTS update_jobs_updated_at ON jobs;
CREATE TRIGGER update_jobs_updated_at
    BEFORE UPDATE ON jobs
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_steps_updated_at ON steps;
CREATE TRIGGER update_steps_updated_at
    BEFORE UPDATE ON steps
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_local_tasks_updated_at ON local_executor_tasks;
CREATE TRIGGER update_local_tasks_updated_at
    BEFORE UPDATE ON local_executor_tasks
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO orchestrator;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO orchestrator;
