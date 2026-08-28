import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import { QRScanner } from '../components/QRScanner';
import { PatientCardModal } from '../components/PatientCardModal';
import { EncounterCreateModal } from '../components/EncounterCreateModal';
import {
  QrCode,
  Search,
  User,
  Hospital,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  Phone,
  MapPin,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  Stethoscope,
  Globe,
  RotateCcw,
  UserPlus,
  Activity,
  Heart,
  Thermometer,
  Wind,
  Weight,
  Layers,
  Clock,
  Zap,
} from 'lucide-react';

export const ScanLookupPage = ({ onNavigateToRegister }) => {
  const { user } = useAuthStore();

  const [inputPhid, setInputPhid] = useState('');
  const [loading, setLoading] = useState(false);
  const [lookupError, setLookupError] = useState(null);
  const [notFoundPhid, setNotFoundPhid] = useState(null);

  // Result state
  const [lookupResult, setLookupResult] = useState(null);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [encounterModalOpen, setEncounterModalOpen] = useState(false);

  // Recent sample patients for 1-click test chips
  const [recentPatients, setRecentPatients] = useState([]);

  useEffect(() => {
    // Fetch recent patients to provide 1-click test chips
    api.get('/patients')
      .then((res) => {
        if (res.data.success && res.data.patients.length > 0) {
          setRecentPatients(res.data.patients.slice(0, 4));
        }
      })
      .catch(() => {});
  }, []);

  const performLookup = async (phidToSearch, source = 'manual_entry') => {
    if (!phidToSearch || !phidToSearch.trim()) {
      setLookupError('Please enter or scan a valid PHID.');
      return;
    }

    const cleanPhid = phidToSearch.trim();
    setLoading(true);
    setLookupError(null);
    setNotFoundPhid(null);
    setLookupResult(null);

    try {
      const res = await api.get(`/patients/lookup/${encodeURIComponent(cleanPhid)}`, {
        params: { source },
      });

      if (res.data.success && res.data.patient) {
        setLookupResult(res.data);
      }
    } catch (err) {
      if (err.status === 404 || err.response?.status === 404) {
        setNotFoundPhid(cleanPhid);
      } else {
        setLookupError(err.message || 'Error looking up patient record');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    performLookup(inputPhid, 'manual_entry');
  };

  const handleScanSuccess = (decodedPhid, scanSource) => {
    setInputPhid(decodedPhid);
    performLookup(decodedPhid, scanSource);
  };

  const resetSearch = () => {
    setLookupResult(null);
    setNotFoundPhid(null);
    setLookupError(null);
    setInputPhid('');
  };

  const handleEncounterCreated = (newEncounter) => {
    setEncounterModalOpen(false);
    // Refresh the patient's lookup record and timeline
    if (lookupResult?.patient?.phid) {
      performLookup(lookupResult.patient.phid, 'direct_lookup');
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getEncounterTypeBadge = (type) => {
    switch (type) {
      case 'referral_consult':
        return { label: 'Referral Consult', bg: 'rgba(244, 63, 94, 0.15)', color: '#fb7185', border: 'rgba(244, 63, 94, 0.3)' };
      case 'follow_up':
        return { label: 'Follow-Up Check', bg: 'rgba(59, 130, 246, 0.15)', color: '#93c5fd', border: 'rgba(59, 130, 246, 0.3)' };
      case 'walk_in':
      default:
        return { label: 'Routine Walk-In', bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399', border: 'rgba(16, 185, 129, 0.3)' };
    }
  };

  return (
    <div className="main-content">
      {/* Top Banner */}
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
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <QrCode size={26} color="#14b8a6" />
            Patient QR Scan & Universal Lookup
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Scan patient health card or enter PHID to instantly retrieve cross-facility clinical records.
          </p>
        </div>

        {/* Current Scanning Facility Context */}
        <div
          style={{
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid var(--border-subtle)',
            padding: '0.5rem 0.9rem',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.825rem',
          }}
        >
          <Hospital size={15} color="#06b6d4" />
          <span>
            Scanning at:{' '}
            <strong style={{ color: '#ffffff' }}>
              {user?.facility?.name || 'Local Health Facility'}
            </strong>{' '}
            <span style={{ color: '#22d3ee', fontFamily: 'var(--font-mono)' }}>
              [{user?.facility?.shortCode || 'FAC'}]
            </span>
          </span>
        </div>
      </div>

      {/* Main View: Result Card OR Scanner View */}
      {lookupResult ? (
        /* PATIENT RECORD LOOKUP RESULT VIEW */
        <div style={{ maxWidth: '880px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
          {/* Top Status & Cross-Facility Alert */}
          <div
            className="card"
            style={{
              background: lookupResult.scanContext?.isCrossFacility
                ? 'linear-gradient(135deg, rgba(59, 130, 246, 0.18) 0%, rgba(139, 92, 246, 0.12) 100%)'
                : 'linear-gradient(135deg, rgba(16, 185, 129, 0.18) 0%, rgba(6, 182, 212, 0.12) 100%)',
              border: lookupResult.scanContext?.isCrossFacility
                ? '1px solid rgba(59, 130, 246, 0.4)'
                : '1px solid rgba(16, 185, 129, 0.4)',
              padding: '1.25rem 1.5rem',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                <div
                  style={{
                    width: '40px',
                    height: '40px',
                    borderRadius: '10px',
                    background: lookupResult.scanContext?.isCrossFacility
                      ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'
                      : 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  {lookupResult.scanContext?.isCrossFacility ? (
                    <Globe size={22} color="#ffffff" />
                  ) : (
                    <CheckCircle2 size={22} color="#ffffff" />
                  )}
                </div>
                <div>
                  <div style={{ fontWeight: '800', fontSize: '1.05rem', color: '#ffffff' }}>
                    {lookupResult.scanContext?.isCrossFacility
                      ? 'Cross-Facility Continuity Active'
                      : 'Local Facility Patient Verified'}
                  </div>
                  <div style={{ fontSize: '0.825rem', color: '#cbd5e1' }}>
                    {lookupResult.scanContext?.isCrossFacility
                      ? `Patient registered at ${lookupResult.patient.registeredAtFacility?.name || 'Sub-Centre'}, currently presenting at ${user?.facility?.name || 'Current Facility'}.`
                      : `Patient is enrolled locally at ${lookupResult.patient.registeredAtFacility?.name}.`}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setEncounterModalOpen(true)}
                  className="btn btn-primary btn-sm"
                  style={{ background: 'linear-gradient(135deg, #0d9488 0%, #06b6d4 100%)' }}
                >
                  <Stethoscope size={14} /> + Record Encounter
                </button>
                <button onClick={resetSearch} className="btn btn-outline btn-sm">
                  <RotateCcw size={13} /> Scan Another
                </button>
              </div>
            </div>
          </div>

          {/* Patient Details Main Card */}
          <div className="card">
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
                borderBottom: '1px solid var(--border-subtle)',
                paddingBottom: '1.25rem',
                marginBottom: '1.25rem',
              }}
            >
              <div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: '700' }}>
                  Patient Identity Record
                </div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: '800', color: '#ffffff', marginTop: '2px' }}>
                  {lookupResult.patient.name}
                </h2>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '4px' }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontWeight: '800',
                      fontSize: '0.9rem',
                      color: '#22d3ee',
                      background: 'rgba(6, 182, 212, 0.12)',
                      padding: '0.2rem 0.6rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(6, 182, 212, 0.3)',
                    }}
                  >
                    {lookupResult.patient.phid}
                  </span>
                  <span className="tag-badge tag-required" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                    Verified PHID
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.6rem' }}>
                <button
                  onClick={() => setCardModalOpen(true)}
                  className="btn btn-outline btn-sm"
                >
                  <QrCode size={14} /> View Digital Card
                </button>
              </div>
            </div>

            {/* Demographics Grid */}
            <div className="grid-3" style={{ gap: '1rem', marginBottom: '1.25rem' }}>
              <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Age & Date of Birth</div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#f8fafc', marginTop: '2px' }}>
                  {lookupResult.age !== null ? `${lookupResult.age} years old` : 'N/A'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  DOB: {formatDate(lookupResult.patient.dob)}
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Gender & Language</div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#f8fafc', marginTop: '2px', textTransform: 'capitalize' }}>
                  {lookupResult.patient.gender || 'Not specified'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
                  Language: {lookupResult.patient.preferredLanguage || 'MR'}
                </div>
              </div>

              <div style={{ background: 'rgba(15, 23, 42, 0.5)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Contact Phone</div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#f8fafc', marginTop: '2px' }}>
                  {lookupResult.patient.phone || 'None recorded'}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {lookupResult.patient.address || 'Maharashtra'}
                </div>
              </div>
            </div>

            {lookupResult.patient.guardianName && (
              <div
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  padding: '0.75rem 1rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                  marginBottom: '1.25rem',
                }}
              >
                <div style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: '700' }}>
                  Minor Guardian Information
                </div>
                <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#fef3c7', marginTop: '2px' }}>
                  {lookupResult.patient.guardianName}
                </div>
              </div>
            )}

            {/* Origin Facility Information */}
            <div
              style={{
                background: 'rgba(6, 182, 212, 0.06)',
                border: '1px solid rgba(6, 182, 212, 0.2)',
                padding: '0.9rem 1.25rem',
                borderRadius: 'var(--radius-md)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                <Hospital size={20} color="#06b6d4" />
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Origin Enrolling Health Facility
                  </div>
                  <div style={{ fontWeight: '700', color: '#f8fafc' }}>
                    {lookupResult.patient.registeredAtFacility?.name}
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span className="tier-badge" style={{ textTransform: 'uppercase' }}>
                  {lookupResult.patient.registeredAtFacility?.tier?.replace('_', ' ')}
                </span>
                <span className="tier-badge" style={{ color: '#22d3ee' }}>
                  {lookupResult.patient.registeredAtFacility?.district}
                </span>
              </div>
            </div>
          </div>

          {/* Stepped-Care Encounters Section */}
          <div className="card">
            <div className="card-header" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div>
                <h3 className="card-title">
                  <Stethoscope size={19} color="#14b8a6" />
                  Longitudinal Clinical Encounters ({lookupResult.encounters?.length || 0})
                </h3>
                <p className="card-desc">
                  Chronological record of visits stamped across Maharashtra stepped-care network.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setEncounterModalOpen(true)}
                className="btn btn-primary btn-sm"
              >
                <Stethoscope size={14} /> + Record Visit
              </button>
            </div>

            {lookupResult.encounters && lookupResult.encounters.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                {lookupResult.encounters.map((enc) => {
                  const badge = getEncounterTypeBadge(enc.encounterType);

                  return (
                    <div
                      key={enc._id}
                      style={{
                        background: 'rgba(15, 23, 42, 0.65)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        padding: '1.25rem',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '0.85rem',
                      }}
                    >
                      {/* Visit Header */}
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '0.6rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
                          <span
                            style={{
                              padding: '0.2rem 0.6rem',
                              borderRadius: 'var(--radius-full)',
                              fontSize: '0.75rem',
                              fontWeight: '700',
                              background: badge.bg,
                              color: badge.color,
                              border: `1px solid ${badge.border}`,
                            }}
                          >
                            {badge.label}
                          </span>
                          <span style={{ fontSize: '0.825rem', fontWeight: '700', color: '#f8fafc' }}>
                            {enc.facility?.name || 'Local Facility'}
                          </span>
                          <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: '#22d3ee' }}>
                            [{enc.facility?.shortCode || 'FAC'}]
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                          <Clock size={13} />
                          {formatDateTime(enc.createdAt)}
                        </div>
                      </div>

                      {/* Attending Worker Info */}
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        Attending Clinician:{' '}
                        <strong style={{ color: '#e2e8f0' }}>{enc.worker?.name || 'Clinician'}</strong>{' '}
                        <span style={{ textTransform: 'capitalize', color: 'var(--text-muted)' }}>
                          ({enc.worker?.role?.replace('_', ' ') || 'Staff'})
                        </span>
                      </div>

                      {/* Vitals Pills */}
                      {enc.vitals && Object.values(enc.vitals).some((v) => v !== undefined && v !== '') && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                          {enc.vitals.bp && (
                            <span
                              style={{
                                background: 'rgba(59, 130, 246, 0.1)',
                                border: '1px solid rgba(59, 130, 246, 0.25)',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                color: '#93c5fd',
                              }}
                            >
                              BP: <strong>{enc.vitals.bp}</strong> mmHg
                            </span>
                          )}
                          {enc.vitals.tempC !== undefined && enc.vitals.tempC !== null && (
                            <span
                              style={{
                                background: enc.vitals.tempC >= 38.0 ? 'rgba(239, 68, 68, 0.15)' : 'rgba(255, 255, 255, 0.05)',
                                border: enc.vitals.tempC >= 38.0 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid var(--border-subtle)',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                color: enc.vitals.tempC >= 38.0 ? '#fca5a5' : '#e2e8f0',
                              }}
                            >
                              Temp: <strong>{enc.vitals.tempC}°C</strong>
                            </span>
                          )}
                          {enc.vitals.pulse && (
                            <span
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-subtle)',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                color: '#e2e8f0',
                              }}
                            >
                              Pulse: <strong>{enc.vitals.pulse}</strong> bpm
                            </span>
                          )}
                          {enc.vitals.spo2 && (
                            <span
                              style={{
                                background: enc.vitals.spo2 < 92 ? 'rgba(239, 68, 68, 0.18)' : 'rgba(16, 185, 129, 0.1)',
                                border: enc.vitals.spo2 < 92 ? '1px solid rgba(239, 68, 68, 0.4)' : '1px solid rgba(16, 185, 129, 0.25)',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                color: enc.vitals.spo2 < 92 ? '#fca5a5' : '#6ee7b7',
                              }}
                            >
                              SpO2: <strong>{enc.vitals.spo2}%</strong> {enc.vitals.spo2 < 92 && '⚠️ Hypoxia'}
                            </span>
                          )}
                          {enc.vitals.weightKg && (
                            <span
                              style={{
                                background: 'rgba(255, 255, 255, 0.05)',
                                border: '1px solid var(--border-subtle)',
                                padding: '0.25rem 0.55rem',
                                borderRadius: '6px',
                                fontSize: '0.78rem',
                                color: '#e2e8f0',
                              }}
                            >
                              Weight: <strong>{enc.vitals.weightKg}</strong> kg
                            </span>
                          )}
                        </div>
                      )}

                      {/* Symptoms Tags */}
                      {enc.symptoms && enc.symptoms.length > 0 && (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                          {enc.symptoms.map((s, idx) => (
                            <span
                              key={idx}
                              style={{
                                background: 'rgba(13, 148, 136, 0.12)',
                                border: '1px solid rgba(20, 184, 166, 0.25)',
                                padding: '0.2rem 0.5rem',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                color: '#5eead4',
                              }}
                            >
                              &bull; {s}
                            </span>
                          ))}
                        </div>
                      )}

                      {/* Clinical Notes */}
                      {enc.notes && (
                        <div
                          style={{
                            background: 'rgba(11, 17, 32, 0.8)',
                            padding: '0.65rem 0.85rem',
                            borderRadius: 'var(--radius-sm)',
                            fontSize: '0.825rem',
                            color: '#cbd5e1',
                            borderLeft: '3px solid #14b8a6',
                          }}
                        >
                          {enc.notes}
                        </div>
                      )}

                      {/* Step 7 Triage Staged Hook */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: '0.4rem', borderTop: '1px dashed rgba(255, 255, 255, 0.06)' }}>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          style={{ fontSize: '0.75rem', padding: '0.25rem 0.6rem', color: '#f59e0b', borderColor: 'rgba(245, 158, 11, 0.3)' }}
                          onClick={() => alert('Step 7 Digital Triage Rule Engine is coming up in Phase 2! This hook will compute risk levels and routing recommendations.')}
                        >
                          <Zap size={12} /> Run Digital Triage (Step 7)
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div
                style={{
                  textAlign: 'center',
                  padding: '2.5rem 1.5rem',
                  background: 'rgba(15, 23, 42, 0.4)',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--border-subtle)',
                }}
              >
                <Stethoscope size={36} color="#64748b" style={{ margin: '0 auto 0.75rem auto', opacity: 0.6 }} />
                <div style={{ fontWeight: '700', color: '#f8fafc' }}>
                  No Prior Encounters Recorded for this Patient
                </div>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-muted)', maxWidth: '420px', margin: '0.35rem auto 1.25rem auto' }}>
                  Start logging primary health assessments, triage vitals, and checklist symptoms to initiate the patient's continuity record.
                </div>

                <button
                  type="button"
                  className="btn btn-primary"
                  onClick={() => setEncounterModalOpen(true)}
                >
                  <Stethoscope size={15} /> + Record First Clinical Encounter
                </button>
              </div>
            )}
          </div>

          {/* Encounter Create Modal */}
          {encounterModalOpen && (
            <EncounterCreateModal
              patient={lookupResult.patient}
              onClose={() => setEncounterModalOpen(false)}
              onSuccess={handleEncounterCreated}
            />
          )}

          {/* Printable Card Modal */}
          {cardModalOpen && (
            <PatientCardModal
              patient={lookupResult.patient}
              qrCodeDataUrl={lookupResult.qrCodeDataUrl}
              age={lookupResult.age}
              onClose={() => setCardModalOpen(false)}
            />
          )}
        </div>
      ) : notFoundPhid ? (
        /* NOT FOUND VIEW */
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div
            className="card"
            style={{
              textAlign: 'center',
              padding: '3rem 2rem',
              border: '1px solid rgba(244, 63, 94, 0.3)',
              background: 'rgba(244, 63, 94, 0.05)',
            }}
          >
            <AlertTriangle size={48} color="#f43f5e" style={{ margin: '0 auto 1rem auto' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.5rem' }}>
              No Patient Record Found
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              No active patient record in the Maharashtra registry matches the scanned PHID:
            </p>

            <div
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '1.1rem',
                fontWeight: '900',
                color: '#f87171',
                background: 'rgba(15, 23, 42, 0.8)',
                padding: '0.5rem 1rem',
                borderRadius: '8px',
                display: 'inline-block',
                marginBottom: '1.75rem',
                border: '1px solid rgba(244, 63, 94, 0.3)',
              }}
            >
              {notFoundPhid}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={resetSearch} className="btn btn-outline">
                <RotateCcw size={14} /> Scan Another Code
              </button>
              {onNavigateToRegister && (
                <button onClick={onNavigateToRegister} className="btn btn-primary">
                  <UserPlus size={15} /> Register New Patient
                </button>
              )}
            </div>
          </div>
        </div>
      ) : (
        /* DEFAULT SCANNER & INPUT VIEW */
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          {lookupError && (
            <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
              <AlertTriangle size={18} />
              <div>{lookupError}</div>
            </div>
          )}

          <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
            {/* Left Box: Live Camera & File Upload QR Scanner */}
            <div className="card">
              <div className="card-header">
                <h3 className="card-title">
                  <QrCode size={19} color="#14b8a6" />
                  QR Code Scanner
                </h3>
                <p className="card-desc">
                  Point device camera at the patient's PHID card or upload a screenshot
                </p>
              </div>

              <QRScanner onScanSuccess={handleScanSuccess} />
            </div>

            {/* Right Box: Manual PHID Input & 1-Click Demo Chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Manual PHID Input Card */}
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <Search size={19} color="#06b6d4" />
                    Manual PHID Entry
                  </h3>
                  <p className="card-desc">
                    Enter the 16-character alphanumeric health code
                  </p>
                </div>

                <form onSubmit={handleManualSubmit}>
                  <div className="form-group">
                    <label className="form-label">Patient Health ID (PHID)</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder="e.g. MH-PUN-SC01-RYX5RE"
                      style={{ fontFamily: 'var(--font-mono)', fontSize: '0.95rem', textTransform: 'uppercase' }}
                      value={inputPhid}
                      onChange={(e) => setInputPhid(e.target.value.toUpperCase())}
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !inputPhid.trim()}
                    className="btn btn-primary"
                    style={{ width: '100%', padding: '0.75rem' }}
                  >
                    {loading ? 'Looking up...' : (
                      <>
                        Lookup Patient <ArrowRight size={15} />
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* 1-Click Demo Scan Presets */}
              {recentPatients.length > 0 && (
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div className="demo-title">
                    <Sparkles size={13} color="#14b8a6" />
                    1-Click Demo Patient Scans
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {recentPatients.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => {
                          setInputPhid(p.phid);
                          performLookup(p.phid, 'manual_entry');
                        }}
                        style={{
                          background: 'rgba(15, 23, 42, 0.7)',
                          border: '1px solid var(--border-subtle)',
                          padding: '0.5rem 0.75rem',
                          borderRadius: 'var(--radius-sm)',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          color: '#f8fafc',
                          textAlign: 'left',
                          transition: 'all 0.2s ease',
                        }}
                        onMouseOver={(e) => (e.currentTarget.style.borderColor = '#14b8a6')}
                        onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                      >
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.875rem' }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {p.registeredAtFacility?.name || 'Sub-Centre'}
                          </div>
                        </div>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.78rem',
                            color: '#22d3ee',
                          }}
                        >
                          {p.phid}
                        </span>
                      </button>
                    ))}

                    <button
                      type="button"
                      onClick={() => performLookup('MH-NSK-SC01-000000', 'manual_entry')}
                      style={{
                        background: 'rgba(244, 63, 94, 0.06)',
                        border: '1px dashed rgba(244, 63, 94, 0.3)',
                        padding: '0.45rem 0.75rem',
                        borderRadius: 'var(--radius-sm)',
                        color: '#fca5a5',
                        fontSize: '0.78rem',
                        textAlign: 'center',
                      }}
                    >
                      ⚠️ Test Invalid PHID Scan (404 State)
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
