import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import api from '../api/axios';
import { UserPlus, Activity, ArrowRight, AlertCircle, Building2 } from 'lucide-react';

export const RegisterPage = ({ onSwitchToLogin }) => {
  const { register, loading, error, clearError } = useAuthStore();

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    role: 'frontline_worker',
    facility: '',
    phone: '',
    preferredLanguage: 'mr',
  });

  const [facilities, setFacilities] = useState([]);
  const [loadingFacilities, setLoadingFacilities] = useState(true);

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const res = await api.get('/facilities');
        if (res.data.success && res.data.facilities) {
          setFacilities(res.data.facilities);
          // Set initial default facility
          if (res.data.facilities.length > 0) {
            setFormData((prev) => ({
              ...prev,
              facility: res.data.facilities[0]._id,
            }));
          }
        }
      } catch (err) {
        console.error('Failed to load facilities:', err);
      } finally {
        setLoadingFacilities(false);
      }
    };

    fetchFacilities();
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearError();

    const payload = { ...formData };
    if (payload.role === 'admin' && !payload.facility) {
      delete payload.facility;
    }

    await register(payload);
  };

  const roles = [
    { value: 'frontline_worker', label: 'ASHA / Frontline Worker' },
    { value: 'medical_officer', label: 'Medical Officer (PHC)' },
    { value: 'specialist', label: 'Specialist (DH / Rural Hospital)' },
    { value: 'program_manager', label: 'Program Manager (District)' },
    { value: 'admin', label: 'System Administrator' },
  ];

  return (
    <div className="auth-wrapper">
      <div className="auth-card" style={{ maxWidth: '520px' }}>
        <div className="auth-header">
          <div style={{ display: 'inline-flex', padding: '0.6rem', background: 'rgba(13, 148, 136, 0.15)', borderRadius: 'var(--radius-md)', marginBottom: '0.75rem', color: '#14b8a6' }}>
            <UserPlus size={28} />
          </div>
          <h2>Create SetuCare Account</h2>
          <p>Register a healthcare professional or administrator</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <AlertCircle size={18} />
            <div>{error}</div>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="grid-2" style={{ gap: '0.9rem' }}>
            <div className="form-group">
              <label className="form-label">Full Name</label>
              <input
                type="text"
                name="name"
                required
                className="form-input"
                placeholder="e.g. Smt. Asha Shinde"
                value={formData.name}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Work Email</label>
              <input
                type="email"
                name="email"
                required
                className="form-input"
                placeholder="name@setucare.in"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="grid-2" style={{ gap: '0.9rem' }}>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input
                type="password"
                name="password"
                required
                minLength={6}
                className="form-input"
                placeholder="Min 6 characters"
                value={formData.password}
                onChange={handleChange}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Phone Number</label>
              <input
                type="tel"
                name="phone"
                className="form-input"
                placeholder="+91-9876543210"
                value={formData.phone}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Clinical / System Role</label>
            <select
              name="role"
              className="form-select"
              value={formData.role}
              onChange={handleChange}
            >
              {roles.map((r) => (
                <option key={r.value} value={r.value}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>

          {formData.role !== 'admin' && (
            <div className="form-group">
              <label className="form-label">Assigned Health Facility</label>
              <select
                name="facility"
                required
                className="form-select"
                value={formData.facility}
                onChange={handleChange}
                disabled={loadingFacilities}
              >
                {loadingFacilities ? (
                  <option>Loading facilities...</option>
                ) : facilities.length === 0 ? (
                  <option value="">No facilities available</option>
                ) : (
                  facilities.map((f) => (
                    <option key={f._id} value={f._id}>
                      {f.name} ({f.tier.toUpperCase()} — {f.district})
                    </option>
                  ))
                )}
              </select>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Preferred Interface Language</label>
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

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.5rem' }}
          >
            {loading ? (
              'Creating Account...'
            ) : (
              <>
                Register & Sign In <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Already have an account?{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            style={{ background: 'none', color: '#22d3ee', fontWeight: '600', textDecoration: 'underline' }}
          >
            Sign In Here
          </button>
        </div>
      </div>
    </div>
  );
};
