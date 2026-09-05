import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { Lock, Mail, Activity, ArrowRight, AlertCircle, Sparkles } from 'lucide-react';

export const LoginPage = ({ onSwitchToRegister }) => {
  const { t } = useTranslation();
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
          <h2>{t('auth.signInTo')}</h2>
          <p>{t('common.tagline')}</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">{t('auth.emailLabel')}</label>
            <div style={{ position: 'relative' }}>
              <Mail size={16} style={{ position: 'absolute', left: '0.9rem', top: '0.9rem', color: '#94a3b8' }} />
              <input
                type="email"
                required
                className="form-input"
                placeholder={t('auth.emailPlaceholder')}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                style={{ paddingLeft: '2.6rem' }}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">{t('auth.passwordLabel')}</label>
            <div style={{ position: 'relative' }}>
              <Lock size={16} style={{ position: 'absolute', left: '0.9rem', top: '0.9rem', color: '#94a3b8' }} />
              <input
                type="password"
                required
                className="form-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={{ paddingLeft: '2.6rem' }}
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
              t('auth.signingIn')
            ) : (
              <>{t('auth.signIn')} <ArrowRight size={16} /></>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {t('auth.needAccount')}{' '}
          <button
            type="button"
            onClick={onSwitchToRegister}
            style={{ background: 'none', color: '#22d3ee', fontWeight: '600', textDecoration: 'underline' }}
          >
            {t('auth.registerHere')}
          </button>
        </div>

        <div className="demo-accounts">
          <div className="demo-title">
            <Sparkles size={13} color="#14b8a6" />
            {t('auth.demoTitle')}
          </div>
          <div className="demo-chips">
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('asha.shinde@setucare.in', 'password123')}
            >
              {t('auth.demoAsha')}
            </button>
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('dr.kulkarni@setucare.in', 'password123')}
            >
              {t('auth.demoMo')}
            </button>
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('dr.deshmukh@setucare.in', 'password123')}
            >
              {t('auth.demoSpecialist')}
            </button>
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('pm.patil@setucare.in', 'password123')}
            >
              {t('auth.demoPm')}
            </button>
            <button
              type="button"
              className="demo-chip"
              onClick={() => handleDemoFill('admin@setucare.in', 'admin123')}
            >
              {t('auth.demoAdmin')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
