#!/usr/bin/env node
/**
 * UI Smoke Test Script
 *
 * Uses Playwright MCP (if available) or provides instructions
 * for manual testing of the UI.
 *
 * Tests:
 * 1. UI loads at localhost:3000
 * 2. Job creation form works
 * 3. Job list displays correctly
 */

const UI_URL = process.env.UI_URL || 'http://localhost:3000';
const BACKEND_URL = process.env.BACKEND_URL || 'http://localhost:3001';

async function checkServicesRunning() {
  console.log('Checking services...\n');

  // Check backend
  try {
    const res = await fetch(`${BACKEND_URL}/health`);
    if (res.ok) {
      console.log(`✓ Backend running at ${BACKEND_URL}`);
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch {
    console.log(`✗ Backend NOT running at ${BACKEND_URL}`);
    console.log('  Run: npm run backend\n');
    return false;
  }

  // Check UI
  try {
    const res = await fetch(UI_URL);
    if (res.ok) {
      console.log(`✓ UI running at ${UI_URL}`);
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch {
    console.log(`✗ UI NOT running at ${UI_URL}`);
    console.log('  Run: cd ui && npm run dev\n');
    return false;
  }

  console.log('');
  return true;
}

async function runSmokeTests() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║  AI Orchestrator UI Smoke Tests                       ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');

  const servicesOk = await checkServicesRunning();

  if (!servicesOk) {
    console.log('Please start all services before running smoke tests.');
    console.log('');
    console.log('Quick start:');
    console.log('  Terminal 1: npm run backend');
    console.log('  Terminal 2: cd ui && npm run dev');
    console.log('');
    process.exit(1);
  }

  console.log('Manual smoke test checklist:');
  console.log('══════════════════════════════════════════════════════\n');

  console.log('1. Open UI');
  console.log(`   Open ${UI_URL} in your browser\n`);

  console.log('2. Verify Health Panel');
  console.log('   [ ] Backend shows green dot');
  console.log('   [ ] Database shows green dot');
  console.log('   [ ] n8n shows red dot (expected if not running)\n');

  console.log('3. Test Job Creation');
  console.log('   [ ] Click "New Job" button');
  console.log('   [ ] Enter goal: "Create a simple test page"');
  console.log('   [ ] Select risk level: Low');
  console.log('   [ ] Check "Require approval" box');
  console.log('   [ ] Click "Create Job"');
  console.log('   [ ] Verify redirect to job detail page\n');

  console.log('4. Test Job List');
  console.log('   [ ] Click "Jobs" in navigation');
  console.log('   [ ] Verify new job appears in list');
  console.log('   [ ] Verify status badge shows "planning"\n');

  console.log('5. Test Job Detail');
  console.log('   [ ] Click on the job in the list');
  console.log('   [ ] Verify goal is displayed');
  console.log('   [ ] Verify status and metadata shown');
  console.log('   [ ] Verify steps section exists\n');

  console.log('══════════════════════════════════════════════════════\n');

  console.log('For automated testing with Playwright, run:');
  console.log('  npx playwright test');
  console.log('');
  console.log('Or use Claude Code with Playwright MCP:');
  console.log('  "Open http://localhost:3000 and take a screenshot"');
  console.log('');
}

runSmokeTests().catch(console.error);
