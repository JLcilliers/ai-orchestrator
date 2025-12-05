import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { createJob } from '../hooks/useApi';

function CreateJob() {
  const navigate = useNavigate();
  const [goal, setGoal] = useState('');
  const [riskLevel, setRiskLevel] = useState('low');
  const [requireApproval, setRequireApproval] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!goal.trim()) {
      setError('Please enter a goal');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const job = await createJob(goal, { riskLevel, requireApproval });
      navigate(`/jobs/${job.id}`);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <h2 className="page-title">Create New Job</h2>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="goal">
              What do you want to accomplish?
            </label>
            <textarea
              id="goal"
              className="form-textarea"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              placeholder="Example: Create a landing page with a contact form that sends emails to support@example.com. Include responsive design and basic SEO optimization."
              rows={5}
              disabled={loading}
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="riskLevel">
              Risk Level
            </label>
            <select
              id="riskLevel"
              className="form-select"
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
              disabled={loading}
            >
              <option value="low">Low - Read-only analysis, no external changes</option>
              <option value="medium">Medium - Local file changes, dev environment only</option>
              <option value="high">High - May affect production systems</option>
            </select>
          </div>

          <div className="form-group">
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
                cursor: 'pointer'
              }}
            >
              <input
                type="checkbox"
                checked={requireApproval}
                onChange={(e) => setRequireApproval(e.target.checked)}
                disabled={loading}
              />
              <span>Require my approval before deployment steps</span>
            </label>
          </div>

          {error && (
            <div
              style={{
                color: 'var(--color-error)',
                marginBottom: '1rem',
                padding: '0.75rem',
                background: 'rgba(239, 68, 68, 0.1)',
                borderRadius: 'var(--radius-sm)'
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.75rem' }}>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={loading}
            >
              {loading ? 'Creating...' : 'Create Job'}
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => navigate('/')}
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>

      <div className="card" style={{ marginTop: '2rem' }}>
        <h3 className="card-title" style={{ marginBottom: '1rem' }}>
          Tips for better results
        </h3>
        <ul style={{ color: 'var(--color-text-muted)', paddingLeft: '1.25rem' }}>
          <li>Be specific about what you want to achieve</li>
          <li>Include any constraints or requirements</li>
          <li>Mention the technologies or frameworks to use</li>
          <li>Specify what "done" looks like</li>
        </ul>
      </div>
    </div>
  );
}

export default CreateJob;
