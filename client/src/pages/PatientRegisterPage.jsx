import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import api from '../api/axios';
import { PatientCardModal } from '../components/PatientCardModal';
import {
  UserPlus,
  Hospital,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  CheckCircle2,
  Calendar,
  Phone,
  MapPin,
  Globe,
  User,
} from 'lucide-react';

export const PatientRegisterPage = ({ onNavigateToList }) => {
  const { user } = useAuthStore();

  const [formData, setFormData] = useState({
    name: '',
    dob: '',
    gender: 'female',
    guardianName: '',
    phone: '',
    address: '',
    preferredLanguage: 'mr',
  });

  const [calculatedAge, setCalculatedAge] = useState(null);
  const [isMinor, setIsMinor] = useState(false);

  // Duplicate Check State
  const [duplicateCandidates, setDuplicateCandidates] = useState([]);
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);

  // Form submission state
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState(null);
  const [registeredPatient, setRegisteredPatient] = useState(null);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState(null);

  // Recalculate age whenever DOB changes
  useEffect(() => {
    if (!formData.dob) {
      setCalculatedAge(null);
      setIsMinor(false);
      return;
    }
    const birthDate = new Date(formData.dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    setCalculatedAge(age);
    setIsMinor(age >= 0 && age < 18);
  }, [formData.dob]);

  // Debounced duplicate soft-check
  useEffect(() => {
    const timer = setTimeout(async () => {
      if ((formData.name && formData.dob) || (formData.phone && formData.phone.length >= 8)) {
        try {
          setCheckingDuplicates(true);
          const params = {};
          if (formData.name) params.name = formData.name;
          if (formData.dob) params.dob = formData.dob;
          if (formData.phone) params.phone = formData.phone;

          const res = await api.get('/patients/check-duplicate', { params });
          if (res.data.success && res.data.duplicateFound) {
            setDuplicateCandidates(res.data.candidates);
          } else {
            setDuplicateCandidates([]);
          }
        } catch (err) {
          console.error('Duplicate check error:', err);
        } finally {
          setCheckingDuplicates(false);
        }
      } else {
        setDuplicateCandidates([]);
      }
    }, 450);

    return () => clearTimeout(timer);
  }, [formData.name, formData.dob, formData.phone]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleDemoFill = (type) => {
    setFormError(null);
    if (type === 'adult') {
      setFormData({
        name: 'Sunita Anand Rao',
        dob: '1994-08-14',
        gender: 'female',
        guardianName: '',
        phone: '+91-9822114455',
        address: 'Pabal Village, Shirur Taluka',
        preferredLanguage: 'mr',
      });
    } else if (type === 'minor') {
      setFormData({
        name: 'Aarav Suresh Patil',
        dob: '2019-03-10', // 7 years old
        gender: 'male',
        guardianName: 'Suresh Patil (Father)',
        phone: '+91-9822001122',
        address: 'Vaitarna Village, Igatpuri Taluka',
        preferredLanguage: 'mr',
      });
    } else if (type === 'duplicate') {
      setFormData({
        name: 'Aarav Patil',
        dob: '2018-06-15',
        gender: 'male',
        guardianName: 'Suresh Patil',
        phone: '+91-9822001122',
        address: 'Vaitarna Village',
        preferredLanguage: 'mr',
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError(null);

    if (isMinor && (!formData.guardianName || !formData.guardianName.trim())) {
      setFormError('Guardian name is mandatory for minors under 18 years of age.');
      return;
    }

    try {
      setSubmitting(true);
      const res = await api.post('/patients', formData);
      if (res.data.success && res.data.patient) {
        setRegisteredPatient(res.data.patient);
        setQrCodeDataUrl(res.data.qrCodeDataUrl);
      }
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSubmitting(false);
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
            <UserPlus size={26} color="#14b8a6" />
            Patient Registration & PHID Issuance
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Register new patient demographics and generate an offline-scannable QR health card.
          </p>
        </div>

        {/* Facility Auto-Stamp Indicator */}
        <div
          style={{
            background: 'rgba(13, 148, 136, 0.15)',
            border: '1px solid rgba(20, 184, 166, 0.3)',
            padding: '0.5rem 0.9rem',
            borderRadius: 'var(--radius-full)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.6rem',
          }}
        >
          <Hospital size={16} color="#14b8a6" />
          <div style={{ fontSize: '0.825rem' }}>
            Registering at:{' '}
            <strong style={{ color: '#ffffff' }}>
              {user?.facility?.name || 'Assigned Health Facility'}
            </strong>{' '}
            <span style={{ color: '#22d3ee', fontFamily: 'var(--font-mono)' }}>
              [{user?.facility?.shortCode || 'SC01'}]
            </span>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: '780px', margin: '0 auto' }}>
        {/* Soft Duplicate Warning Banner */}
        {duplicateCandidates.length > 0 && (
          <div
            className="alert alert-error"
            style={{
              background: 'rgba(245, 158, 11, 0.12)',
              borderColor: 'rgba(245, 158, 11, 0.35)',
              color: '#fef3c7',
              marginBottom: '1.5rem',
            }}
          >
            <AlertTriangle size={22} color="#f59e0b" style={{ flexShrink: 0 }} />
            <div style={{ width: '100%' }}>
              <div style={{ fontWeight: '700', fontSize: '0.95rem', color: '#fbbf24' }}>
                Soft Duplicate Match Warning
              </div>
              <div style={{ fontSize: '0.85rem', color: '#fef3c7', marginTop: '0.2rem' }}>
                The following existing patient(s) share a similar name/DOB or identical phone number. You may still proceed if this is a new patient:
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', marginTop: '0.6rem' }}>
                {duplicateCandidates.map((c) => (
                  <div
                    key={c._id}
                    style={{
                      background: 'rgba(15, 23, 42, 0.6)',
                      padding: '0.4rem 0.75rem',
                      borderRadius: '6px',
                      border: '1px solid rgba(245, 158, 11, 0.2)',
                      fontSize: '0.825rem',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                    }}
                  >
                    <div>
                      <strong>{c.name}</strong> &bull; PHID: <span style={{ fontFamily: 'var(--font-mono)', color: '#38bdf8' }}>{c.phid}</span> &bull; Facility: {c.facility}
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: '600' }}>
                      {c.matchReason}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {formError && (
          <div className="alert alert-error">
            <AlertTriangle size={18} />
            <div>{formError}</div>
          </div>
        )}

        {/* Registration Form Card */}
        <div className="card">
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label className="form-label">
                Patient Full Name <span style={{ color: '#f43f5e' }}>*</span>
              </label>
              <input
                type="text"
                name="name"
                required
                className="form-input"
                placeholder="e.g. Smt. Sunita Rao"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="grid-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">
                  Date of Birth{' '}
                  {calculatedAge !== null && (
                    <span
                      className="tag-badge"
                      style={{
                        marginLeft: '0.5rem',
                        background: isMinor ? 'rgba(245, 158, 11, 0.2)' : 'rgba(16, 185, 129, 0.2)',
                        color: isMinor ? '#fbbf24' : '#34d399',
                      }}
                    >
                      {calculatedAge} yrs old &bull; {isMinor ? 'Minor' : 'Adult'}
                    </span>
                  )}
                </label>
                <input
                  type="date"
                  name="dob"
                  className="form-input"
                  value={formData.dob}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Gender</label>
                <select
                  name="gender"
                  className="form-select"
                  value={formData.gender}
                  onChange={handleChange}
                >
                  <option value="female">Female (स्त्री)</option>
                  <option value="male">Male (पुरुष)</option>
                  <option value="other">Other (इतर)</option>
                </select>
              </div>
            </div>

            {/* Minor Guardian Field (Dynamically Required/Highlighted if Minor) */}
            {isMinor && (
              <div
                className="form-group"
                style={{
                  background: 'rgba(245, 158, 11, 0.08)',
                  padding: '0.9rem',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid rgba(245, 158, 11, 0.25)',
                }}
              >
                <label className="form-label" style={{ color: '#fde68a' }}>
                  Parent / Guardian Name <span style={{ color: '#f43f5e' }}>* Required for Minors</span>
                </label>
                <input
                  type="text"
                  name="guardianName"
                  required={isMinor}
                  className="form-input"
                  placeholder="e.g. Suresh Patil (Father / Mother / Guardian)"
                  value={formData.guardianName}
                  onChange={handleChange}
                />
              </div>
            )}

            <div className="grid-2" style={{ gap: '1rem' }}>
              <div className="form-group">
                <label className="form-label">Mobile Phone Number</label>
                <input
                  type="tel"
                  name="phone"
                  className="form-input"
                  placeholder="+91-9876543210"
                  value={formData.phone}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Preferred Communication Language</label>
                <select
                  name="preferredLanguage"
                  className="form-select"
                  value={formData.preferredLanguage}
                  onChange={handleChange}
                >
                  <option value="mr">मराठी (Marathi - Primary)</option>
                  <option value="hi">हिंदी (Hindi)</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Village / Taluka / Residential Address</label>
              <textarea
                name="address"
                rows={2}
                className="form-input"
                placeholder="e.g. Pabal Village, Shirur Taluka, Pune District"
                value={formData.address}
                onChange={handleChange}
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="btn btn-primary"
              style={{ width: '100%', marginTop: '0.75rem', padding: '0.85rem' }}
            >
              {submitting ? (
                'Issuing PHID & Generating QR Card...'
              ) : (
                <>
                  Register Patient & Issue PHID Card <ArrowRight size={16} />
                </>
              )}
            </button>
          </form>

          {/* Quick Demo Autofill Chips */}
          <div className="demo-accounts" style={{ marginTop: '1.75rem' }}>
            <div className="demo-title">
              <Sparkles size={13} color="#14b8a6" />
              Quick Demo Patient Presets
            </div>
            <div className="demo-chips">
              <button
                type="button"
                className="demo-chip"
                onClick={() => handleDemoFill('adult')}
              >
                👩 Adult: Sunita Rao (30yo)
              </button>
              <button
                type="button"
                className="demo-chip"
                onClick={() => handleDemoFill('minor')}
              >
                👦 Minor: Aarav Patil (7yo with Guardian)
              </button>
              <button
                type="button"
                className="demo-chip"
                onClick={() => handleDemoFill('duplicate')}
              >
                ⚠️ Test Duplicate Trigger
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Patient Digital Health Card Modal */}
      {registeredPatient && (
        <PatientCardModal
          patient={registeredPatient}
          qrCodeDataUrl={qrCodeDataUrl}
          age={calculatedAge}
          onClose={() => {
            setRegisteredPatient(null);
            setFormData({
              name: '',
              dob: '',
              gender: 'female',
              guardianName: '',
              phone: '',
              address: '',
              preferredLanguage: 'mr',
            });
            if (onNavigateToList) onNavigateToList();
          }}
        />
      )}
    </div>
  );
};
