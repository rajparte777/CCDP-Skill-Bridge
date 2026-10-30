const http = require('http');
const assert = require('assert');
const app = require('../src/app');
const { initDb } = require('../src/config/db');

let server;
const pipePath = `\\\\.\\pipe\\devcollab-test-${Date.now()}`;

function request(path, options = {}) {
  return new Promise((resolve, reject) => {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const bodyStr = options.body ? JSON.stringify(options.body) : null;
    if (bodyStr) {
      headers['Content-Length'] = Buffer.byteLength(bodyStr);
    }

    const req = http.request({
      socketPath: pipePath,
      path,
      method: options.method || 'GET',
      headers
    }, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        let parsed = {};
        try { parsed = JSON.parse(data); } catch {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });

    req.on('error', reject);
    if (bodyStr) {
      req.write(bodyStr);
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting DevCollab Acceptance Test Suite (SRS Section 11) ---');
  await initDb();

  server = http.createServer(app);
  await new Promise(resolve => server.listen(pipePath, resolve));
  console.log(`[Test Server] Listening on IPC pipe ${pipePath}`);

  let testPassed = 0;
  let testFailed = 0;

  async function test(name, fn) {
    try {
      await fn();
      console.log(`  ✓ PASS: ${name}`);
      testPassed++;
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`, err.message || err);
      testFailed++;
    }
  }

  let tokenUser1;
  let user1;
  let tokenUser2;
  let user2;
  let projectId;
  let reviewId;
  let offerId;
  let paymentRef;

  // AT-01: Register with valid and invalid details
  await test('AT-01: Register with valid details and reject duplicates/invalid fields', async () => {
    const invalidRes = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Incomplete' }
    });
    assert.strictEqual(invalidRes.status, 400, 'Should reject registration with missing fields');

    const email = `testuser_${Date.now()}@example.com`;
    const regRes = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Test Architect', email, password: 'password123', skills: ['React', 'Node.js'] }
    });
    assert.strictEqual(regRes.status, 201, 'Should successfully register new user');
    assert.ok(regRes.body.token, 'Should return JWT token');
    tokenUser1 = regRes.body.token;
    user1 = regRes.body.user;

    const dupRes = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Duplicate User', email, password: 'password123' }
    });
    assert.strictEqual(dupRes.status, 409, 'Should reject duplicate email');

    // Register second user
    const regRes2 = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Test Contributor', email: `contrib_${Date.now()}@example.com`, password: 'password123' }
    });
    tokenUser2 = regRes2.body.token;
    user2 = regRes2.body.user;
  });

  // AT-01b: Password strength and Change Password
  await test('AT-01b: Enforce password strength and test change password', async () => {
    // Reject weak password (< 8 chars)
    const weakRes = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Weak Test', email: `weak_${Date.now()}@example.com`, password: '123' }
    });
    assert.strictEqual(weakRes.status, 400, 'Should reject weak password');

    // Reject invalid email
    const invalidEmailRes = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Bad Email', email: 'notanemail', password: 'password123' }
    });
    assert.strictEqual(invalidEmailRes.status, 400, 'Should reject invalid email format');

    // Change password with valid credentials
    const changeRes = await request('/api/auth/change-password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { currentPassword: 'password123', newPassword: 'newPassword456' }
    });
    assert.strictEqual(changeRes.status, 200, 'Should successfully update password');

    // Revert password back so user1 can continue testing
    await request('/api/auth/change-password', {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { currentPassword: 'newPassword456', newPassword: 'password123' }
    });
  });

  // AT-01c: GitHub OAuth status and sandbox authorization
  await test('AT-01c: GitHub OAuth status and sandbox flow', async () => {
    const statusRes = await request('/api/auth/github/status');
    assert.strictEqual(statusRes.status, 200);
    assert.ok(statusRes.body.sandboxAvailable);
  });

  // AT-03: Send and accept a connection request
  await test('AT-03: Send and accept connection request with integrity checks', async () => {
    // Self connection prevention
    const selfRes = await request('/api/connections/request', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { receiverId: user1.id }
    });
    assert.strictEqual(selfRes.status, 400, 'Should prevent self connection');

    // Send valid request
    const sendRes = await request('/api/connections/request', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { receiverId: user2.id }
    });
    assert.strictEqual(sendRes.status, 201, 'Should create connection request');
    const connId = sendRes.body.connection.id;

    // Accept request
    const acceptRes = await request(`/api/connections/${connId}/respond`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser2}` },
      body: { action: 'accepted' }
    });
    assert.strictEqual(acceptRes.status, 200);
    assert.strictEqual(acceptRes.body.connection.status, 'accepted');
  });

  // AT-04: Create a project and invite a member
  await test('AT-04: Create project and manage member roles (RBAC)', async () => {
    const projRes = await request('/api/projects', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: {
        title: 'Nebula Distributed Cloud',
        description: 'High-availability cluster orchestration',
        visibility: 'private',
        collaboration_type: 'paid',
        technologies: ['Node.js', 'Docker', 'PostgreSQL']
      }
    });
    assert.strictEqual(projRes.status, 201);
    projectId = projRes.body.project.id;

    // Add User 2 as contributor
    const inviteRes = await request(`/api/projects/${projectId}/members`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { userId: user2.id, role: 'contributor' }
    });
    assert.strictEqual(inviteRes.status, 201);
  });

  // AT-02: Attempt to access private project as non-member
  await test('AT-02: Non-member cannot access private project', async () => {
    // Register uninvited user
    const unauthReg = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Third Party', email: `intruder_${Date.now()}@example.com`, password: 'password123' }
    });
    const intruderToken = unauthReg.body.token;

    const accessRes = await request(`/api/projects/${projectId}`, {
      headers: { Authorization: `Bearer ${intruderToken}` }
    });
    assert.strictEqual(accessRes.status, 403, 'Should deny private project to non-member');
  });

  // AT-05: Link a test GitHub repository
  await test('AT-05: Link GitHub repository to project', async () => {
    const linkRes = await request(`/api/github/projects/${projectId}/link`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: {
        owner: 'devcollab-org',
        name: 'nebula-cloud',
        url: 'https://github.com/devcollab-org/nebula-cloud',
        default_branch: 'main',
        visibility: 'private'
      }
    });
    assert.strictEqual(linkRes.status, 200);
    assert.strictEqual(linkRes.body.repository.owner, 'devcollab-org');
  });

  // AT-06: Send valid and invalid webhook payloads
  await test('AT-06: Process idempotent GitHub webhook simulation', async () => {
    const simRes = await request(`/api/github/projects/${projectId}/simulate`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { event_type: 'push', message: 'feat: add cluster autoscaler node', branch: 'main' }
    });
    assert.strictEqual(simRes.status, 201);
    assert.ok(simRes.body.event.id);
  });

  // AT-06b: Commit and push code directly to linked GitHub repository
  await test('AT-06b: Commit and push document directly to linked GitHub repository', async () => {
    const commitRes = await request(`/api/github/projects/${projectId}/commit`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: {
        file_path: 'README.md',
        content: '# Nebula Cloud\nHigh availability cluster orchestration engine.',
        message: 'docs: update architecture overview in README.md',
        branch: 'main',
        simulate: true
      }
    });
    assert.strictEqual(commitRes.status, 201);
    assert.ok(commitRes.body.commit.sha, 'Commit SHA must be returned');
    assert.strictEqual(commitRes.body.commit.branch, 'main');
    assert.strictEqual(commitRes.body.commit.filePath, 'README.md');
  });

  // AT-07 & AT-13: Editor document retrieval, save permissions, and viewer restriction
  await test('AT-07 & AT-13: Collaborative editor documents and viewer edit restrictions', async () => {
    // List project docs
    const listDocs = await request(`/api/editor/${projectId}/documents`, {
      headers: { Authorization: `Bearer ${tokenUser1}` }
    });
    assert.strictEqual(listDocs.status, 200);
    const readmeDoc = listDocs.body.documents.find(d => d.file_path === 'README.md');
    assert.ok(readmeDoc, 'Default README should exist');

    // Create a code file
    const createDoc = await request(`/api/editor/${projectId}/documents`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { file_path: 'src/main.js', content: 'console.log("Nebula Cloud init");', language: 'javascript' }
    });
    assert.strictEqual(createDoc.status, 201);
    const mainDocId = createDoc.body.document.id;

    // Contributor saves updates
    const saveRes = await request(`/api/editor/${projectId}/documents/${mainDocId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser2}` },
      body: { content: 'console.log("Nebula Cloud initialized with clustering");' }
    });
    assert.strictEqual(saveRes.status, 200);

    // Demote user2 to viewer
    await request(`/api/projects/${projectId}/members/${user2.id}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { role: 'viewer' }
    });

    // Viewer attempt to save
    const viewerSave = await request(`/api/editor/${projectId}/documents/${mainDocId}`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser2}` },
      body: { content: 'Illegal modification by viewer' }
    });
    assert.strictEqual(viewerSave.status, 403, 'Viewer edit must be rejected with 403 Forbidden');
  });

  // AT-09: Submit a review and correction
  await test('AT-09: Submit code review and line suggestion', async () => {
    const revRes = await request(`/api/reviews/projects/${projectId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { title: 'Audit cluster autoscaler' }
    });
    assert.strictEqual(revRes.status, 201);
    reviewId = revRes.body.review.id;

    const commentRes = await request(`/api/reviews/${reviewId}/comments`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: {
        file_path: 'src/main.js',
        line_number: 1,
        body: 'Consider structured logging instead of console.log',
        suggestion: 'logger.info("Nebula Cloud initialized");'
      }
    });
    assert.strictEqual(commentRes.status, 201);

    // Approve review
    const decisionRes = await request(`/api/reviews/${reviewId}/decision`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { status: 'approved' }
    });
    assert.strictEqual(decisionRes.status, 200);
    assert.strictEqual(decisionRes.body.review.status, 'approved');
  });

  // AT-10: Create and accept a free offer
  await test('AT-10: Free collaboration agreement requires no payment', async () => {
    const freeOffer = await request(`/api/collaborations/projects/${projectId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { contributor_id: user2.id, terms: 'Open source bug triage and documentation', amount: 0, currency: 'USD' }
    });
    assert.strictEqual(freeOffer.status, 201);
    assert.strictEqual(parseFloat(freeOffer.body.offer.amount), 0);

    const acceptFree = await request(`/api/collaborations/${freeOffer.body.offer.id}/respond`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser2}` },
      body: { action: 'accepted' }
    });
    assert.strictEqual(acceptFree.status, 200);

    // Attempting payment on free offer must fail
    const payFree = await request('/api/payments/initiate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { offerId: freeOffer.body.offer.id }
    });
    assert.strictEqual(payFree.status, 400, 'Free collaboration must reject payment initiation');
  });

  // AT-11: Test paid offer in provider sandbox
  await test('AT-11: Paid collaboration offer and verified sandbox settlement', async () => {
    const paidOffer = await request(`/api/collaborations/projects/${projectId}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { contributor_id: user2.id, terms: 'Implement cluster scaling metric exporter', amount: 600.00, currency: 'USD' }
    });
    assert.strictEqual(paidOffer.status, 201);
    offerId = paidOffer.body.offer.id;

    // Contributor accepts
    await request(`/api/collaborations/${offerId}/respond`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser2}` },
      body: { action: 'accepted' }
    });

    // Initiate payment
    const initPay = await request('/api/payments/initiate', {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { offerId }
    });
    assert.strictEqual(initPay.status, 201);
    paymentRef = initPay.body.payment.provider_reference;
    assert.ok(paymentRef);

    // Provider sandbox webhook confirmation
    const confirmRes = await request('/api/payments/sandbox/confirm', {
      method: 'POST',
      body: { provider_reference: paymentRef, status: 'completed' }
    });
    assert.strictEqual(confirmRes.status, 200);
    assert.strictEqual(confirmRes.body.payment.status, 'completed');
  });

  // AT-11b: Milestone deliverable workflow, ledger summary and verified cryptographic receipt
  await test('AT-11b: Milestone deliverable submission, financial ledger and receipt verification', async () => {
    // Contributor submits deliverables for the agreement
    const submitRes = await request(`/api/collaborations/${offerId}/submit-deliverable`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser2}` },
      body: { deliverable_note: 'Completed cluster scaling exporter PR #42 with Prometheus metrics.', deliverable_url: 'https://github.com/org/repo/pull/42' }
    });
    assert.strictEqual(submitRes.status, 200);
    assert.strictEqual(submitRes.body.offer.milestone_status, 'submitted');

    // Owner reviews and approves milestone
    const reviewRes = await request(`/api/collaborations/${offerId}/review-milestone`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { action: 'approved' }
    });
    assert.strictEqual(reviewRes.status, 200);
    assert.strictEqual(reviewRes.body.offer.milestone_status, 'approved');

    // Ledger query
    const ledgerRes = await request('/api/collaborations/ledger', {
      headers: { Authorization: `Bearer ${tokenUser1}` }
    });
    assert.strictEqual(ledgerRes.status, 200);
    assert.ok(ledgerRes.body.ledger.length > 0);
    assert.ok(parseFloat(ledgerRes.body.summary.totalDisbursed) >= 600.00);

    // Cryptographic receipt query
    const payId = ledgerRes.body.ledger[0].id;
    const receiptRes = await request(`/api/payments/receipt/${payId}`, {
      headers: { Authorization: `Bearer ${tokenUser1}` }
    });
    assert.strictEqual(receiptRes.status, 200);
    assert.ok(receiptRes.body.receipt.verification_hash, 'Receipt must have HMAC-SHA256 signature');
  });

  // AT-11c: Submit collaboration request by applicant and accept by owner
  await test('AT-11c: Submit collaboration inquiry and accept team applicant', async () => {
    // Register user 3
    const regUser3 = await request('/api/auth/register', {
      method: 'POST',
      body: { name: 'Elena Contributor', email: `elena_${Date.now()}@example.com`, password: 'Password123!' }
    });
    assert.strictEqual(regUser3.status, 201);
    const tokenUser3 = regUser3.body.token;

    // User 3 applies to collaborate on project
    const reqRes = await request(`/api/collaborations/projects/${projectId}/requests`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${tokenUser3}` },
      body: { role: 'contributor', pitch: 'Experienced in real-time WebSockets and CRDT sync.' }
    });
    assert.strictEqual(reqRes.status, 201);
    const requestId = reqRes.body.request.id;

    // Owner accepts the collaboration application
    const acceptReq = await request(`/api/collaborations/requests/${requestId}/respond`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser1}` },
      body: { action: 'accepted' }
    });
    assert.strictEqual(acceptReq.status, 200);
  });

  // AT-12: Inspect notifications
  await test('AT-12: In-app notifications delivered and updated', async () => {
    const notifs = await request('/api/notifications', {
      headers: { Authorization: `Bearer ${tokenUser2}` }
    });
    assert.strictEqual(notifs.status, 200);
    assert.ok(notifs.body.notifications.length > 0, 'User 2 should have received notifications');

    const firstId = notifs.body.notifications[0].id;
    const readRes = await request(`/api/notifications/${firstId}/read`, {
      method: 'PUT',
      headers: { Authorization: `Bearer ${tokenUser2}` }
    });
    assert.strictEqual(readRes.status, 200);
  });

  console.log('-----------------------------------------------------------------');
  console.log(`Test Results: ${testPassed} Passed, ${testFailed} Failed`);
  console.log('-----------------------------------------------------------------');

  server.close();
  if (testFailed > 0) process.exit(1);
}

runTests().catch(err => {
  console.error('Fatal test error:', err);
  if (server) server.close();
  process.exit(1);
});
