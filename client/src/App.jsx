import React, { useEffect, useState } from 'react';
import { useAuthStore } from './stores/authStore';
import { Navbar } from './components/Navbar';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { PatientRegisterPage } from './pages/PatientRegisterPage';
import { PatientsListPage } from './pages/PatientsListPage';
import { AdminFacilitiesPage } from './pages/AdminFacilitiesPage';
import { Activity } from 'lucide-react';

export function App() {
  const { user, authChecking, fetchMe } = useAuthStore();
  const [currentView, setCurrentView] = useState('dashboard'); // 'dashboard' | 'patient-register' | 'patients-list' | 'admin-facilities' | 'login' | 'register'

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (user) {
      if (currentView === 'login' || currentView === 'register') {
        setCurrentView('dashboard');
      }
    } else {
      if (
        currentView === 'dashboard' ||
        currentView === 'patient-register' ||
        currentView === 'patients-list' ||
        currentView === 'admin-facilities'
      ) {
        setCurrentView('login');
      }
    }
  }, [user]);

  if (authChecking) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '1rem',
          background: 'var(--bg-main)',
        }}
      >
        <div
          style={{
            width: '48px',
            height: '48px',
            borderRadius: 'var(--radius-md)',
            background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 25px rgba(20, 184, 166, 0.4)',
            animation: 'pulse 1.5s infinite ease-in-out',
          }}
        >
          <Activity size={26} color="#ffffff" />
        </div>
        <div style={{ fontWeight: '700', fontSize: '1.1rem', color: '#f8fafc' }}>
          Loading SetuCare...
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>
          Verifying secure clinical credentials
        </div>
      </div>
    );
  }

  const renderCurrentView = () => {
    switch (currentView) {
      case 'patient-register':
        return <PatientRegisterPage onNavigateToList={() => setCurrentView('patients-list')} />;
      case 'patients-list':
        return <PatientsListPage onNavigateToRegister={() => setCurrentView('patient-register')} />;
      case 'admin-facilities':
        return user?.role === 'admin' ? <AdminFacilitiesPage /> : <DashboardPage />;
      case 'dashboard':
      default:
        return (
          <DashboardPage
            onNavigateToFacilities={() => setCurrentView('admin-facilities')}
            onNavigateToRegister={() => setCurrentView('patient-register')}
            onNavigateToPatients={() => setCurrentView('patients-list')}
          />
        );
    }
  };

  return (
    <div className="app-container">
      <Navbar currentView={currentView} setCurrentView={setCurrentView} />

      {user ? (
        renderCurrentView()
      ) : currentView === 'register' ? (
        <RegisterPage onSwitchToLogin={() => setCurrentView('login')} />
      ) : (
        <LoginPage onSwitchToRegister={() => setCurrentView('register')} />
      )}

      <footer
        className="no-print"
        style={{
          textAlign: 'center',
          padding: '1.5rem',
          color: 'var(--text-muted)',
          fontSize: '0.8rem',
          borderTop: '1px solid var(--border-subtle)',
          background: 'rgba(11, 17, 32, 0.9)',
        }}
      >
        SetuCare (सेतुकेअर) &bull; Phase 1 Foundation &bull; Stepped-Care Clinical Navigation & Referral System
      </footer>
    </div>
  );
}

export default App;
