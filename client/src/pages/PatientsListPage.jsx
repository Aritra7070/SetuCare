import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import { PatientCardModal } from '../components/PatientCardModal';
import {
  Users,
  Search,
  QrCode,
  Edit2,
  Calendar,
  Phone,
  MapPin,
  Hospital,
  RefreshCw,
  Plus,
  CheckCircle2,
  X,
  AlertTriangle,
} from 'lucide-react';

export const PatientsListPage = ({ onNavigateToRegister }) => {
  const [patients, setPatients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedGender, setSelectedGender] = useState('');

  // Selected patient for QR Card Modal
  const [selectedCardPatient, setSelectedCardPatient] = useState(null);
  const [cardQrDataUrl, setCardQrDataUrl] = useState(null);
  const [cardAge, setCardAge] = useState(null);
  const [cardLoading, setCardLoading] = useState(false);

  // Edit Modal State
  const [editingPatient, setEditingPatient] = useState(null);
  const [editFormData, setEditFormData] = useState({
    name: '',
    dob: '',
    gender: 'female',
    guardianName: '',
    phone: '',
    address: '',
    preferredLanguage: 'mr',
  });
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState(null);
  const [actionSuccess, setActionSuccess] = useState(null);

  const fetchPatients = async () => {
    try {
      setLoading(true);
      const params = {};
      if (searchTerm) params.search = searchTerm;
      if (selectedGender) params.gender = selectedGender;

      const res = await api.get('/patients', { params });
      if (res.data.success) {
        setPatients(res.data.patients);
      }
    } catch (err) {
      console.error('Failed to load patients:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [selectedGender]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchPatients();
  };

  const openCardModal = async (patientId) => {
    try {
      setCardLoading(true);
      const res = await api.get(`/patients/${patientId}/card`);
      if (res.data.success) {
        setSelectedCardPatient(res.data.patient);
        setCardQrDataUrl(res.data.qrCodeDataUrl);
        setCardAge(res.data.age);
      }
    } catch (err) {
      alert('Failed to load card: ' + err.message);
    } finally {
      setCardLoading(false);
    }
  };

  const openEditModal = (patient) => {
    setEditingPatient(patient);
    setEditFormData({
      name: patient.name || '',
      dob: patient.dob ? new Date(patient.dob).toISOString().split('T')[0] : '',
      gender: patient.gender || 'female',
      guardianName: patient.guardianName || '',
      phone: patient.phone || '',
      address: patient.address || '',
      preferredLanguage: patient.preferredLanguage || 'mr',
    });
    setEditError(null);
  };

  const handleEditSave = async (e) => {
    e.preventDefault();
    setEditSaving(true);
    setEditError(null);

    try {
      await api.patch(`/patients/${editingPatient._id}`, editFormData);
      setActionSuccess(`Demographics for '${editFormData.name}' updated!`);
      setEditingPatient(null);
      fetchPatients();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setEditError(err.message);
    } finally {
      setEditSaving(false);
    }
  };

  const calculateAge = (dob) => {
    if (!dob) return 'N/A';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return `${age} yrs`;
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
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
            <Users size={26} color="#14b8a6" />
            Registered Patients Directory
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Master Patient Index for your facility and stepped-care referral network.
          </p>
        </div>

        <button onClick={onNavigateToRegister} className="btn btn-primary btn-sm">
          <Plus size={15} /> Register New Patient
        </button>
      </div>

      {actionSuccess && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <div>{actionSuccess}</div>
        </div>
      )}

      {/* Filter / Search Bar */}
      <div
        className="card"
        style={{
          padding: '1rem 1.25rem',
          marginBottom: '1.5rem',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '1rem',
        }}
      >
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: '1 1 280px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              placeholder="Search by Name, PHID (e.g. MH-NSK-...), or Phone..."
              className="form-input"
              style={{ paddingLeft: '2.25rem' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <Search size={15} color="#64748b" style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)' }} />
          </div>
          <button type="submit" className="btn btn-outline btn-sm">
            Search
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
            value={selectedGender}
            onChange={(e) => setSelectedGender(e.target.value)}
          >
            <option value="">All Genders</option>
            <option value="female">Female</option>
            <option value="male">Male</option>
            <option value="other">Other</option>
          </select>

          <button onClick={fetchPatients} className="btn btn-outline btn-sm" title="Refresh List">
            <RefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Patient Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
          <div>Loading registered patients...</div>
        </div>
      ) : (
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.875rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem' }}>Patient Name & PHID</th>
                <th style={{ padding: '1rem' }}>Age / Gender</th>
                <th style={{ padding: '1rem' }}>Guardian (Minor)</th>
                <th style={{ padding: '1rem' }}>Contact & Village</th>
                <th style={{ padding: '1rem' }}>Registered Facility</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {patients.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
                    No patients registered yet. Click "Register New Patient" to register the first patient!
                  </td>
                </tr>
              ) : (
                patients.map((p) => (
                  <tr key={p._id} style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '700', color: '#f8fafc', fontSize: '0.95rem' }}>
                        {p.name}
                      </div>
                      <div style={{ marginTop: '3px' }}>
                        <span
                          style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: '0.8rem',
                            color: '#22d3ee',
                            background: 'rgba(6, 182, 212, 0.1)',
                            padding: '0.15rem 0.45rem',
                            borderRadius: '4px',
                            border: '1px solid rgba(6, 182, 212, 0.25)',
                          }}
                        >
                          {p.phid}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600', color: '#e2e8f0' }}>
                        {calculateAge(p.dob)}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', textTransform: 'capitalize' }}>
                        {p.gender} &bull; DOB: {formatDate(p.dob)}
                      </div>
                    </td>

                    <td style={{ padding: '1rem', color: p.guardianName ? '#fde68a' : 'var(--text-muted)' }}>
                      {p.guardianName || '— (Adult)'}
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <div style={{ color: '#f1f5f9' }}>{p.phone || 'No phone'}</div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {p.address || 'Maharashtra'}
                      </div>
                    </td>

                    <td style={{ padding: '1rem' }}>
                      <div style={{ fontWeight: '600', color: '#38bdf8' }}>
                        {p.registeredAtFacility?.name || 'Local Facility'}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                        {p.registeredAtFacility?.district} &bull;{' '}
                        <span style={{ textTransform: 'uppercase' }}>
                          {p.registeredAtFacility?.tier?.replace('_', ' ')}
                        </span>
                      </div>
                    </td>

                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => openCardModal(p._id)}
                          className="btn btn-primary btn-sm"
                          style={{ padding: '0.35rem 0.7rem' }}
                          title="View / Print PHID QR Card"
                        >
                          <QrCode size={13} /> Card
                        </button>
                        <button
                          onClick={() => openEditModal(p)}
                          className="btn btn-outline btn-sm"
                          style={{ padding: '0.35rem 0.6rem' }}
                          title="Edit Demographics"
                        >
                          <Edit2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Patient Health Card Modal */}
      {selectedCardPatient && (
        <PatientCardModal
          patient={selectedCardPatient}
          qrCodeDataUrl={cardQrDataUrl}
          age={cardAge}
          onClose={() => {
            setSelectedCardPatient(null);
            setCardQrDataUrl(null);
            setCardAge(null);
          }}
        />
      )}

      {/* Demographic Edit Modal */}
      {editingPatient && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(4px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: '1.5rem',
          }}
        >
          <div
            className="card"
            style={{
              width: '100%',
              maxWidth: '540px',
              border: '1px solid var(--border-focus)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: '800' }}>
                  Edit Patient Demographics
                </h3>
                <div style={{ fontSize: '0.8rem', color: '#22d3ee', fontFamily: 'var(--font-mono)' }}>
                  PHID: {editingPatient.phid}
                </div>
              </div>
              <button
                onClick={() => setEditingPatient(null)}
                style={{ background: 'none', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {editError && (
              <div className="alert alert-error">
                <AlertTriangle size={16} />
                <div>{editError}</div>
              </div>
            )}

            <form onSubmit={handleEditSave}>
              <div className="form-group">
                <label className="form-label">Full Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  value={editFormData.name}
                  onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
                />
              </div>

              <div className="grid-2" style={{ gap: '0.9rem' }}>
                <div className="form-group">
                  <label className="form-label">Date of Birth</label>
                  <input
                    type="date"
                    className="form-input"
                    value={editFormData.dob}
                    onChange={(e) => setEditFormData({ ...editFormData, dob: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Gender</label>
                  <select
                    className="form-select"
                    value={editFormData.gender}
                    onChange={(e) => setEditFormData({ ...editFormData, gender: e.target.value })}
                  >
                    <option value="female">Female</option>
                    <option value="male">Male</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Parent / Guardian Name (if Minor)</label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Guardian name"
                  value={editFormData.guardianName}
                  onChange={(e) => setEditFormData({ ...editFormData, guardianName: e.target.value })}
                />
              </div>

              <div className="grid-2" style={{ gap: '0.9rem' }}>
                <div className="form-group">
                  <label className="form-label">Phone</label>
                  <input
                    type="tel"
                    className="form-input"
                    value={editFormData.phone}
                    onChange={(e) => setEditFormData({ ...editFormData, phone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Language</label>
                  <select
                    className="form-select"
                    value={editFormData.preferredLanguage}
                    onChange={(e) => setEditFormData({ ...editFormData, preferredLanguage: e.target.value })}
                  >
                    <option value="mr">Marathi</option>
                    <option value="hi">Hindi</option>
                    <option value="en">English</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Address</label>
                <input
                  type="text"
                  className="form-input"
                  value={editFormData.address}
                  onChange={(e) => setEditFormData({ ...editFormData, address: e.target.value })}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.25rem' }}>
                <button
                  type="button"
                  onClick={() => setEditingPatient(null)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="btn btn-primary"
                >
                  {editSaving ? 'Saving...' : 'Save Demographics'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
