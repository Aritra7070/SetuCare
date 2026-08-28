import React, { useState } from 'react';
import api from '../api/axios';
import { ShieldCheck, ShieldAlert, Key, Building2, Play, CheckCircle2, XCircle } from 'lucide-react';

export const AccessTester = ({ user }) => {
  const [testResults, setTestResults] = useState({});
  const [loadingRoute, setLoadingRoute] = useState(null);

  const runTest = async (testKey, url, label) => {
    setLoadingRoute(testKey);
    try {
      const response = await api.get(url);
      setTestResults((prev) => ({
        ...prev,
        [testKey]: {
          status: response.status,
          success: true,
          label,
          data: response.data,
          time: new Date().toLocaleTimeString(),
        },
      }));
    } catch (err) {
      setTestResults((prev) => ({
        ...prev,
        [testKey]: {
          status: 403,
          success: false,
          label,
          message: err.message,
          time: new Date().toLocaleTimeString(),
        },
      }));
    } finally {
      setLoadingRoute(null);
    }
  };

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 className="card-title">
              <ShieldCheck size={20} color="#10b981" />
              Live Access Control & Middleware Verification
            </h3>
            <p className="card-desc">
              Test backend roleGuard & facilityScope enforcement live for your active session ({user.role}).
            </p>
          </div>
          <span className={`role-badge role-${user.role}`}>
            Active Role: {user.role}
          </span>
        </div>
      </div>

      <div className="grid-2">
        {/* Test Buttons */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Execute Security Checks
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: 'rgba(15, 23, 42, 0.7)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>1. Who Am I (`/api/auth/me`)</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Validates JWT cookie & populated profile</div>
            </div>
            <button
              onClick={() => runTest('me', '/auth/me', 'Who Am I (Session Check)')}
              disabled={loadingRoute === 'me'}
              className="btn btn-outline btn-sm"
            >
              <Play size={13} /> {loadingRoute === 'me' ? 'Testing...' : 'Test'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: 'rgba(15, 23, 42, 0.7)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>2. RoleGuard (MO / Specialist / Admin)</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Allows: Medical Officer, Specialist, Admin
              </div>
            </div>
            <button
              onClick={() => runTest('mo_specialist', '/auth/test-role-guard', 'Clinical Officer Guard')}
              disabled={loadingRoute === 'mo_specialist'}
              className="btn btn-outline btn-sm"
            >
              <Play size={13} /> {loadingRoute === 'mo_specialist' ? 'Testing...' : 'Test'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: 'rgba(15, 23, 42, 0.7)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>3. RoleGuard (Admin Only)</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Allows only 'admin' role
              </div>
            </div>
            <button
              onClick={() => runTest('admin_only', '/auth/test-admin-only', 'Admin Only Guard')}
              disabled={loadingRoute === 'admin_only'}
              className="btn btn-outline btn-sm"
            >
              <Play size={13} /> {loadingRoute === 'admin_only' ? 'Testing...' : 'Test'}
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0.75rem 1rem',
              background: 'rgba(15, 23, 42, 0.7)',
              borderRadius: 'var(--radius-md)',
              border: '1px solid var(--border-subtle)',
            }}
          >
            <div>
              <div style={{ fontWeight: '600', fontSize: '0.9rem' }}>4. Facility Scope Middleware</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Tests query isolation by facility ID
              </div>
            </div>
            <button
              onClick={() => runTest('facility_scope', '/auth/test-facility-scope', 'Facility Boundary Scope')}
              disabled={loadingRoute === 'facility_scope'}
              className="btn btn-outline btn-sm"
            >
              <Play size={13} /> {loadingRoute === 'facility_scope' ? 'Testing...' : 'Test'}
            </button>
          </div>
        </div>

        {/* Live Execution Output Console */}
        <div>
          <div style={{ fontSize: '0.85rem', fontWeight: '700', color: 'var(--text-secondary)', textTransform: 'uppercase', marginBottom: '0.75rem' }}>
            Live Security Response Output
          </div>
          <div className="code-box" style={{ minHeight: '230px', maxHeight: '290px' }}>
            {Object.keys(testResults).length === 0 ? (
              <span style={{ color: 'var(--text-muted)' }}>
                // Click any test button on the left to fire live requests against SetuCare middleware...
              </span>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                {Object.entries(testResults).map(([key, res]) => (
                  <div
                    key={key}
                    style={{
                      padding: '0.6rem 0.75rem',
                      background: 'rgba(255, 255, 255, 0.03)',
                      borderRadius: 'var(--radius-sm)',
                      borderLeft: `3px solid ${res.success ? '#10b981' : '#f43f5e'}`,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.3rem' }}>
                      <span style={{ fontWeight: '700', color: res.success ? '#34d399' : '#fb7185' }}>
                        {res.success ? '✔ HTTP 200 GRANTED' : '✖ HTTP 403 FORBIDDEN'}: {res.label}
                      </span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{res.time}</span>
                    </div>
                    <pre style={{ margin: 0, fontSize: '0.75rem', whiteSpace: 'pre-wrap', color: '#e2e8f0' }}>
                      {JSON.stringify(res.data || { error: res.message }, null, 2)}
                    </pre>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
