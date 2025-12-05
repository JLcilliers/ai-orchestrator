#!/usr/bin/env node
/**
 * Integration Test Script
 *
 * Tests the core flow:
 * 1. Create a job
 * 2. Verify steps are created
 * 3. Check status updates
 */

const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function runTests() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  AI Orchestrator Integration Tests                    ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  let passed = 0;
  let failed = 0;

  // Test 1: Health check
  console.log('Test 1: Backend Health Check');
  try {
    const healthRes = await fetch(`${BACKEND_URL}/health`);
    const health = await healthRes.json();

    if (health.status === 'ok' && health.services.backend) {
      console.log('  ✓ Backend is healthy\n');
      passed++;
    } else {
      throw new Error('Backend reports unhealthy status');
    }
  } catch (error) {
    console.log(`  ✗ Failed: ${error.message}\n`);
    failed++;
  }

  // Test 2: Create job
  console.log('Test 2: Create Job');
  let jobId;
  try {
    const createRes = await fetch(`${BACKEND_URL}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        goal: 'Create a simple HTML landing page with a contact form',
        riskLevel: 'low',
        requireApproval: true
      })
    });

    if (!createRes.ok) {
      throw new Error(`HTTP ${createRes.status}`);
    }

    const job = await createRes.json();
    jobId = job.id;

    if (job.id && job.status === 'planning') {
      console.log(`  ✓ Job created: ${job.id}\n`);
      passed++;
    } else {
      throw new Error('Job missing required fields');
    }
  } catch (error) {
    console.log(`  ✗ Failed: ${error.message}\n`);
    failed++;
  }

  // Test 3: List jobs
  console.log('Test 3: List Jobs');
  try {
    const listRes = await fetch(`${BACKEND_URL}/jobs`);
    const jobs = await listRes.json();

    if (Array.isArray(jobs) && jobs.length > 0) {
      console.log(`  ✓ Found ${jobs.length} job(s)\n`);
      passed++;
    } else {
      throw new Error('No jobs found');
    }
  } catch (error) {
    console.log(`  ✗ Failed: ${error.message}\n`);
    failed++;
  }

  // Test 4: Get job details
  console.log('Test 4: Get Job Details');
  if (jobId) {
    try {
      const detailRes = await fetch(`${BACKEND_URL}/jobs/${jobId}`);
      const job = await detailRes.json();

      if (job.id === jobId && job.goal) {
        console.log(`  ✓ Retrieved job details\n`);
        passed++;
      } else {
        throw new Error('Job details incomplete');
      }
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}\n`);
      failed++;
    }
  } else {
    console.log('  ⊘ Skipped (no job ID)\n');
  }

  // Test 5: Create steps for job
  console.log('Test 5: Create Steps');
  if (jobId) {
    try {
      const stepsRes = await fetch(`${BACKEND_URL}/jobs/${jobId}/steps`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          steps: [
            { role: 'executor', description: 'Create HTML structure' },
            { role: 'executor', description: 'Add contact form' },
            { role: 'executor', description: 'Add basic styling' }
          ]
        })
      });

      const steps = await stepsRes.json();

      if (Array.isArray(steps) && steps.length === 3) {
        console.log(`  ✓ Created ${steps.length} steps\n`);
        passed++;
      } else {
        throw new Error('Steps not created correctly');
      }
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}\n`);
      failed++;
    }
  } else {
    console.log('  ⊘ Skipped (no job ID)\n');
  }

  // Test 6: Get next pending step
  console.log('Test 6: Get Next Pending Step');
  if (jobId) {
    try {
      const nextRes = await fetch(`${BACKEND_URL}/jobs/${jobId}/steps/next`);
      const step = await nextRes.json();

      if (step.id && step.status === 'pending') {
        console.log(`  ✓ Found next pending step: ${step.description.substring(0, 30)}...\n`);
        passed++;
      } else {
        throw new Error('Next step not found or not pending');
      }
    } catch (error) {
      console.log(`  ✗ Failed: ${error.message}\n`);
      failed++;
    }
  } else {
    console.log('  ⊘ Skipped (no job ID)\n');
  }

  // Test 7: Local tasks endpoint
  console.log('Test 7: Local Tasks Endpoint');
  try {
    const tasksRes = await fetch(`${BACKEND_URL}/local-tasks?status=pending`);
    const tasks = await tasksRes.json();

    if (Array.isArray(tasks)) {
      console.log(`  ✓ Local tasks endpoint working (${tasks.length} pending)\n`);
      passed++;
    } else {
      throw new Error('Invalid response format');
    }
  } catch (error) {
    console.log(`  ✗ Failed: ${error.message}\n`);
    failed++;
  }

  // Summary
  console.log('═══════════════════════════════════════════════════════');
  console.log(`Results: ${passed} passed, ${failed} failed`);
  console.log('═══════════════════════════════════════════════════════\n');

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch(error => {
  console.error('Test runner error:', error);
  process.exit(1);
});
