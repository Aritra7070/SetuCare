import React from 'react';
import { useAuthStore } from '../stores/authStore';
import { SchemaViewer } from '../components/SchemaViewer';
import { AccessTester } from '../components/AccessTester';
import {
  User,
  Hospital,
  Shield,
  CheckCircle2,
  Phone,
  Globe,
  MapPin,
  Clock,
  Layers,
  Building2,
  ArrowRight,
  UserPlus,
  Users,
  QrCode,
  Scan,
} from 'lucide-react';

export const DashboardPage = ({
  onNavigateToFacilities,
  onNavigateToRegister,
  onNavigateToPatients,
  onNavigateToScan,
}) => {
  const { user } = useAuthStore();

  if (!user) return null;

  const getRoleDisplayName = (role) => {
    switch (role) {
      case 'frontline_worker':
        return 'Frontline Health Worker (ASHA / ANM)';
      case 'medical_officer':
        return 'Medical Officer (PHC Level)';
      case 'specialist':
        return 'Specialist (District / Rural Hospital)';
      case 'program_manager':
        return 'District Program Manager';
      case 'admin':
        return 'System Administrator';
      default:
        return role;
    }
  };

  const getRoleScopeDescription = (role) => {
    switch (role) {
      case 'frontline_worker':
        return 'Scoped to assigned Sub-Centre/PHC area. Records community encounters, vitals, and initiates stepped referrals.';
      case 'medical_officer':
        return 'Scoped to PHC. Reviews triage assessments, accepts primary referrals, and routes patients to specialist tiers.';
      case 'specialist':
        return 'Scoped to District/Rural Hospital. Handles escalated consultations, referral admissions, and complex care.';
      case 'program_manager':
        return 'Cross-facility district oversight. Analyzes cohort health trends and monitor referral bottlenecks.';
      case 'admin':
        return 'Universal system access. Manages health network facilities, worker accounts, and system configuration.';
      default:
        return 'Standard clinical access.';
    }
  };

  const canRegister = ['frontline_worker', 'medical_officer', 'admin'].includes(user.role);

  return (
    <div className="main-content">
      {/* Welcome Banner */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '1rem',
          marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em' }}>
            Welcome back, {user.name}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            SetuCare Phase 1 & 2 Active &bull; Maharashtra Stepped-Care Network
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className={`role-badge role-${user.role}`}>
            <Shield size={13} />
            {user.role}
          </span>
          <span className="tier-badge" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: '1px solid rgba(16, 185, 129, 0.3)' }}>
            <CheckCircle2 size={12} style={{ display: 'inline', marginRight: '4px' }} />
            Auth Verified (JWT Cookie)
          </span>
        </div>
      </div>

      {/* Continuity Spine Quick Actions (Step 4 & Step 3) */}
      <div className="grid-3" style={{ marginBottom: '1.5rem' }}>
        {/* Card 1: Scan & Lookup */}
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.18) 0%, rgba(59, 130, 246, 0.12) 100%)',
            border: '1px solid rgba(6, 182, 212, 0.4)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <Scan size={20} color="#22d3ee" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffffff' }}>
                Scan & Lookup PHID
              </h3>
            </div>
            <p style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>
              Camera QR scanner, file upload, or manual PHID entry. Bypasses facility boundaries for universal continuity.
            </p>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={onNavigateToScan}
              className="btn btn-primary"
              style={{ width: '100%', padding: '0.6rem', fontSize: '0.875rem' }}
            >
              <QrCode size={14} /> Open QR Scanner / Lookup
            </button>
          </div>
        </div>

        {/* Card 2: Register Patient */}
        {canRegister && (
          <div
            className="card"
            style={{
              background: 'linear-gradient(135deg, rgba(13, 148, 136, 0.18) 0%, rgba(16, 185, 129, 0.12) 100%)',
              border: '1px solid rgba(20, 184, 166, 0.4)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
                <UserPlus size={20} color="#14b8a6" />
                <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffffff' }}>
                  Register New Patient
                </h3>
              </div>
              <p style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>
                Capture demographics, run duplicate checks, minor guardian detection, and issue offline QR card.
              </p>
            </div>

            <div style={{ marginTop: '1rem' }}>
              <button
                onClick={onNavigateToRegister}
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.6rem', fontSize: '0.875rem', background: 'linear-gradient(135deg, #0d9488 0%, #10b981 100%)' }}
              >
                <UserPlus size={14} /> Register Patient (PHID)
              </button>
            </div>
          </div>
        )}

        {/* Card 3: Patient Directory */}
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(59, 130, 246, 0.1) 100%)',
            border: '1px solid rgba(139, 92, 246, 0.3)',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
          }}
        >
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', marginBottom: '0.4rem' }}>
              <Users size={20} color="#c4b5fd" />
              <h3 style={{ fontSize: '1.1rem', fontWeight: '800', color: '#ffffff' }}>
                Patients Directory
              </h3>
            </div>
            <p style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>
              Browse enrolled patients, print digital health cards, and edit demographic records.
            </p>
          </div>

          <div style={{ marginTop: '1rem' }}>
            <button
              onClick={onNavigateToPatients}
              className="btn btn-outline"
              style={{ width: '100%', padding: '0.6rem', fontSize: '0.875rem', borderColor: 'rgba(139, 92, 246, 0.4)', color: '#c4b5fd' }}
            >
              <Users size={14} /> View Directory
            </button>
          </div>
        </div>
      </div>

      {/* Admin Facility Management Quick Action Banner */}
      {user.role === 'admin' && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(135deg, rgba(244, 63, 94, 0.15) 0%, rgba(245, 158, 11, 0.1) 100%)',
            border: '1px solid rgba(244, 63, 94, 0.3)',
            marginBottom: '1.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '1rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.85rem' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: 'var(--radius-md)',
                background: 'linear-gradient(135deg, #f43f5e 0%, #f59e0b 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building2 size={20} color="#ffffff" />
            </div>
            <div>
              <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#ffffff' }}>
                Admin Facility Hierarchy Management
              </div>
              <div style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>
                Manage 4-tier health hierarchy, parent-tier validation, and interactive stepped-care trees.
              </div>
            </div>
          </div>

          <button
            onClick={onNavigateToFacilities}
            className="btn btn-outline"
            style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', borderColor: 'rgba(244, 63, 94, 0.4)', color: '#fda4af' }}
          >
            Manage Facilities (CRUD & Tree) <ArrowRight size={15} />
          </button>
        </div>
      )}

      {/* Grid: User Profile & Facility Scope */}
      <div className="grid-2">
        {/* User Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <User size={19} color="#14b8a6" />
              Authenticated Clinical Profile
            </h3>
            <p className="card-desc">Active credentials and role-based permissions</p>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Full Name</span>
              <span style={{ fontWeight: '600', color: '#f8fafc' }}>{user.name}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Email</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.85rem', color: '#38bdf8' }}>{user.email}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Clinical Role</span>
              <span style={{ fontWeight: '600', color: '#f1f5f9' }}>{getRoleDisplayName(user.role)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Phone</span>
              <span style={{ color: '#f1f5f9' }}>{user.phone || 'Not recorded'}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Language Preference</span>
              <span style={{ color: '#f1f5f9', textTransform: 'uppercase' }}>{user.preferredLanguage || 'en'}</span>
            </div>

            <div style={{ marginTop: '0.4rem', padding: '0.75rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: '700', color: 'var(--accent-cyan)', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                Role Scope & Permissions
              </div>
              <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                {getRoleScopeDescription(user.role)}
              </div>
            </div>
          </div>
        </div>

        {/* Facility Card */}
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Hospital size={19} color="#06b6d4" />
              Assigned Health Facility
            </h3>
            <p className="card-desc">Geographic and tier boundary context</p>
          </div>

          {user.facility ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Facility Name</span>
                <span style={{ fontWeight: '700', color: '#f8fafc' }}>{user.facility.name}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Facility Short Code</span>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)',
                    fontWeight: '800',
                    color: '#22d3ee',
                    background: 'rgba(6, 182, 212, 0.1)',
                    padding: '0.1rem 0.45rem',
                    borderRadius: '4px',
                  }}
                >
                  {user.facility.shortCode || 'SC01'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Facility Tier</span>
                <span className="tier-badge" style={{ textTransform: 'uppercase' }}>
                  {user.facility.tier?.replace('_', ' ')}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>District / State</span>
                <span style={{ color: '#f1f5f9' }}>{user.facility.district || 'Pune'}, {user.facility.state || 'Maharashtra'}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Coordinates</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.8rem', color: '#a5f3fc' }}>
                  {user.facility.location?.lat ? `${user.facility.location.lat}, ${user.facility.location.lng}` : '18.5729° N, 73.8078° E'}
                </span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid var(--border-subtle)', paddingBottom: '0.5rem' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Contact Phone</span>
                <span style={{ color: '#f1f5f9' }}>{user.facility.contactPhone || '+91-20-25881234'}</span>
              </div>

              <div style={{ marginTop: '0.4rem', padding: '0.75rem', background: 'rgba(6, 182, 212, 0.08)', borderRadius: 'var(--radius-sm)', border: '1px solid rgba(6, 182, 212, 0.2)' }}>
                <div style={{ fontSize: '0.78rem', fontWeight: '700', color: '#38bdf8', textTransform: 'uppercase', marginBottom: '0.2rem' }}>
                  PHID Auto-Stamping Active
                </div>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)' }}>
                  All patients registered by this account will carry PHID prefixed with {user.facility.shortCode || 'SC01'} and link to {user.facility.name}.
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <Globe size={32} color="#f59e0b" style={{ marginBottom: '0.5rem' }} />
              <div style={{ fontWeight: '700', color: '#f8fafc', marginBottom: '0.3rem' }}>
                Global / Regional Scope
              </div>
              <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                As an Administrator, you have unrestricted cross-facility oversight across all Maharashtra health tiers.
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Interactive Access & Middleware Tester */}
      <AccessTester user={user} />

      {/* Interactive Schema Visualizer */}
      <SchemaViewer />
    </div>
  );
};
