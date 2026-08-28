import React, { useState, useEffect } from 'react';
import api from '../api/axios';
import {
  Hospital,
  Building2,
  Plus,
  Edit2,
  Trash2,
  RefreshCw,
  Search,
  Filter,
  Layers,
  ChevronRight,
  ChevronDown,
  CheckCircle2,
  AlertTriangle,
  MapPin,
  Phone,
  RotateCcw,
  X,
} from 'lucide-react';

export const AdminFacilitiesPage = () => {
  const [facilities, setFacilities] = useState([]);
  const [treeData, setTreeData] = useState([]);
  const [orphanedData, setOrphanedData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'tree'
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTier, setSelectedTier] = useState('');
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);

  // Modal State
  const [modalOpen, setModalOpen] = useState(false);
  const [editingFacility, setEditingFacility] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    tier: 'sub_centre',
    parentFacility: '',
    district: 'Nashik',
    state: 'Maharashtra',
    lat: '',
    lng: '',
    contactPhone: '',
    active: true,
  });
  const [modalError, setModalError] = useState(null);
  const [modalSaving, setModalSaving] = useState(false);
  const [actionSuccess, setActionSuccess] = useState(null);

  // Tree expanded nodes state
  const [expandedNodes, setExpandedNodes] = useState({});

  const fetchFacilities = async () => {
    try {
      setLoading(true);
      const params = {};
      if (includeInactive) params.includeInactive = 'true';
      if (selectedTier) params.tier = selectedTier;
      if (selectedDistrict) params.district = selectedDistrict;
      if (searchTerm) params.search = searchTerm;

      const [listRes, treeRes] = await Promise.all([
        api.get('/facilities', { params }),
        api.get('/facilities/tree', {
          params: includeInactive ? { includeInactive: 'true' } : {},
        }),
      ]);

      if (listRes.data.success) {
        setFacilities(listRes.data.facilities);
      }
      if (treeRes.data.success) {
        setTreeData(treeRes.data.tree);
        setOrphanedData(treeRes.data.orphaned || []);
        // Auto-expand all root nodes by default
        const initialExpanded = {};
        treeRes.data.tree.forEach((r) => {
          initialExpanded[r._id] = true;
          (r.children || []).forEach((c) => {
            initialExpanded[c._id] = true;
          });
        });
        setExpandedNodes((prev) => ({ ...initialExpanded, ...prev }));
      }
    } catch (err) {
      console.error('Failed to load facilities:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFacilities();
  }, [selectedTier, selectedDistrict, includeInactive]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchFacilities();
  };

  const toggleNode = (nodeId) => {
    setExpandedNodes((prev) => ({
      ...prev,
      [nodeId]: !prev[nodeId],
    }));
  };

  const openCreateModal = () => {
    setEditingFacility(null);
    setFormData({
      name: '',
      tier: 'sub_centre',
      parentFacility: '',
      district: 'Nashik',
      state: 'Maharashtra',
      lat: '',
      lng: '',
      contactPhone: '',
      active: true,
    });
    setModalError(null);
    setModalOpen(true);
  };

  const openEditModal = (facility) => {
    setEditingFacility(facility);
    setFormData({
      name: facility.name || '',
      tier: facility.tier || 'sub_centre',
      parentFacility: facility.parentFacility?._id || facility.parentFacility || '',
      district: facility.district || 'Nashik',
      state: facility.state || 'Maharashtra',
      lat: facility.location?.lat !== undefined ? facility.location.lat : '',
      lng: facility.location?.lng !== undefined ? facility.location.lng : '',
      contactPhone: facility.contactPhone || '',
      active: facility.active !== undefined ? facility.active : true,
    });
    setModalError(null);
    setModalOpen(true);
  };

  // Get eligible parents based on selected tier
  const getEligibleParents = () => {
    if (formData.tier === 'district_hospital') return [];
    const expectedParentTier = {
      rural_hospital: 'district_hospital',
      phc: 'rural_hospital',
      sub_centre: 'phc',
    }[formData.tier];

    return facilities.filter(
      (f) =>
        f.tier === expectedParentTier &&
        (!editingFacility || f._id !== editingFacility._id)
    );
  };

  const handleModalSave = async (e) => {
    e.preventDefault();
    setModalSaving(true);
    setModalError(null);

    const payload = {
      name: formData.name,
      tier: formData.tier,
      district: formData.district,
      state: formData.state,
      contactPhone: formData.contactPhone,
      parentFacility:
        formData.tier === 'district_hospital'
          ? null
          : formData.parentFacility || null,
      location: {
        lat: formData.lat ? parseFloat(formData.lat) : undefined,
        lng: formData.lng ? parseFloat(formData.lng) : undefined,
      },
      active: formData.active,
    };

    try {
      if (editingFacility) {
        await api.patch(`/facilities/${editingFacility._id}`, payload);
        setActionSuccess(`Facility '${formData.name}' updated successfully!`);
      } else {
        await api.post('/facilities', payload);
        setActionSuccess(`Facility '${formData.name}' created successfully!`);
      }
      setModalOpen(false);
      fetchFacilities();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      setModalError(err.message);
    } finally {
      setModalSaving(false);
    }
  };

  const handleSoftDelete = async (facility) => {
    if (
      !window.confirm(
        `Are you sure you want to soft-delete '${facility.name}'? Existing user/encounter references will remain intact.`
      )
    ) {
      return;
    }
    try {
      const res = await api.delete(`/facilities/${facility._id}`);
      setActionSuccess(res.data.message);
      fetchFacilities();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      alert('Delete failed: ' + err.message);
    }
  };

  const handleReactivate = async (facility) => {
    try {
      await api.patch(`/facilities/${facility._id}`, { active: true });
      setActionSuccess(`Facility '${facility.name}' reactivated!`);
      fetchFacilities();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      alert('Reactivate failed: ' + err.message);
    }
  };

  const handleResetSeed = async () => {
    if (
      !window.confirm(
        'Re-seed Maharashtra facility hierarchy? This will upsert default facilities idempotently.'
      )
    ) {
      return;
    }
    try {
      setLoading(true);
      const res = await api.post('/facilities/seed');
      setActionSuccess(`Hierarchy seeded! Total count: ${res.data.count}`);
      fetchFacilities();
      setTimeout(() => setActionSuccess(null), 4000);
    } catch (err) {
      alert('Seeding error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const renderTierBadge = (tier) => {
    switch (tier) {
      case 'district_hospital':
        return <span className="tier-badge" style={{ background: 'rgba(244, 63, 94, 0.2)', color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}>DH &bull; District Hospital</span>;
      case 'rural_hospital':
        return <span className="tier-badge" style={{ background: 'rgba(139, 92, 246, 0.2)', color: '#c4b5fd', borderColor: 'rgba(139, 92, 246, 0.3)' }}>RH &bull; Rural Hospital</span>;
      case 'phc':
        return <span className="tier-badge" style={{ background: 'rgba(6, 182, 212, 0.2)', color: '#67e8f9', borderColor: 'rgba(6, 182, 212, 0.3)' }}>PHC &bull; Primary Health Centre</span>;
      case 'sub_centre':
        return <span className="tier-badge" style={{ background: 'rgba(16, 185, 129, 0.2)', color: '#6ee7b7', borderColor: 'rgba(16, 185, 129, 0.3)' }}>SC &bull; Sub-Centre</span>;
      default:
        return <span className="tier-badge">{tier}</span>;
    }
  };

  // Recursive Tree Node Renderer
  const renderTreeNode = (node, depth = 0) => {
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedNodes[node._id];

    return (
      <div key={node._id} style={{ marginLeft: depth > 0 ? '1.75rem' : '0', marginTop: '0.6rem' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.75rem 1rem',
            background: node.active ? 'rgba(17, 24, 43, 0.9)' : 'rgba(30, 41, 59, 0.5)',
            border: '1px solid var(--border-subtle)',
            borderLeft: `4px solid ${
              node.tier === 'district_hospital'
                ? '#f43f5e'
                : node.tier === 'rural_hospital'
                ? '#8b5cf6'
                : node.tier === 'phc'
                ? '#06b6d4'
                : '#10b981'
            }`,
            borderRadius: 'var(--radius-md)',
            opacity: node.active ? 1 : 0.65,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
            {hasChildren ? (
              <button
                type="button"
                onClick={() => toggleNode(node._id)}
                style={{ background: 'none', color: '#94a3b8', display: 'flex', alignItems: 'center' }}
              >
                {isExpanded ? <ChevronDown size={17} /> : <ChevronRight size={17} />}
              </button>
            ) : (
              <div style={{ width: '17px' }} />
            )}

            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontWeight: '700', fontSize: '0.95rem', color: '#f8fafc' }}>
                  {node.name}
                </span>
                {renderTierBadge(node.tier)}
                {!node.active && (
                  <span className="tag-badge tag-required">Inactive (Soft-Deleted)</span>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginTop: '0.2rem', fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                <span>District: {node.district}</span>
                {node.contactPhone && (
                  <span>
                    <Phone size={11} style={{ display: 'inline', marginRight: '3px' }} />
                    {node.contactPhone}
                  </span>
                )}
                {node.location?.lat && (
                  <span>
                    <MapPin size={11} style={{ display: 'inline', marginRight: '3px' }} />
                    {node.location.lat}, {node.location.lng}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginRight: '0.5rem' }}>
              {hasChildren ? `${node.children.length} dependent facility(s)` : 'Base tier'}
            </span>
            <button
              onClick={() => openEditModal(node)}
              className="btn btn-outline btn-sm"
              title="Edit Facility"
            >
              <Edit2 size={13} />
            </button>
            {node.active ? (
              <button
                onClick={() => handleSoftDelete(node)}
                className="btn btn-outline btn-sm"
                title="Soft Delete"
                style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
              >
                <Trash2 size={13} />
              </button>
            ) : (
              <button
                onClick={() => handleReactivate(node)}
                className="btn btn-outline btn-sm"
                title="Reactivate"
                style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)' }}
              >
                <RotateCcw size={13} />
              </button>
            )}
          </div>
        </div>

        {hasChildren && isExpanded && (
          <div style={{ borderLeft: '1px dashed var(--border-subtle)', marginLeft: '0.75rem', paddingLeft: '0.5rem' }}>
            {node.children.map((child) => renderTreeNode(child, depth + 1))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="main-content">
      {/* Top Banner & Actions */}
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
            <Building2 size={26} color="#14b8a6" />
            Facility Hierarchy & Admin Management
          </h1>
          <p style={{ color: 'var(--text-secondary)', marginTop: '0.2rem' }}>
            Manage the 4-tier Maharashtra stepped-care referral network with parent-tier integrity.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <button onClick={handleResetSeed} className="btn btn-outline btn-sm" title="Re-seed Maharashtra Hierarchy">
            <RefreshCw size={14} /> Re-Seed
          </button>
          <button onClick={openCreateModal} className="btn btn-primary btn-sm">
            <Plus size={15} /> Add Facility
          </button>
        </div>
      </div>

      {actionSuccess && (
        <div className="alert alert-success">
          <CheckCircle2 size={18} />
          <div>{actionSuccess}</div>
        </div>
      )}

      {orphanedData.length > 0 && (
        <div className="alert alert-error">
          <AlertTriangle size={18} />
          <div>
            <strong>Warning:</strong> {orphanedData.length} orphaned facility node(s) detected with missing parent links.
          </div>
        </div>
      )}

      {/* Control Bar (Search, Filters, View Mode) */}
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
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '0.5rem', flex: '1 1 240px' }}>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              type="text"
              placeholder="Search facility by name..."
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
            value={selectedTier}
            onChange={(e) => setSelectedTier(e.target.value)}
          >
            <option value="">All Tiers</option>
            <option value="district_hospital">District Hospital</option>
            <option value="rural_hospital">Rural Hospital</option>
            <option value="phc">Primary Health Centre (PHC)</option>
            <option value="sub_centre">Sub-Centre</option>
          </select>

          <select
            className="form-select"
            style={{ width: 'auto', padding: '0.5rem 0.8rem', fontSize: '0.85rem' }}
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
          >
            <option value="">All Districts</option>
            <option value="Nashik">Nashik</option>
            <option value="Pune">Pune</option>
          </select>

          <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', color: 'var(--text-secondary)', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={includeInactive}
              onChange={(e) => setIncludeInactive(e.target.checked)}
            />
            Show Inactive
          </label>

          <div style={{ display: 'flex', background: 'rgba(15, 23, 42, 0.8)', padding: '0.2rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
            <button
              onClick={() => setViewMode('table')}
              className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`}
              style={{ border: 'none', padding: '0.35rem 0.75rem' }}
            >
              Table
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`btn btn-sm ${viewMode === 'tree' ? 'btn-primary' : 'btn-outline'}`}
              style={{ border: 'none', padding: '0.35rem 0.75rem' }}
            >
              Hierarchy Tree
            </button>
          </div>
        </div>
      </div>

      {/* Main View Area */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1s linear infinite', marginBottom: '0.5rem' }} />
          <div>Loading health facilities...</div>
        </div>
      ) : viewMode === 'tree' ? (
        /* Hierarchy Tree View */
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">
              <Layers size={19} color="#14b8a6" />
              Stepped-Care Referral Hierarchy Tree
            </h3>
            <p className="card-desc">
              Visualizing the 4-tier health cascade: Sub-Centre &rarr; PHC &rarr; Rural Hospital &rarr; District Hospital.
            </p>
          </div>

          {treeData.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
              No facility hierarchy trees found.
            </div>
          ) : (
            <div>{treeData.map((root) => renderTreeNode(root, 0))}</div>
          )}
        </div>
      ) : (
        /* Flat Table View */
        <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.9rem' }}>
            <thead>
              <tr style={{ background: 'rgba(15, 23, 42, 0.9)', borderBottom: '1px solid var(--border-subtle)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '1rem' }}>Facility Name</th>
                <th style={{ padding: '1rem' }}>Tier</th>
                <th style={{ padding: '1rem' }}>Parent Facility (Next Tier Up)</th>
                <th style={{ padding: '1rem' }}>District</th>
                <th style={{ padding: '1rem' }}>Status</th>
                <th style={{ padding: '1rem', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {facilities.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: 'center', padding: '2.5rem', color: 'var(--text-muted)' }}>
                    No facilities found matching your criteria.
                  </td>
                </tr>
              ) : (
                facilities.map((f) => (
                  <tr
                    key={f._id}
                    style={{
                      borderBottom: '1px solid var(--border-subtle)',
                      background: f.active ? 'transparent' : 'rgba(244, 63, 94, 0.04)',
                    }}
                  >
                    <td style={{ padding: '1rem', fontWeight: '600', color: '#f8fafc' }}>
                      {f.name}
                      {f.contactPhone && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                          {f.contactPhone}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '1rem' }}>{renderTierBadge(f.tier)}</td>
                    <td style={{ padding: '1rem', color: f.parentFacility ? '#38bdf8' : 'var(--text-muted)' }}>
                      {f.parentFacility?.name || (f.tier === 'district_hospital' ? 'Apex (None)' : 'Orphaned (None)')}
                    </td>
                    <td style={{ padding: '1rem', color: '#f1f5f9' }}>{f.district}</td>
                    <td style={{ padding: '1rem' }}>
                      {f.active ? (
                        <span className="tag-badge tag-required" style={{ background: 'rgba(16, 185, 129, 0.15)', color: '#34d399' }}>
                          Active
                        </span>
                      ) : (
                        <span className="tag-badge tag-required">
                          Inactive (Soft-Deleted)
                        </span>
                      )}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '0.4rem' }}>
                        <button
                          onClick={() => openEditModal(f)}
                          className="btn btn-outline btn-sm"
                          title="Edit"
                        >
                          <Edit2 size={13} />
                        </button>
                        {f.active ? (
                          <button
                            onClick={() => handleSoftDelete(f)}
                            className="btn btn-outline btn-sm"
                            title="Soft Delete"
                            style={{ color: '#fb7185', borderColor: 'rgba(244, 63, 94, 0.3)' }}
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleReactivate(f)}
                            className="btn btn-outline btn-sm"
                            title="Reactivate"
                            style={{ color: '#34d399', borderColor: 'rgba(16, 185, 129, 0.3)' }}
                          >
                            <RotateCcw size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Create / Edit Facility Modal */}
      {modalOpen && (
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
              maxWidth: '560px',
              maxHeight: '90vh',
              overflowY: 'auto',
              border: '1px solid var(--border-focus)',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.8)',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ fontSize: '1.3rem', fontWeight: '800' }}>
                {editingFacility ? `Edit Facility: ${editingFacility.name}` : 'Add New Health Facility'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                style={{ background: 'none', color: '#94a3b8' }}
              >
                <X size={20} />
              </button>
            </div>

            {modalError && (
              <div className="alert alert-error">
                <AlertTriangle size={16} />
                <div>{modalError}</div>
              </div>
            )}

            <form onSubmit={handleModalSave}>
              <div className="form-group">
                <label className="form-label">Facility Name</label>
                <input
                  type="text"
                  required
                  className="form-input"
                  placeholder="e.g. Igatpuri Rural Hospital"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                />
              </div>

              <div className="grid-2" style={{ gap: '0.9rem' }}>
                <div className="form-group">
                  <label className="form-label">Facility Tier</label>
                  <select
                    className="form-select"
                    value={formData.tier}
                    onChange={(e) => {
                      const newTier = e.target.value;
                      setFormData({
                        ...formData,
                        tier: newTier,
                        parentFacility: newTier === 'district_hospital' ? '' : formData.parentFacility,
                      });
                    }}
                  >
                    <option value="district_hospital">District Hospital (Tier 4 - Apex)</option>
                    <option value="rural_hospital">Rural / Sub-District Hospital (Tier 3)</option>
                    <option value="phc">Primary Health Centre - PHC (Tier 2)</option>
                    <option value="sub_centre">Sub-Centre (Tier 1 - Frontline)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label">District</label>
                  <input
                    type="text"
                    required
                    className="form-input"
                    placeholder="e.g. Nashik"
                    value={formData.district}
                    onChange={(e) => setFormData({ ...formData, district: e.target.value })}
                  />
                </div>
              </div>

              {formData.tier !== 'district_hospital' && (
                <div className="form-group">
                  <label className="form-label">
                    Parent Facility (Next Tier Up)
                    <span style={{ fontSize: '0.75rem', color: '#38bdf8', marginLeft: '0.5rem' }}>
                      *Must be {formData.tier === 'rural_hospital' ? 'District Hospital' : formData.tier === 'phc' ? 'Rural Hospital' : 'PHC'}
                    </span>
                  </label>
                  <select
                    required
                    className="form-select"
                    value={formData.parentFacility}
                    onChange={(e) => setFormData({ ...formData, parentFacility: e.target.value })}
                  >
                    <option value="">-- Select Valid Parent Facility --</option>
                    {getEligibleParents().map((p) => (
                      <option key={p._id} value={p._id}>
                        {p.name} ({p.district})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="grid-2" style={{ gap: '0.9rem' }}>
                <div className="form-group">
                  <label className="form-label">Latitude (Optional)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="e.g. 19.9975"
                    value={formData.lat}
                    onChange={(e) => setFormData({ ...formData, lat: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Longitude (Optional)</label>
                  <input
                    type="number"
                    step="any"
                    className="form-input"
                    placeholder="e.g. 73.7898"
                    value={formData.lng}
                    onChange={(e) => setFormData({ ...formData, lng: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid-2" style={{ gap: '0.9rem' }}>
                <div className="form-group">
                  <label className="form-label">Contact Phone</label>
                  <input
                    type="text"
                    className="form-input"
                    placeholder="e.g. +91-253-2571234"
                    value={formData.contactPhone}
                    onChange={(e) => setFormData({ ...formData, contactPhone: e.target.value })}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">State</label>
                  <input
                    type="text"
                    className="form-input"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                  />
                </div>
              </div>

              {editingFacility && (
                <div className="form-group">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#f8fafc', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={formData.active}
                      onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
                    />
                    Facility is Active (uncheck to soft-delete)
                  </label>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem' }}>
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="btn btn-outline"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSaving}
                  className="btn btn-primary"
                >
                  {modalSaving ? 'Saving...' : editingFacility ? 'Update Facility' : 'Create Facility'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
