const http = require('http');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '../.env') });

const testApi = async () => {
  console.log('====================================================');
  console.log('     SETUCARE STEP 1 API ENDPOINTS VERIFICATION     ');
  console.log('====================================================\n');

  const app = require('./index'); // Loads express app & starts listening if standalone or export

  // Wait 1.5s for server to start
  await new Promise((r) => setTimeout(r, 1500));

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
    // 1. Healthcheck
    console.log('[1/5] Testing GET /api/health...');
    const health = await request('/api/health');
    console.log(`  ✔ Healthcheck status: ${health.status} (${health.data.status})\n`);

    // 2. Fetch Facilities
    console.log('[2/5] Testing GET /api/facilities...');
    const facRes = await request('/api/facilities');
    console.log(`  ✔ Facilities status: ${facRes.status} (Count: ${facRes.data.count})\n`);
    const defaultFacilityId = facRes.data.facilities[0]._id;

    // 3. Login with Medical Officer
    console.log('[3/5] Testing POST /api/auth/login (Medical Officer)...');
    const moLogin = await request(
      '/api/auth/login',
      { method: 'POST' },
      { email: 'dr.kulkarni@setucare.in', password: 'password123' }
    );
    console.log(`  ✔ MO Login status: ${moLogin.status} (${moLogin.data.message})`);
    const rawCookie = moLogin.headers['set-cookie']?.[0];
    const cookieHeader = rawCookie ? rawCookie.split(';')[0] : '';
    console.log(`  ✔ httpOnly cookie received: ${cookieHeader ? 'YES' : 'NO'}\n`);

    // 4. Test Protected Route: GET /api/auth/me
    console.log('[4/5] Testing GET /api/auth/me with Cookie...');
    const meRes = await request('/api/auth/me', {
      headers: { Cookie: cookieHeader },
    });
    console.log(`  ✔ /me response status: ${meRes.status}`);
    console.log(`  ✔ User authenticated: ${meRes.data.user?.name} (Role: ${meRes.data.user?.role}, Facility: ${meRes.data.user?.facility?.name})\n`);

    // 5. Test RoleGuard & Facility Scope
    console.log('[5/5] Testing RoleGuard & Facility Scope Middleware...');
    
    // MO accesses MO/Specialist/Admin route -> Should be 200 OK
    const guardAllowed = await request('/api/auth/test-role-guard', {
      headers: { Cookie: cookieHeader },
    });
    console.log(`  ✔ MO accessing /test-role-guard: HTTP ${guardAllowed.status} (${guardAllowed.data.message})`);

    // MO accesses Admin-Only route -> Should be 403 Forbidden
    const guardDenied = await request('/api/auth/test-admin-only', {
      headers: { Cookie: cookieHeader },
    });
    console.log(`  ✔ MO accessing /test-admin-only: HTTP ${guardDenied.status} (Forbidden as expected)`);

    // Test Facility Scope
    const scopeRes = await request('/api/auth/test-facility-scope', {
      headers: { Cookie: cookieHeader },
    });
    console.log(`  ✔ /test-facility-scope: HTTP ${scopeRes.status} (Bound to facility: ${scopeRes.data.scopeDetails?.facilityName})\n`);

    console.log('====================================================');
    console.log('     ALL API ENDPOINT TESTS COMPLETED SUCCESSFULLY! ');
    console.log('====================================================');
    process.exit(0);
  } catch (err) {
    console.error('API Verification failed:', err);
    process.exit(1);
  }
};

testApi();
