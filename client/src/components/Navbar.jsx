import React from 'react';
import { useAuthStore } from '../stores/authStore';
import {
  Activity,
  LogOut,
  Hospital,
  Building2,
  LayoutDashboard,
  UserPlus,
  Users,
} from 'lucide-react';

export const Navbar = ({ currentView, setCurrentView }) => {
  const { user, logout, loading } = useAuthStore();

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'frontline_worker':
        return 'ASHA / Frontline Worker';
      case 'medical_officer':
        return 'Medical Officer (MO)';
      case 'specialist':
        return 'Specialist (DH/RH)';
      case 'program_manager':
        return 'Program Manager';
      case 'admin':
        return 'System Administrator';
      default:
        return role || 'User';
    }
  };

  const getLanguageName = (code) => {
    switch (code) {
      case 'mr':
        return 'मराठी (MR)';
      case 'hi':
        return 'हिंदी (HI)';
      default:
        return 'English (EN)';
    }
  };

  const canRegisterPatients =
    user && ['frontline_worker', 'medical_officer', 'admin'].includes(user.role);

  return (
    <header className="navbar">
      <div className="nav-content">
        <div style={{ display: 'flex', alignItems: 'center', gap: '1.75rem' }}>
          <div
            className="brand-wrapper"
            style={{ cursor: 'pointer' }}
            onClick={() => setCurrentView('dashboard')}
          >
            <div className="brand-icon">
              <Activity size={22} color="#ffffff" />
            </div>
            <div>
              <div className="brand-title">
                SetuCare <span>सेतुकेअर</span>
              </div>
            </div>
            <span className="brand-subtitle">Phase 1 Foundation</span>
          </div>

          {user && (
            <nav style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', flexWrap: 'wrap' }}>
              <button
                onClick={() => setCurrentView('dashboard')}
                className={`btn btn-sm ${currentView === 'dashboard' ? 'btn-primary' : 'btn-outline'}`}
                style={{ borderRadius: 'var(--radius-full)', padding: '0.35rem 0.85rem' }}
              >
                <LayoutDashboard size={14} />
                Overview
              </button>

              {canRegisterPatients && (
                <button
                  onClick={() => setCurrentView('patient-register')}
                  className={`btn btn-sm ${currentView === 'patient-register' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ borderRadius: 'var(--radius-full)', padding: '0.35rem 0.85rem' }}
                >
                  <UserPlus size={14} />
                  Register Patient
                </button>
              )}

              <button
                onClick={() => setCurrentView('patients-list')}
                className={`btn btn-sm ${currentView === 'patients-list' ? 'btn-primary' : 'btn-outline'}`}
                style={{ borderRadius: 'var(--radius-full)', padding: '0.35rem 0.85rem' }}
              >
                <Users size={14} />
                Patients
              </button>

              {user.role === 'admin' && (
                <button
                  onClick={() => setCurrentView('admin-facilities')}
                  className={`btn btn-sm ${currentView === 'admin-facilities' ? 'btn-primary' : 'btn-outline'}`}
                  style={{ borderRadius: 'var(--radius-full)', padding: '0.35rem 0.85rem' }}
                >
                  <Building2 size={14} />
                  Facilities
                </button>
              )}
            </nav>
          )}
        </div>

        <div className="nav-actions">
          {user ? (
            <>
              <div className="user-badge">
                <div className="avatar-circle">
                  {user.name ? user.name.charAt(0).toUpperCase() : 'U'}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#f8fafc' }}>
                    {user.name}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span className={`role-badge role-${user.role}`}>
                      {getRoleDisplayName(user.role)}
                    </span>
                    {user.facility && (
                      <span className="tier-badge" title={user.facility.name}>
                        <Hospital size={11} style={{ display: 'inline', marginRight: '3px' }} />
                        {user.facility.name}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <span className="tier-badge" style={{ background: 'rgba(6, 182, 212, 0.1)', color: '#22d3ee' }}>
                {getLanguageName(user.preferredLanguage)}
              </span>

              <button
                onClick={logout}
                disabled={loading}
                className="btn btn-outline btn-sm"
                title="Sign out of SetuCare"
              >
                <LogOut size={15} />
                Logout
              </button>
            </>
          ) : (
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                onClick={() => setCurrentView('login')}
                className={`btn btn-sm ${currentView === 'login' ? 'btn-primary' : 'btn-outline'}`}
              >
                Sign In
              </button>
              <button
                onClick={() => setCurrentView('register')}
                className={`btn btn-sm ${currentView === 'register' ? 'btn-primary' : 'btn-outline'}`}
              >
                Register
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
