import { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useJob, useJobLogs, approveJob, requestChanges, rejectJob } from '../hooks/useApi';

function StatusBadge({ status }) {
  return <span className={`badge badge-${status}`}>{status.replace('_', ' ')}</span>;
}

function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function StepItem({ step, index }) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="step-item">
      <div className="step-index">{index + 1}</div>
      <div className="step-content">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            marginBottom: '0.5rem'
          }}
        >
          <p className="step-description">{step.description}</p>
          <StatusBadge status={step.status} />
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>
          Role: {step.role} | Attempts: {step.fix_attempts}
        </div>
        {step.logs && (
          <>
            <button
              className="btn btn-secondary"
              style={{ marginTop: '0.75rem', padding: '0.375rem 0.75rem' }}
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? 'Hide Logs' : 'Show Logs'}
            </button>
            {expanded && (
              <pre className="step-logs" style={{ marginTop: '0.5rem' }}>
                {typeof step.logs === 'string'
                  ? step.logs
                  : JSON.stringify(step.logs, null, 2)}
              </pre>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function LogsViewer({ jobId }) {
  const { data: logs, loading, error } = useJobLogs(jobId);
  const [expanded, setExpanded] = useState(false);

  if (loading) {
    return <div style={{ color: 'var(--color-text-muted)' }}>Loading logs...</div>;
  }

  if (error) {
    return <div style={{ color: 'var(--color-text-muted)' }}>Unable to load logs</div>;
  }

  if (!logs || logs.length === 0) {
    return <div style={{ color: 'var(--color-text-muted)' }}>No logs yet</div>;
  }

  const displayLogs = expanded ? logs : logs.slice(-10);

  return (
    <div>
      {logs.length > 10 && (
        <button
          className="btn btn-secondary"
          style={{ marginBottom: '0.75rem', padding: '0.375rem 0.75rem' }}
          onClick={() => setExpanded(!expanded)}
        >
          {expanded ? `Show Latest 10` : `Show All ${logs.length} Logs`}
        </button>
      )}
      <div className="logs-container" style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {displayLogs.map((log, index) => (
          <div
            key={log.id || index}
            className={`log-entry log-${log.level}`}
            style={{
              padding: '0.5rem',
              borderBottom: '1px solid var(--color-border)',
              fontSize: '0.8rem'
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem' }}>
              <span style={{ fontWeight: 500 }}>
                [{log.level?.toUpperCase()}] {log.source}
              </span>
              <span style={{ color: 'var(--color-text-muted)' }}>
                {new Date(log.created_at).toLocaleTimeString()}
              </span>
            </div>
            <pre style={{ margin: 0, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
              {typeof log.content === 'string' ? log.content : JSON.stringify(log.content, null, 2)}
            </pre>
          </div>
        ))}
      </div>
    </div>
  );
}

function JobDetail() {
  const { jobId } = useParams();
  const { data: job, loading, error, refetch } = useJob(jobId);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState(null);
  const [feedback, setFeedback] = useState('');
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);

  const handleApprove = async () => {
    setActionLoading(true);
    setActionError(null);

    try {
      await approveJob(jobId);
      refetch();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChanges = async () => {
    if (!feedback.trim()) {
      setActionError('Please provide feedback');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      await requestChanges(jobId, feedback);
      setFeedback('');
      refetch();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      setActionError('Please provide a reason for rejection');
      return;
    }

    setActionLoading(true);
    setActionError(null);

    try {
      await rejectJob(jobId, rejectReason);
      setRejectReason('');
      setShowRejectForm(false);
      refetch();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading job...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p style={{ color: 'var(--color-error)' }}>
          Error loading job: {error}
        </p>
        <Link to="/" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Jobs
        </Link>
      </div>
    );
  }

  if (!job) {
    return (
      <div className="card">
        <p>Job not found</p>
        <Link to="/" className="btn btn-secondary" style={{ marginTop: '1rem' }}>
          Back to Jobs
        </Link>
      </div>
    );
  }

  const completedSteps = job.steps?.filter(s => s.status === 'completed').length || 0;
  const totalSteps = job.steps?.length || 0;

  return (
    <div>
      <Link to="/" className="back-link">
        &larr; Back to Jobs
      </Link>

      <div className="card job-detail-header">
        <div className="card-header">
          <span className="card-title">Job {job.id.substring(0, 8)}...</span>
          <StatusBadge status={job.status} />
        </div>

        <div className="job-detail-goal">{job.goal}</div>

        <div className="job-meta">
          <span>Created: {formatDate(job.created_at)}</span>
          <span>Risk: {job.risk_level}</span>
          <span>Progress: {completedSteps}/{totalSteps} steps</span>
        </div>

        {job.status === 'waiting_approval' && (
          <div
            style={{
              marginTop: '1.5rem',
              padding: '1rem',
              background: 'rgba(245, 158, 11, 0.1)',
              borderRadius: 'var(--radius-sm)',
              border: '1px solid rgba(245, 158, 11, 0.3)'
            }}
          >
            <h4 style={{ marginBottom: '0.75rem' }}>Action Required</h4>
            <p style={{ marginBottom: '1rem', color: 'var(--color-text-muted)' }}>
              This job is waiting for your approval to continue.
            </p>

            <div className="form-group" style={{ marginBottom: '0.75rem' }}>
              <textarea
                className="form-textarea"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Optional: Add feedback if requesting changes..."
                rows={2}
                disabled={actionLoading}
              />
            </div>

            {actionError && (
              <p style={{ color: 'var(--color-error)', marginBottom: '0.75rem' }}>
                {actionError}
              </p>
            )}

            <div className="job-actions">
              <button
                className="btn btn-success"
                onClick={handleApprove}
                disabled={actionLoading}
              >
                {actionLoading ? 'Processing...' : 'Approve & Continue'}
              </button>
              <button
                className="btn btn-secondary"
                onClick={handleRequestChanges}
                disabled={actionLoading}
              >
                Request Changes
              </button>
              <button
                className="btn btn-danger"
                onClick={() => setShowRejectForm(!showRejectForm)}
                disabled={actionLoading}
                style={{ background: 'var(--color-error)' }}
              >
                Reject Job
              </button>
            </div>

            {showRejectForm && (
              <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(239, 68, 68, 0.1)', borderRadius: 'var(--radius-sm)' }}>
                <div className="form-group" style={{ marginBottom: '0.75rem' }}>
                  <textarea
                    className="form-textarea"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Please provide a reason for rejection..."
                    rows={2}
                    disabled={actionLoading}
                  />
                </div>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button
                    className="btn"
                    onClick={handleReject}
                    disabled={actionLoading}
                    style={{ background: 'var(--color-error)' }}
                  >
                    Confirm Rejection
                  </button>
                  <button
                    className="btn btn-secondary"
                    onClick={() => { setShowRejectForm(false); setRejectReason(''); }}
                    disabled={actionLoading}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Steps ({completedSteps}/{totalSteps})</h3>

        {!job.steps || job.steps.length === 0 ? (
          <div className="card">
            <p style={{ color: 'var(--color-text-muted)' }}>
              {job.status === 'planning'
                ? 'Planning steps... This may take a moment.'
                : 'No steps generated yet.'}
            </p>
          </div>
        ) : (
          <div className="steps-list">
            {job.steps.map((step, index) => (
              <StepItem key={step.id} step={step} index={index} />
            ))}
          </div>
        )}
      </div>

      <div className="section">
        <h3 className="section-title">Execution Logs</h3>
        <div className="card">
          <LogsViewer jobId={jobId} />
        </div>
      </div>
    </div>
  );
}

export default JobDetail;
