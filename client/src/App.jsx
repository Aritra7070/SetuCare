import React, { useEffect, useState } from 'react';
import { useAuthStore } from './stores/authStore';
import { Navbar } from './components/Navbar';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { DashboardPage } from './pages/DashboardPage';
import { ScanLookupPage } from './pages/ScanLookupPage';
import { PatientTimelinePage } from './pages/PatientTimelinePage';
import { PatientRegisterPage } from './pages/PatientRegisterPage';
import { PatientsListPage } from './pages/PatientsListPage';
import { AdminFacilitiesPage } from './pages/AdminFacilitiesPage';
import { Activity } from 'lucide-react';

export function App() {
  const { user, authChecking, fetchMe } = useAuthStore();
  const [currentView, setCurrentView] = useState('landing'); // 'landing' | 'dashboard' | 'scan-lookup' | 'patient-timeline' | 'patient-register' | 'patients-list' | 'admin-facilities' | 'login' | 'register'
  const [timelinePhid, setTimelinePhid] = useState(null);

  useEffect(() => {
    fetchMe();
  }, [fetchMe]);

  useEffect(() => {
    if (user) {
      // Authenticated — skip landing/login/register, go straight to dashboard
      if (['landing', 'login', 'register'].includes(currentView)) {
        setCurrentView('dashboard');
      }
    } else {
      // Not authenticated — protected views redirect to landing
      if (
        currentView === 'dashboard' ||
        currentView === 'scan-lookup' ||
        currentView === 'patient-timeline' ||
        currentView === 'patient-register' ||
        currentView === 'patients-list' ||
        currentView === 'admin-facilities'
      ) {
        setCurrentView('landing');
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
      case 'scan-lookup':
        return (
          <ScanLookupPage
            onNavigateToRegister={() => setCurrentView('patient-register')}
            onNavigateToTimeline={(phid) => {
              setTimelinePhid(phid);
              setCurrentView('patient-timeline');
            }}
          />
        );
      case 'patient-timeline':
        return (
          <PatientTimelinePage
            phid={timelinePhid}
            onBack={() => setCurrentView('scan-lookup')}
            onNavigateToScan={() => setCurrentView('scan-lookup')}
          />
        );
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
            onNavigateToScan={() => setCurrentView('scan-lookup')}
          />
        );
    }
  };

  return (
    <div className="app-container">
      {/* Landing page is fullscreen — no Navbar or footer */}
      {!user && currentView === 'landing' ? (
        <LandingPage onGetStarted={() => setCurrentView('register')} />
      ) : (
        <>
          <Navbar currentView={currentView} setCurrentView={setCurrentView} />

          {user ? (
            renderCurrentView()
          ) : currentView === 'register' ? (
            <RegisterPage onSwitchToLogin={() => setCurrentView('login')} />
          ) : (
            <LoginPage
              onSwitchToRegister={() => setCurrentView('register')}
              onBack={() => setCurrentView('landing')}
            />
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
            SetuCare (सेतुकेअर) &bull; Phase 1 & 2 &bull; Stepped-Care Clinical Navigation & Referral System
          </footer>
        </>
      )}
    </div>
  );
}

export default App;
