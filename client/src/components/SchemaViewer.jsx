import React, { useState } from 'react';
import { Database, FileText, CheckCircle, Link2, Shield, Layers } from 'lucide-react';

export const SchemaViewer = () => {
  const [activeModel, setActiveModel] = useState('User');

  const schemas = {
    User: {
      name: 'User',
      description: 'System accounts scoped by clinical role and assigned health facility.',
      fields: [
        { name: 'name', type: 'String', required: true, details: 'Full name of healthcare worker or admin' },
        { name: 'email', type: 'String', required: true, unique: true, details: 'Unique login email, lowercased & trimmed' },
        { name: 'password', type: 'String', required: true, selectFalse: true, details: 'Bcrypt hash with cost 10 (select: false)' },
        { name: 'role', type: 'String (Enum)', required: true, details: "['frontline_worker', 'medical_officer', 'specialist', 'program_manager', 'admin']" },
        { name: 'facility', type: 'ObjectId', ref: 'Facility', required: true, details: 'Required for all non-admin roles' },
        { name: 'phone', type: 'String', required: false, details: 'Contact phone number' },
        { name: 'preferredLanguage', type: 'String (Enum)', required: false, details: "22 scheduled Indian languages + English, default: 'en'" },
        { name: 'createdAt / updatedAt', type: 'Date', timestamps: true, details: 'Mongoose timestamps' },
      ],
    },
    Facility: {
      name: 'Facility',
      description: 'Stepped-care tier hierarchy from Sub-Centres up to District Hospitals.',
      fields: [
        { name: 'name', type: 'String', required: true, details: 'Health facility name (e.g., Shirur Sub-District Hospital)' },
        { name: 'tier', type: 'String (Enum)', required: true, details: "['sub_centre', 'phc', 'rural_hospital', 'district_hospital']" },
        { name: 'parentFacility', type: 'ObjectId', ref: 'Facility', required: false, details: 'Next tier up in stepped-care hierarchy' },
        { name: 'location', type: 'Object { lat, lng }', required: false, details: 'Geographic latitude and longitude' },
        { name: 'district', type: 'String', required: false, details: 'Administrative district (e.g., Pune, Gadchiroli)' },
        { name: 'state', type: 'String', required: false, details: "Default: 'Maharashtra'" },
        { name: 'contactPhone', type: 'String', required: false, details: 'Official helpline / desk phone' },
        { name: 'createdAt / updatedAt', type: 'Date', timestamps: true, details: 'Mongoose timestamps' },
      ],
    },
    Patient: {
      name: 'Patient',
      description: 'Master patient index with unique PHID for QR-based identification.',
      fields: [
        { name: 'phid', type: 'String', required: true, unique: true, indexed: true, details: 'Patient Health ID encoded into QR code' },
        { name: 'name', type: 'String', required: true, details: 'Patient full name' },
        { name: 'dob', type: 'Date', required: false, details: 'Date of birth' },
        { name: 'gender', type: 'String (Enum)', required: false, details: "['male', 'female', 'other']" },
        { name: 'guardianName', type: 'String', required: false, details: 'Parent/guardian name for minors' },
        { name: 'phone', type: 'String', required: false, details: 'Patient or family mobile number' },
        { name: 'address', type: 'String', required: false, details: 'Village, Taluka, District' },
        { name: 'registeredAtFacility', type: 'ObjectId', ref: 'Facility', required: false, details: 'Origin registration facility' },
        { name: 'preferredLanguage', type: 'String (Enum)', required: false, details: "22 scheduled Indian languages + English, default: 'mr'" },
        { name: 'createdAt / updatedAt', type: 'Date', timestamps: true, details: 'Mongoose timestamps' },
      ],
    },
    Encounter: {
      name: 'Encounter',
      description: 'Point-of-care clinical encounter with vitals, symptoms, and triage result.',
      fields: [
        { name: 'patient', type: 'ObjectId', ref: 'Patient', required: true, details: 'Patient attended' },
        { name: 'facility', type: 'ObjectId', ref: 'Facility', required: true, details: 'Facility where encounter took place' },
        { name: 'worker', type: 'ObjectId', ref: 'User', required: true, details: 'Frontline worker or Medical Officer' },
        { name: 'vitals', type: 'Object', required: false, details: '{ bp, tempC, pulse, weightKg, spo2 }' },
        { name: 'symptoms', type: 'Array of Strings', required: false, details: 'Reported symptoms / chief complaints' },
        { name: 'notes', type: 'String', required: false, details: 'Clinical notes or observations' },
        { name: 'triageResult', type: 'Object', required: false, details: "{ riskLevel: ['routine', 'urgent', 'emergency'], suggestedRouting }" },
        { name: 'encounterType', type: 'String (Enum)', required: false, details: "['walk_in', 'follow_up', 'referral_consult'], default: 'walk_in'" },
        { name: 'createdAt', type: 'Date', timestamps: true, details: 'Encounter timestamp' },
      ],
    },
    Referral: {
      name: 'Referral',
      description: 'Stepped referral tracking between healthcare facilities with lifecycle history.',
      fields: [
        { name: 'patient', type: 'ObjectId', ref: 'Patient', required: true, details: 'Patient being referred' },
        { name: 'sourceEncounter', type: 'ObjectId', ref: 'Encounter', required: true, details: 'Originating clinical encounter' },
        { name: 'fromFacility', type: 'ObjectId', ref: 'Facility', required: true, details: 'Referring source facility' },
        { name: 'toFacility', type: 'ObjectId', ref: 'Facility', required: true, details: 'Destination receiving facility' },
        { name: 'reason', type: 'String', required: false, details: 'Clinical referral rationale' },
        { name: 'status', type: 'String (Enum)', required: false, details: "['created', 'acknowledged', 'seen', 'closed'], default: 'created'" },
        { name: 'statusHistory', type: 'Array of Subdocs', required: false, details: '[{ status, timestamp, updatedBy }]' },
        { name: 'outcomeNotes', type: 'String', required: false, details: 'Findings and treatment notes from destination facility' },
        { name: 'createdAt / updatedAt', type: 'Date', timestamps: true, details: 'Mongoose timestamps' },
      ],
    },
    FollowUp: {
      name: 'FollowUp',
      description: 'Cohort-based proactive follow-up schedules for continuous care.',
      fields: [
        { name: 'patient', type: 'ObjectId', ref: 'Patient', required: true, details: 'Target patient' },
        { name: 'cohortType', type: 'String (Enum)', required: true, details: "['maternal', 'child', 'chronic']" },
        { name: 'relatedEncounter', type: 'ObjectId', ref: 'Encounter', required: false, details: 'Linked source encounter' },
        { name: 'assignedFacility', type: 'ObjectId', ref: 'Facility', required: true, details: 'Facility responsible for executing follow-up' },
        { name: 'dueDate', type: 'Date', required: true, details: 'Scheduled due date for care check' },
        { name: 'status', type: 'String (Enum)', required: false, details: "['pending', 'completed', 'missed'], default: 'pending'" },
        { name: 'completedAt', type: 'Date', required: false, details: 'Date when follow-up was completed' },
        { name: 'createdAt / updatedAt', type: 'Date', timestamps: true, details: 'Mongoose timestamps' },
      ],
    },
  };

  const current = schemas[activeModel];

  return (
    <div className="card" style={{ marginTop: '1.5rem' }}>
      <div className="card-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h3 className="card-title">
              <Database size={20} color="#14b8a6" />
              Core Mongoose Schemas (6 Models Defined)
            </h3>
            <p className="card-desc">
              All collections defined for Step 1. Ready for Facility CRUD (Step 2) and Patient Registration (Step 3).
            </p>
          </div>
          <span className="brand-subtitle">Mongoose 8.x Ready</span>
        </div>
      </div>

      <div className="tabs-header">
        {Object.keys(schemas).map((modelName) => (
          <button
            key={modelName}
            onClick={() => setActiveModel(modelName)}
            className={`tab-btn ${activeModel === modelName ? 'active' : ''}`}
          >
            <Layers size={14} />
            {modelName}
          </button>
        ))}
      </div>

      <div style={{ marginBottom: '1rem', padding: '0.75rem 1rem', background: 'rgba(255, 255, 255, 0.03)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-subtle)' }}>
        <div style={{ fontWeight: '700', color: '#38bdf8', marginBottom: '0.2rem' }}>
          Model: {current.name}
        </div>
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          {current.description}
        </div>
      </div>

      <div className="schema-field-list">
        {current.fields.map((f, i) => (
          <div key={i} className="schema-field-row">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <span className="field-name">{f.name}</span>
              <span className="field-type">{f.type}</span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
              <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', maxWidth: '320px', textAlign: 'right' }}>
                {f.details}
              </div>
              <div className="field-badges">
                {f.required && <span className="tag-badge tag-required">Required</span>}
                {f.ref && <span className="tag-badge tag-ref">Ref: {f.ref}</span>}
                {f.unique && <span className="tag-badge tag-unique">Unique</span>}
                {f.selectFalse && <span className="tag-badge tag-unique">select: false</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
