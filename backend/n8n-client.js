/**
 * n8n API Client for triggering workflows
 */
const fetch = (...args) => import('node-fetch').then(({ default: fetch }) => fetch(...args));

class N8nClient {
  constructor(config = {}) {
    this.baseUrl = config.baseUrl || process.env.WEBHOOK_URL || 'http://localhost:5678';
    this.authUser = config.authUser || process.env.N8N_BASIC_AUTH_USER;
    this.authPassword = config.authPassword || process.env.N8N_BASIC_AUTH_PASSWORD;
  }

  /**
   * Get authorization headers for n8n API
   */
  getAuthHeaders() {
    const headers = {
      'Content-Type': 'application/json'
    };

    if (this.authUser && this.authPassword) {
      const auth = Buffer.from(`${this.authUser}:${this.authPassword}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    }

    return headers;
  }

  /**
   * Trigger a workflow via webhook
   */
  async triggerWorkflow(webhookPath, data) {
    const url = `${this.baseUrl}/webhook/${webhookPath}`;

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: this.getAuthHeaders(),
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`n8n webhook error: ${response.status} - ${errorText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Failed to trigger n8n workflow:', error.message);
      throw error;
    }
  }

  /**
   * Trigger the main orchestrator workflow
   */
  async startOrchestratorJob(jobId, goal) {
    return this.triggerWorkflow('orchestrator/start', {
      jobId,
      goal,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Submit local execution results back to n8n
   */
  async submitLocalTaskResult(taskId, stepId, result, success) {
    return this.triggerWorkflow('orchestrator/local-result', {
      taskId,
      stepId,
      result,
      success,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Trigger job approval flow
   */
  async approveJob(jobId) {
    return this.triggerWorkflow('orchestrator/approve', {
      jobId,
      action: 'approve',
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Request changes on a job
   */
  async requestChanges(jobId, feedback) {
    return this.triggerWorkflow('orchestrator/approve', {
      jobId,
      action: 'request_changes',
      feedback,
      timestamp: new Date().toISOString()
    });
  }

  /**
   * Check if n8n is reachable
   */
  async healthCheck() {
    try {
      const response = await fetch(`${this.baseUrl}/healthz`, {
        method: 'GET',
        headers: this.getAuthHeaders()
      });
      return response.ok;
    } catch {
      return false;
    }
  }
}

module.exports = N8nClient;
