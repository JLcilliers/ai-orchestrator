import { Routes, Route, Link, useLocation } from 'react-router-dom';
import { useHealth } from './hooks/useApi';
import JobsList from './components/JobsList';
import JobDetail from './components/JobDetail';
import CreateJob from './components/CreateJob';

function App() {
  const location = useLocation();
  const { data: health } = useHealth();

  return (
    <div className="app">
      <header className="header">
        <h1>
          <span>AI</span> Orchestrator
        </h1>
        <nav className="nav-links">
          <Link
            to="/"
            className={location.pathname === '/' ? 'active' : ''}
          >
            Jobs
          </Link>
          <Link
            to="/create"
            className={location.pathname === '/create' ? 'active' : ''}
          >
            New Job
          </Link>
        </nav>
      </header>

      <main className="main">
        {health && (
          <div className="health-panel">
            <div className="health-item">
              <span className={`health-dot ${health.services.backend ? 'healthy' : 'unhealthy'}`} />
              Backend
            </div>
            <div className="health-item">
              <span className={`health-dot ${health.services.n8n ? 'healthy' : 'unhealthy'}`} />
              n8n
            </div>
            <div className="health-item">
              <span className={`health-dot ${health.services.database ? 'healthy' : 'unhealthy'}`} />
              Database
            </div>
            {health.config.devOnlyMode && (
              <div className="health-item">
                Dev Mode
              </div>
            )}
          </div>
        )}

        <Routes>
          <Route path="/" element={<JobsList />} />
          <Route path="/create" element={<CreateJob />} />
          <Route path="/jobs/:jobId" element={<JobDetail />} />
        </Routes>
      </main>
    </div>
  );
}

export default App;
