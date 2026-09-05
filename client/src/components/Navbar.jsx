import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { useTranslation } from 'react-i18next';
import { LanguageSwitcher } from './LanguageSwitcher';
import {
  Activity,
  LogOut,
  Hospital,
  Building2,
  BarChart2,
  LayoutDashboard,
  UserPlus,
  Users,
  QrCode,
  Inbox,
  Package,
} from 'lucide-react';

export const Navbar = ({ currentView, setCurrentView }) => {
  const { user, logout, loading } = useAuthStore();
  const { t } = useTranslation();

  const getRoleDisplayName = (role) => t(`enums.roles.${role}`, { defaultValue: role || 'User' });

  const canRegisterPatients =
    user && ['frontline_worker', 'medical_officer', 'admin'].includes(user.role);
  const canSeeInbox =
    user && ['medical_officer', 'specialist', 'admin'].includes(user.role);
  const canSeeStock =
    user && user.facility; // any authenticated user with a facility
  const canSeeProgramDashboard =
    user && ['program_manager', 'admin'].includes(user.role);
  const canSeeFacilityDashboard =
    user && ['medical_officer', 'specialist', 'admin'].includes(user.role);

  /* ── shared pill button style ── */
  const pill = (active) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '6px',
    padding: '6px 14px',
    borderRadius: '9999px',
    border: 'none',
    cursor: 'pointer',
    fontSize: '13px',
    fontWeight: active ? '600' : '500',
    fontFamily: 'inherit',
    background: active ? 'rgba(20,184,166,0.18)' : 'transparent',
    color: active ? '#5eead4' : 'rgba(255,255,255,0.72)',
    transition: 'background 0.18s, color 0.18s',
  });

  return (
    <header
      className="no-print"
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 20px',
        height: '56px',
        background: 'rgba(10,15,29,0.92)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* ── Left: brand + nav ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {/* Brand mark */}
        <div
          onClick={() => setCurrentView('dashboard')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            marginRight: '6px',
          }}
        >
          <div
            style={{
              width: '32px',
              height: '32px',
              borderRadius: '9px',
              background: 'linear-gradient(135deg,#0d9488 0%,#06b6d4 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 12px rgba(20,184,166,0.35)',
              flexShrink: 0,
            }}
          >
            <Activity size={18} color="#ffffff" />
          </div>
          <span
            style={{
              fontSize: '15px',
              fontWeight: '700',
              color: '#f8fafc',
              letterSpacing: '-0.01em',
              whiteSpace: 'nowrap',
            }}
          >
            SetuCare
          </span>
        </div>

        {/* Nav pills — only when logged in */}
        {user && (
          <nav
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
              background: '#0C0C0C',
              borderRadius: '9999px',
              padding: '4px 6px',
            }}
          >
            <button
              style={pill(currentView === 'dashboard')}
              onClick={() => setCurrentView('dashboard')}
              onMouseEnter={(e) => { if (currentView !== 'dashboard') { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#ffffff'; } }}
              onMouseLeave={(e) => { if (currentView !== 'dashboard') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; } }}
            >
              <LayoutDashboard size={13} />
              {t('nav.overview')}
            </button>

            <button
              style={pill(currentView === 'scan-lookup' || currentView === 'patient-timeline')}
              onClick={() => setCurrentView('scan-lookup')}
              onMouseEnter={(e) => { const a = currentView === 'scan-lookup' || currentView === 'patient-timeline'; if (!a) { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#ffffff'; } }}
              onMouseLeave={(e) => { const a = currentView === 'scan-lookup' || currentView === 'patient-timeline'; if (!a) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; } }}
            >
              <QrCode size={13} />
              {t('nav.scanLookup')}
            </button>

            {canRegisterPatients && (
              <button
                style={pill(currentView === 'patient-register')}
                onClick={() => setCurrentView('patient-register')}
                onMouseEnter={(e) => { if (currentView !== 'patient-register') { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#ffffff'; } }}
                onMouseLeave={(e) => { if (currentView !== 'patient-register') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; } }}
              >
                <UserPlus size={13} />
                {t('nav.registerPatient')}
              </button>
            )}

            <button
              style={pill(currentView === 'patients-list')}
              onClick={() => setCurrentView('patients-list')}
              onMouseEnter={(e) => { if (currentView !== 'patients-list') { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#ffffff'; } }}
              onMouseLeave={(e) => { if (currentView !== 'patients-list') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; } }}
            >
              <Users size={13} />
              {t('nav.patients')}
            </button>

            {user.role === 'admin' && (
              <button
                style={pill(currentView === 'admin-facilities')}
                onClick={() => setCurrentView('admin-facilities')}
                onMouseEnter={(e) => { if (currentView !== 'admin-facilities') { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#ffffff'; } }}
                onMouseLeave={(e) => { if (currentView !== 'admin-facilities') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; } }}
              >
                <Building2 size={13} />
                {t('nav.facilities')}
              </button>
            )}

            {canSeeFacilityDashboard && (
              <button
                style={pill(currentView === 'facility-dashboard')}
                onClick={() => setCurrentView('facility-dashboard')}
                onMouseEnter={(e) => { if (currentView !== 'facility-dashboard') { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#ffffff'; } }}
                onMouseLeave={(e) => { if (currentView !== 'facility-dashboard') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; } }}
              >
                <BarChart2 size={13} />
                {t('nav.facilityDashboard')}
              </button>
            )}

            {canSeeInbox && (
              <button
                style={pill(currentView === 'referral-inbox')}
                onClick={() => setCurrentView('referral-inbox')}
                onMouseEnter={(e) => { if (currentView !== 'referral-inbox') { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#ffffff'; } }}
                onMouseLeave={(e) => { if (currentView !== 'referral-inbox') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; } }}
              >
                <Inbox size={13} />
                {t('nav.inbox')}
              </button>
            )}

            {canSeeStock && (
              <button
                style={pill(currentView === 'stock')}
                onClick={() => setCurrentView('stock')}
                onMouseEnter={(e) => { if (currentView !== 'stock') { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#ffffff'; } }}
                onMouseLeave={(e) => { if (currentView !== 'stock') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; } }}
              >
                <Package size={13} />
                {t('nav.stock')}
              </button>
            )}

            {canSeeProgramDashboard && (
              <button
                style={pill(currentView === 'program-dashboard')}
                onClick={() => setCurrentView('program-dashboard')}
                onMouseEnter={(e) => { if (currentView !== 'program-dashboard') { e.currentTarget.style.background = 'rgba(255,255,255,0.07)'; e.currentTarget.style.color = '#ffffff'; } }}
                onMouseLeave={(e) => { if (currentView !== 'program-dashboard') { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'rgba(255,255,255,0.72)'; } }}
              >
                <BarChart2 size={13} />
                {t('nav.district')}
              </button>
            )}
          </nav>
        )}
      </div>

      {/* ── Right: user info + logout ── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
        {user ? (
          <>
            {/* Avatar + name + role chip */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '9999px',
                padding: '4px 12px 4px 6px',
              }}
            >
              <div
                style={{
                  width: '26px',
                  height: '26px',
                  borderRadius: '50%',
                  background: 'linear-gradient(135deg,#0d9488 0%,#3b82f6 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: '700',
                  fontSize: '11px',
                  color: '#ffffff',
                  flexShrink: 0,
                }}
              >
                {user.name?.charAt(0).toUpperCase() || 'U'}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1px' }}>
                <span style={{ fontSize: '12px', fontWeight: '700', color: '#f8fafc', lineHeight: 1.2 }}>
                  {user.name}
                </span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: '600',
                    color: '#14b8a6',
                    textTransform: 'uppercase',
                    letterSpacing: '0.04em',
                    lineHeight: 1.2,
                  }}
                >
                  {getRoleDisplayName(user.role)}
                </span>
              </div>
            </div>

            {/* Facility chip */}
            {user.facility && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  background: 'rgba(6,182,212,0.08)',
                  border: '1px solid rgba(6,182,212,0.2)',
                  borderRadius: '9999px',
                  padding: '4px 10px',
                  fontSize: '11px',
                  color: '#22d3ee',
                  whiteSpace: 'nowrap',
                }}
              >
                <Hospital size={11} />
                {user.facility.name}
              </div>
            )}

            {/* Language switcher — visible to all authenticated users */}
            <LanguageSwitcher />

            {/* Logout */}
            <button
              onClick={logout}
              disabled={loading}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '5px',
                padding: '5px 12px',
                borderRadius: '9999px',
                border: '1px solid rgba(255,255,255,0.1)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.6)',
                fontSize: '12px',
                cursor: 'pointer',
                fontFamily: 'inherit',
                transition: 'color 0.2s, border-color 0.2s',
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#ffffff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
            >
              <LogOut size={13} />
              {t('auth.signOut')}
            </button>
          </>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <LanguageSwitcher />
            <button
              onClick={() => setCurrentView('login')}
              style={{
                padding: '6px 16px',
                borderRadius: '9999px',
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'transparent',
                color: 'rgba(255,255,255,0.8)',
                fontSize: '13px',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('auth.signIn')}
            </button>
            <button
              onClick={() => setCurrentView('register')}
              style={{
                padding: '6px 16px',
                borderRadius: '9999px',
                border: 'none',
                background: '#ffffff',
                color: '#000000',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              {t('auth.getStarted')}
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
