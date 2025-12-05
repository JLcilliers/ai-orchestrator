/**
 * Database Factory
 * Automatically selects JSON file database or PostgreSQL based on environment
 *
 * Usage:
 *   const db = require('./database-factory');
 *   await db.initDatabase();
 *   const job = await db.createJob('My goal');
 */

const USE_POSTGRES = !!process.env.DATABASE_URL;

let dbModule;

if (USE_POSTGRES) {
  console.log('[DB Factory] Using PostgreSQL database');
  dbModule = require('./database-pg');
} else {
  console.log('[DB Factory] Using JSON file database (set DATABASE_URL for PostgreSQL)');
  dbModule = require('./database');
}

// Wrap sync functions as async for consistent API
function wrapAsync(fn) {
  return async (...args) => {
    return fn(...args);
  };
}

// The JSON database uses sync functions, PostgreSQL uses async
// Create a unified async interface
const db = {
  // Initialization (both sync and async work)
  initDatabase: USE_POSTGRES ? dbModule.initDatabase : wrapAsync(dbModule.initDatabase),
  closeDatabase: USE_POSTGRES ? dbModule.closeDatabase : wrapAsync(dbModule.closeDatabase),

  // Health check
  healthCheck: USE_POSTGRES
    ? dbModule.healthCheck
    : async () => true, // JSON file is always "healthy"

  // Jobs - wrap JSON sync functions to async
  createJob: USE_POSTGRES ? dbModule.createJob : wrapAsync(dbModule.createJob),
  getJobById: USE_POSTGRES ? dbModule.getJobById : wrapAsync(dbModule.getJobById),
  getAllJobs: USE_POSTGRES ? dbModule.getAllJobs : wrapAsync(dbModule.getAllJobs),
  updateJobStatus: USE_POSTGRES ? dbModule.updateJobStatus : wrapAsync(dbModule.updateJobStatus),

  // Steps
  createStep: USE_POSTGRES ? dbModule.createStep : wrapAsync(dbModule.createStep),
  createStepsForJob: USE_POSTGRES ? dbModule.createStepsForJob : wrapAsync(dbModule.createStepsForJob),
  getStepById: USE_POSTGRES ? dbModule.getStepById : wrapAsync(dbModule.getStepById),
  getStepsForJob: USE_POSTGRES ? dbModule.getStepsForJob : wrapAsync(dbModule.getStepsForJob),
  getNextPendingStep: USE_POSTGRES ? dbModule.getNextPendingStep : wrapAsync(dbModule.getNextPendingStep),
  updateStepStatus: USE_POSTGRES ? dbModule.updateStepStatus : wrapAsync(dbModule.updateStepStatus),
  incrementStepFixAttempts: USE_POSTGRES ? dbModule.incrementStepFixAttempts : wrapAsync(dbModule.incrementStepFixAttempts),

  // Local tasks
  createLocalTask: USE_POSTGRES ? dbModule.createLocalTask : wrapAsync(dbModule.createLocalTask),
  getLocalTaskById: USE_POSTGRES ? dbModule.getLocalTaskById : wrapAsync(dbModule.getLocalTaskById),
  getPendingLocalTasks: USE_POSTGRES ? dbModule.getPendingLocalTasks : wrapAsync(dbModule.getPendingLocalTasks),
  updateLocalTaskResult: USE_POSTGRES ? dbModule.updateLocalTaskResult : wrapAsync(dbModule.updateLocalTaskResult),

  // Logs (only available in PostgreSQL, stub for JSON)
  createLog: USE_POSTGRES
    ? dbModule.createLog
    : async (jobId, stepId, source, level, content) => {
        console.log(`[LOG ${level}] Job:${jobId} Step:${stepId} Source:${source}:`, content);
        return { id: 'log-stub', jobId, stepId, source, level, content };
      },
  getLogsForJob: USE_POSTGRES
    ? dbModule.getLogsForJob
    : async () => [],
  getLogsForStep: USE_POSTGRES
    ? dbModule.getLogsForStep
    : async () => [],

  // Metadata
  isPostgres: USE_POSTGRES,
  dbType: USE_POSTGRES ? 'postgresql' : 'json-file'
};

module.exports = db;
