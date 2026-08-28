import React, { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { Lock, Mail, Activity, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export const LoginPage = ({ onSwitchToRegister }) => {
  const { login, loading, error, clearError } = useAuthStore();
  const [email, setEmail] = useState('asha.shinde@setucare.in');
  const [password, setPassword] = useState('password123');

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    await login(email, password);
  };

  const handleDemoFill = (demoEmail, demoPassword) => {
    clearError();
    setEmail(demoEmail);
    setPassword(demoPassword);
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div style={{ display: 'inline-flex', padding: '0.6rem', background: 'rgba(13, 148, 136, 0.15)', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem', color: '#14b8a6' }}>
            <Activity size={28} />
          </div>
          <h2>Sign In to SetuCare</h2>
          <p>Stepped-Care Clinical Navigation & Referral System</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Work Email Address</label>
            <div style={{ position: 'relative' }}>
              <input
                type="email"
                required
                className="form-input"
                placeholder="name@setucare.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                required
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? (
              'Authenticating...'
            ) : (
              <>
                Sign In <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Need a new clinical or admin account?{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            style={{ background: 'none', color: '#22d3ee', fontWeight: '600', textDecoration: 'underline' }}
          >
            Register Here
          </button>
        </div>

        {/* Demo Fast Fill Section */}
        <div className="demo-accounts">
          <div className="demo-title">
            <Sparkles size={13} color="#14b8a6" />
            Quick Demo Accounts (Autofill)
          </div>
          <div className="demo-chips">
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('asha.shinde@setucare.in', 'password123')}
            >
              👩‍⚕️ ASHA (Frontline)
            </button>
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('dr.kulkarni@setucare.in', 'password123')}
            >
              🩺 Medical Officer (PHC)
            </button>
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('dr.deshmukh@setucare.in', 'password123')}
            >
              🏥 Specialist (DH)
            </button>
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('pm.patil@setucare.in', 'password123')}
            >
              📊 Program Manager
            </button>
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('admin@setucare.in', 'admin123')}
            >
              🛡️ Admin
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
