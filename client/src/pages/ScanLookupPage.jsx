import React, { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import api from '../api/axios';
import { useAuthStore } from '../stores/authStore';
import { QRScanner } from '../components/QRScanner';
import { PatientCardModal } from '../components/PatientCardModal';
import {
  QrCode,
  Search,
  Hospital,
  AlertTriangle,
  CheckCircle2,
  Calendar,
  ArrowRight,
  Stethoscope,
  Globe,
  RotateCcw,
  UserPlus,
  Activity,
} from 'lucide-react';

export const ScanLookupPage = ({ onNavigateToRegister, onNavigateToTimeline }) => {
  const { t } = useTranslation();
  const { user } = useAuthStore();

  const [inputPhid, setInputPhid]       = useState('');
  const [loading, setLoading]           = useState(false);
  const [lookupError, setLookupError]   = useState(null);
  const [notFoundPhid, setNotFoundPhid] = useState(null);
  const [lookupResult, setLookupResult] = useState(null);
  const [cardModalOpen, setCardModalOpen] = useState(false);
  const [recentPatients, setRecentPatients] = useState([]);

  useEffect(() => {
    api.get('/patients')
      .then((res) => {
        if (res.data.success && res.data.patients.length > 0) {
          setRecentPatients(res.data.patients.slice(0, 4));
        }
      })
      .catch(() => {});
  }, []);

  const performLookup = async (phidToSearch, source = 'manual_entry') => {
    if (!phidToSearch?.trim()) {
      setLookupError(t('patient.phidLabel') + ' — required');
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
      const status = err.response?.status || err.status;
      if (status === 404) {
        setNotFoundPhid(cleanPhid);
      } else if (status === 401) {
        setLookupError('Session expired — please log in again.');
      } else {
        setLookupError(
          err.response?.data?.message || err.message || 'Error looking up patient record'
        );
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

  const formatDate = (dateStr) => {
    if (!dateStr) return t('common.na');
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
    });
  };

  return (
    <div className="main-content">
      {/* Top banner */}
      <div
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          flexWrap: 'wrap', gap: '1rem', marginBottom: '1.5rem',
        }}
      >
        <div>
          <h1 style={{ fontSize: '1.75rem', fontWeight: '800', letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            <QrCode size={26} color="#14b8a6" />
            {t('patient.lookup')}
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            {t('patient.lookupDesc')}
          </p>
        </div>

        {/* Scanning facility context */}
        <div
          style={{
            background: 'rgba(15,23,42,0.8)', border: '1px solid var(--border-subtle)',
            padding: '0.5rem 0.9rem', borderRadius: 'var(--radius-full)',
            display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.825rem',
          }}
        >
          <Hospital size={15} color="#06b6d4" />
          <span>
            {t('nav.scanningAt')}{' '}
            <strong style={{ color: '#ffffff' }}>{user?.facility?.name || 'Local Health Facility'}</strong>{' '}
            <span style={{ color: '#22d3ee', fontFamily: 'var(--font-mono)' }}>
              [{user?.facility?.shortCode || 'FAC'}]
            </span>
          </span>
        </div>
      </div>

      {/* ── FOUND ── */}
      {lookupResult ? (
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div
            className="card"
            style={{
              background: lookupResult.scanContext?.isCrossFacility
                ? 'linear-gradient(135deg, rgba(59,130,246,0.18) 0%, rgba(139,92,246,0.12) 100%)'
                : 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(6,182,212,0.12) 100%)',
              border: lookupResult.scanContext?.isCrossFacility
                ? '1px solid rgba(59,130,246,0.4)'
                : '1px solid rgba(16,185,129,0.4)',
              padding: '1.5rem',
            }}
          >
            {/* Status line */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1.25rem' }}>
              <div
                style={{
                  width: '42px', height: '42px', borderRadius: '11px', flexShrink: 0,
                  background: lookupResult.scanContext?.isCrossFacility
                    ? 'linear-gradient(135deg, #3b82f6 0%, #8b5cf6 100%)'
                    : 'linear-gradient(135deg, #10b981 0%, #06b6d4 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {lookupResult.scanContext?.isCrossFacility
                  ? <Globe size={22} color="#ffffff" />
                  : <CheckCircle2 size={22} color="#ffffff" />}
              </div>
              <div>
                <div style={{ fontWeight: '800', fontSize: '1rem', color: '#ffffff' }}>
                  {lookupResult.scanContext?.isCrossFacility
                    ? 'Cross-Facility Patient Verified'
                    : 'Local Patient Verified'}
                </div>
                <div style={{ fontSize: '0.8rem', color: '#cbd5e1', marginTop: '1px' }}>
                  {lookupResult.scanContext?.isCrossFacility
                    ? `${t('patient.enrolledAt')} ${lookupResult.patient.registeredAtFacility?.name || 'another facility'}`
                    : `${t('patient.enrolledAt')} ${lookupResult.patient.registeredAtFacility?.name}`}
                </div>
              </div>
            </div>

            {/* Patient identity */}
            <div style={{ marginBottom: '1.25rem' }}>
              <div style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff' }}>
                {lookupResult.patient.name}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginTop: '0.35rem', flexWrap: 'wrap' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-mono)', fontWeight: '800', fontSize: '0.875rem',
                    color: '#22d3ee', background: 'rgba(6,182,212,0.12)',
                    padding: '0.2rem 0.6rem', borderRadius: '6px',
                    border: '1px solid rgba(6,182,212,0.3)',
                  }}
                >
                  {lookupResult.patient.phid}
                </span>
                {lookupResult.age !== null && lookupResult.age !== undefined && (
                  <span style={{ fontSize: '0.82rem', color: '#cbd5e1' }}>
                    {t('patient.age', { age: lookupResult.age })} ·{' '}
                    <span style={{ textTransform: 'capitalize' }}>{lookupResult.patient.gender || 'unknown'}</span>
                  </span>
                )}
                {lookupResult.patient.dob && (
                  <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                    <Calendar size={12} style={{ display: 'inline', marginRight: '3px', verticalAlign: 'middle' }} />
                    {formatDate(lookupResult.patient.dob)}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', marginTop: '0.5rem' }}>
                <Hospital size={13} color="#06b6d4" />
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {lookupResult.patient.registeredAtFacility?.name}{' '}
                  <span style={{ color: 'var(--text-muted)' }}>
                    · {lookupResult.patient.registeredAtFacility?.district}
                  </span>
                </span>
              </div>
              {lookupResult.encounterCount !== undefined && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', marginTop: '0.4rem' }}>
                  <Stethoscope size={13} color="#14b8a6" />
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {lookupResult.encounterCount === 1
                      ? t('patient.priorEncounters', { count: lookupResult.encounterCount })
                      : t('patient.priorEncounters_plural', { count: lookupResult.encounterCount })}
                    {' '}{t('common.note') === 'Note' ? 'on record' : ''}
                  </span>
                </div>
              )}
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem' }}>
              <button
                className="btn btn-primary"
                style={{ width: '100%', padding: '0.75rem', fontSize: '0.925rem' }}
                onClick={() => onNavigateToTimeline(lookupResult.patient.phid)}
              >
                <Activity size={16} />
                {t('patient.openTimeline')}
                <ArrowRight size={15} />
              </button>

              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button
                  onClick={() => setCardModalOpen(true)}
                  className="btn btn-outline btn-sm"
                  style={{ flex: 1 }}
                >
                  <QrCode size={13} /> {t('patient.viewCard')}
                </button>
                <button
                  onClick={resetSearch}
                  className="btn btn-outline btn-sm"
                  style={{ flex: 1 }}
                >
                  <RotateCcw size={13} /> {t('patient.scanAnother')}
                </button>
              </div>
            </div>
          </div>

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
        /* ── NOT FOUND ── */
        <div style={{ maxWidth: '640px', margin: '0 auto' }}>
          <div
            className="card"
            style={{
              textAlign: 'center', padding: '3rem 2rem',
              border: '1px solid rgba(244,63,94,0.3)',
              background: 'rgba(244,63,94,0.05)',
            }}
          >
            <AlertTriangle size={48} color="#f43f5e" style={{ margin: '0 auto 1rem auto' }} />
            <h2 style={{ fontSize: '1.4rem', fontWeight: '800', color: '#ffffff', marginBottom: '0.5rem' }}>
              {t('patient.notFound')}
            </h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              {t('patient.notFoundDesc')}
            </p>
            <div
              style={{
                fontFamily: 'var(--font-mono)', fontSize: '1.1rem', fontWeight: '900',
                color: '#f87171', background: 'rgba(15,23,42,0.8)',
                padding: '0.5rem 1rem', borderRadius: '8px',
                display: 'inline-block', marginBottom: '1.75rem',
                border: '1px solid rgba(244,63,94,0.3)',
              }}
            >
              {notFoundPhid}
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button onClick={resetSearch} className="btn btn-outline">
                <RotateCcw size={14} /> {t('patient.scanAnother')}
              </button>
              {onNavigateToRegister && (
                <button onClick={onNavigateToRegister} className="btn btn-primary">
                  <UserPlus size={14} /> {t('patient.registerNew')}
                </button>
              )}
            </div>
          </div>
        </div>

      ) : (
        /* ── DEFAULT: scanner + manual input ── */
        <div style={{ maxWidth: '840px', margin: '0 auto' }}>
          {lookupError && (
            <div className="alert alert-error" style={{ marginBottom: '1.25rem' }}>
              <AlertTriangle size={18} />
              <div>{lookupError}</div>
            </div>
          )}

          <div className="grid-2" style={{ gap: '1.5rem', alignItems: 'start' }}>
            {/* Left: QR scanner */}
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

            {/* Right: manual input + demo chips */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="card">
                <div className="card-header">
                  <h3 className="card-title">
                    <Search size={19} color="#06b6d4" />
                    Manual PHID Entry
                  </h3>
                  <p className="card-desc">Enter the alphanumeric health code</p>
                </div>
                <form onSubmit={handleManualSubmit}>
                  <div className="form-group">
                    <label className="form-label">{t('patient.phidLabel')}</label>
                    <input
                      type="text"
                      className="form-input"
                      placeholder={t('patient.phidPlaceholder')}
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
                    {loading
                      ? t('patient.lookingUp')
                      : <><span>{t('patient.lookupBtn')}</span> <ArrowRight size={15} /></>}
                  </button>
                </form>
              </div>

              {recentPatients.length > 0 && (
                <div className="card" style={{ padding: '1.25rem' }}>
                  <div className="demo-title">
                    <Stethoscope size={13} color="#14b8a6" />
                    1-Click Demo Patient Scans
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem' }}>
                    {recentPatients.map((p) => (
                      <button
                        key={p._id}
                        type="button"
                        onClick={() => { setInputPhid(p.phid); performLookup(p.phid, 'manual_entry'); }}
                        disabled={loading}
                        style={{
                          background: 'rgba(15,23,42,0.7)', border: '1px solid var(--border-subtle)',
                          padding: '0.5rem 0.75rem', borderRadius: 'var(--radius-sm)',
                          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                          color: '#f8fafc', textAlign: 'left', transition: 'all 0.2s ease',
                          opacity: loading ? 0.6 : 1,
                        }}
                        onMouseOver={(e) => { if (!loading) e.currentTarget.style.borderColor = '#14b8a6'; }}
                        onMouseOut={(e) => (e.currentTarget.style.borderColor = 'var(--border-subtle)')}
                      >
                        <div>
                          <div style={{ fontWeight: '700', fontSize: '0.875rem' }}>{p.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                            {p.registeredAtFacility?.name || 'Sub-Centre'}
                          </div>
                        </div>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '0.78rem', color: '#22d3ee' }}>
                          {loading && inputPhid === p.phid ? t('common.loading') : p.phid}
                        </span>
                      </button>
                    ))}
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
