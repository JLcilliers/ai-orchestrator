import { useNavigate } from 'react-router-dom';
import { useJobs } from '../hooks/useApi';

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

function JobsList() {
  const navigate = useNavigate();
  const { data: jobs, loading, error } = useJobs();

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner" />
        Loading jobs...
      </div>
    );
  }

  if (error) {
    return (
      <div className="card">
        <p style={{ color: 'var(--color-error)' }}>
          Error loading jobs: {error}
        </p>
        <p style={{ color: 'var(--color-text-muted)', marginTop: '0.5rem' }}>
          Make sure the backend is running: <code>npm run backend</code>
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Automation Jobs</h2>
        <button
          className="btn btn-primary"
          onClick={() => navigate('/create')}
        >
          + New Job
        </button>
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <h3>No jobs yet</h3>
          <p>Create your first automation job to get started.</p>
          <button
            className="btn btn-primary"
            style={{ marginTop: '1rem' }}
            onClick={() => navigate('/create')}
          >
            Create Job
          </button>
        </div>
      ) : (
        <div className="job-list">
          {jobs.map(job => (
            <div
              key={job.id}
              className="card job-item"
              onClick={() => navigate(`/jobs/${job.id}`)}
            >
              <div className="card-header">
                <span className="card-title">
                  Job {job.id.substring(0, 8)}...
                </span>
                <StatusBadge status={job.status} />
              </div>
              <p className="job-goal">{job.goal}</p>
              <div className="job-meta">
                <span>Created: {formatDate(job.created_at)}</span>
                <span>Risk: {job.risk_level}</span>
                {job.require_approval && <span>Approval required</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default JobsList;
