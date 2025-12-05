import { useState, useEffect, useCallback } from 'react';

const API_BASE = '/api';

/**
 * Custom hook for API calls with loading and error states
 */
export function useApi(endpoint, options = {}) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const { pollInterval, enabled = true } = options;

  const fetchData = useCallback(async () => {
    if (!enabled) return;

    try {
      const response = await fetch(`${API_BASE}${endpoint}`);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const json = await response.json();
      setData(json);
      setError(null);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [endpoint, enabled]);

  useEffect(() => {
    fetchData();

    if (pollInterval && enabled) {
      const interval = setInterval(fetchData, pollInterval);
      return () => clearInterval(interval);
    }
  }, [fetchData, pollInterval, enabled]);

  return { data, loading, error, refetch: fetchData };
}

/**
 * Hook for health check endpoint
 */
export function useHealth() {
  return useApi('/health', { pollInterval: 10000 });
}

/**
 * Hook for jobs list
 */
export function useJobs() {
  return useApi('/jobs', { pollInterval: 3000 });
}

/**
 * Hook for single job details
 */
export function useJob(jobId) {
  return useApi(`/jobs/${jobId}`, {
    pollInterval: 2000,
    enabled: Boolean(jobId)
  });
}

/**
 * Create a new job
 */
export async function createJob(goal, options = {}) {
  const response = await fetch(`${API_BASE}/jobs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      goal,
      riskLevel: options.riskLevel || 'low',
      requireApproval: options.requireApproval !== false
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to create job');
  }

  return response.json();
}

/**
 * Approve a job
 */
export async function approveJob(jobId) {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' }
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to approve job');
  }

  return response.json();
}

/**
 * Request changes on a job
 */
export async function requestChanges(jobId, feedback) {
  const response = await fetch(`${API_BASE}/jobs/${jobId}/request-changes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ feedback })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Failed to request changes');
  }

  return response.json();
}
