const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const seedFacilityHierarchy = require('./seed/facilities');

const testStep2 = async () => {
  console.log('====================================================');
  console.log('     SETUCARE STEP 2 COMPREHENSIVE VERIFICATION     ');
  console.log('====================================================\n');

  // 1. Run Seed Script
  console.log('[1/7] Testing Idempotent Seed Script...');
  const seededCount = await seedFacilityHierarchy();
  console.log(`  ✔ Seed script completed. Seeded ${seededCount} facilities.`);
  // Run it a second time to ensure idempotency (no duplicate count increase)
  const reseedCount = await seedFacilityHierarchy();
  if (reseedCount !== seededCount) {
    throw new Error(`Idempotency failure: count changed from ${seededCount} to ${reseedCount}`);
  }
  console.log(`  ✔ Idempotency confirmed: count remained exactly ${reseedCount} on re-run.\n`);

  const PORT = process.env.PORT || 5000;
  const baseUrl = `http://localhost:${PORT}`;

  const request = (path, options = {}, body = null) => {
    return new Promise((resolve, reject) => {
      const url = new URL(path, baseUrl);
      const req = http.request(
        url,
        {
          method: options.method || 'GET',
          headers: {
            'Content-Type': 'application/json',
            ...(options.headers || {}),
          },
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            try {
              const parsed = data ? JSON.parse(data) : {};
              resolve({
                status: res.statusCode,
                headers: res.headers,
                data: parsed,
              });
            } catch (e) {
              resolve({
                status: res.statusCode,
                headers: res.headers,
                raw: data,
              });
            }
          });
        }
      );
      req.on('error', reject);
      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    });
  };

  try {
    // 2. Test Flat List with Filters
    console.log('[2/7] Testing GET /api/facilities with filters...');
    const allFac = await request('/api/facilities');
    console.log(`  ✔ GET /api/facilities: HTTP ${allFac.status} (Count: ${allFac.data.count})`);

    const phcFac = await request('/api/facilities?tier=phc');
    console.log(`  ✔ GET /api/facilities?tier=phc: HTTP ${phcFac.status} (Found ${phcFac.data.count} PHCs)`);

    const nskFac = await request('/api/facilities?district=Nashik');
    console.log(`  ✔ GET /api/facilities?district=Nashik: HTTP ${nskFac.status} (Found ${nskFac.data.count} Nashik facilities)\n`);

    // 3. Test Hierarchy Tree
    console.log('[3/7] Testing GET /api/facilities/tree (Nested Stepped Care)...');
    const treeRes = await request('/api/facilities/tree');
    console.log(`  ✔ GET /api/facilities/tree: HTTP ${treeRes.status}`);
    console.log(`  ✔ Roots (District Hospitals): ${treeRes.data.rootCount}, Total Nodes: ${treeRes.data.totalCount}, Orphaned: ${treeRes.data.orphanedCount}`);

    const nashikRoot = treeRes.data.tree.find((r) => r.district === 'Nashik');
    if (!nashikRoot) throw new Error('Nashik District Hospital root not found in tree!');
    console.log(`  ✔ Tree Root: ${nashikRoot.name} (${nashikRoot.children.length} Rural Hospitals attached)`);
    const igatpuriNode = nashikRoot.children.find((c) => c.name.includes('Igatpuri'));
    console.log(`    ↳ RH: ${igatpuriNode.name} (${igatpuriNode.children.length} PHCs attached)`);
    const ghotiNode = igatpuriNode.children.find((c) => c.name.includes('Ghoti'));
    console.log(`      ↳ PHC: ${ghotiNode.name} (${ghotiNode.children.length} Sub-Centres attached)\n`);

    // 4. Authenticate as Admin & Non-Admin
    console.log('[4/7] Authenticating Admin & Frontline Worker sessions...');
    const adminLogin = await request(
      '/api/auth/login',
      { method: 'POST' },
      { email: 'admin@setucare.in', password: 'admin123' }
    );
    const adminCookie = adminLogin.headers['set-cookie']?.[0]?.split(';')[0];

    const ashaLogin = await request(
      '/api/auth/login',
      { method: 'POST' },
      { email: 'asha.shinde@setucare.in', password: 'password123' }
    );
    const ashaCookie = ashaLogin.headers['set-cookie']?.[0]?.split(';')[0];
    console.log('  ✔ Admin & ASHA tokens acquired.\n');

    // 5. Test Parent-Tier Validation on Create
    console.log('[5/7] Testing Parent-Tier Validation on POST /api/facilities...');
    
    // Invalid: Sub-Centre attached to a District Hospital directly
    const invalidCreate = await request(
      '/api/facilities',
      { method: 'POST', headers: { Cookie: adminCookie } },
      {
        name: 'Invalid Test Sub-Centre',
        tier: 'sub_centre',
        parentFacility: nashikRoot._id,
        district: 'Nashik',
      }
    );
    if (invalidCreate.status === 400) {
      console.log(`  ✔ Invalid parent-tier rejected correctly: HTTP 400 ("${invalidCreate.data.message}")`);
    } else {
      throw new Error(`Expected 400 rejection for invalid hierarchy, got ${invalidCreate.status}`);
    }

    // Valid: Sub-Centre attached to Ghoti PHC
    const validCreate = await request(
      '/api/facilities',
      { method: 'POST', headers: { Cookie: adminCookie } },
      {
        name: 'Kavnai Sub-Centre',
        tier: 'sub_centre',
        parentFacility: ghotiNode._id,
        district: 'Nashik',
        state: 'Maharashtra',
        location: { lat: 19.7021, lng: 73.6123 },
        contactPhone: '+91-2553-299001',
      }
    );
    if (validCreate.status !== 201) {
      throw new Error(`Failed to create valid facility: ${JSON.stringify(validCreate.data)}`);
    }
    const createdFacility = validCreate.data.facility;
    console.log(`  ✔ Valid facility created: HTTP 201 (${createdFacility.name}, ID: ${createdFacility._id})\n`);

    // 6. Test GetById, Patch Update & Soft Delete
    console.log('[6/7] Testing GET/:id, PATCH/:id, DELETE/:id (Soft-Delete)...');
    
    // Get single
    const getSingle = await request(`/api/facilities/${createdFacility._id}`);
    console.log(`  ✔ GET /api/facilities/${createdFacility._id}: HTTP ${getSingle.status} (${getSingle.data.facility.name})`);

    // Patch update
    const patchRes = await request(
      `/api/facilities/${createdFacility._id}`,
      { method: 'PATCH', headers: { Cookie: adminCookie } },
      { contactPhone: '+91-2553-999999', name: 'Kavnai Fort Sub-Centre' }
    );
    console.log(`  ✔ PATCH update: HTTP ${patchRes.status} (Updated name: ${patchRes.data.facility.name})`);

    // Soft delete
    const deleteRes = await request(
      `/api/facilities/${createdFacility._id}`,
      { method: 'DELETE', headers: { Cookie: adminCookie } }
    );
    console.log(`  ✔ DELETE soft-delete: HTTP ${deleteRes.status} (${deleteRes.data.message})`);

    // Verify excluded from default list
    const activeList = await request('/api/facilities?search=Kavnai');
    if (activeList.data.count !== 0) {
      throw new Error('Soft-deleted facility still appeared in active list!');
    }
    console.log('  ✔ Confirmed soft-deleted facility is excluded from default active list.');

    // Verify included when ?includeInactive=true
    const inactiveList = await request('/api/facilities?search=Kavnai&includeInactive=true');
    if (inactiveList.data.count !== 1) {
      throw new Error('Soft-deleted facility missing from includeInactive=true list!');
    }
    console.log('  ✔ Confirmed soft-deleted facility is retrieved with ?includeInactive=true.');

    // Reactivate
    await request(
      `/api/facilities/${createdFacility._id}`,
      { method: 'PATCH', headers: { Cookie: adminCookie } },
      { active: true }
    );
    console.log('  ✔ Reactivated facility for normal operations.\n');

    // 7. Test RoleGuard Non-Admin Blocks (403)
    console.log('[7/7] Testing RoleGuard: Non-Admin blocked with HTTP 403 on mutations...');
    
    const ashaCreate = await request(
      '/api/facilities',
      { method: 'POST', headers: { Cookie: ashaCookie } },
      { name: 'Rogue Facility', tier: 'sub_centre', district: 'Nashik' }
    );
    if (ashaCreate.status === 403) {
      console.log(`  ✔ Frontline worker blocked on POST /api/facilities: HTTP 403 Forbidden.`);
    } else {
      throw new Error(`Expected 403, got ${ashaCreate.status}`);
    }

    const ashaDelete = await request(
      `/api/facilities/${createdFacility._id}`,
      { method: 'DELETE', headers: { Cookie: ashaCookie } }
    );
    if (ashaDelete.status === 403) {
      console.log(`  ✔ Frontline worker blocked on DELETE /api/facilities: HTTP 403 Forbidden.`);
    } else {
      throw new Error(`Expected 403, got ${ashaDelete.status}`);
    }

    console.log('\n====================================================');
    console.log('     ALL STEP 2 CHECKS PASSED FLAWLESSLY!           ');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('\n✖ Step 2 Verification failed:', err);
    process.exit(1);
  }
};

testStep2();
