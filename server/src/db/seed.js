const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { initDb, query } = require('../config/db');

async function seed() {
  console.log('[DevCollab Seed] Starting database seeding...');
  await initDb();

  // Clear existing records
  const tables = [
    'audit_events', 'notifications', 'payments', 'collaboration_offers',
    'document_updates', 'editor_documents', 'review_comments', 'reviews',
    'repository_events', 'github_repositories', 'tasks', 'project_members',
    'projects', 'connections', 'user_skills', 'skills', 'users'
  ];

  for (const t of tables) {
    try {
      await query(`DELETE FROM ${t}`);
    } catch (e) {
      // Table may not exist yet or empty
    }
  }

  console.log('[DevCollab Seed] Cleared old records.');

  // Create Skills
  const skillNames = ['React.js', 'Node.js', 'PostgreSQL', 'TypeScript', 'Docker', 'WebSockets', 'GraphQL', 'Tailwind CSS', 'Python', 'Go'];
  const skillMap = {};
  for (const name of skillNames) {
    const id = uuidv4();
    await query('INSERT INTO skills (id, name) VALUES ($1, $2)', [id, name]);
    skillMap[name] = id;
  }

  // Create Users (all have password: password123)
  const passwordHash = await bcrypt.hash('password123', 10);

  const users = [
    {
      id: uuidv4(),
      name: 'Alex Rivera',
      email: 'alex@example.com',
      bio: 'Full-stack Architect & Open Source Enthusiast. Passionate about real-time distributed collaboration systems.',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80',
      github_username: 'alexrivera-dev',
      portfolio_url: 'https://alexrivera.dev',
      skills: ['React.js', 'Node.js', 'PostgreSQL', 'WebSockets', 'Docker']
    },
    {
      id: uuidv4(),
      name: 'Priya Sharma',
      email: 'priya@example.com',
      bio: 'Frontend Specialist & Design Engineer. Crafting accessible, delightful UI experiences with modern React.',
      avatar_url: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?w=200&auto=format&fit=crop&q=80',
      github_username: 'priyasharma-code',
      portfolio_url: 'https://priyasharma.design',
      skills: ['React.js', 'TypeScript', 'Tailwind CSS', 'GraphQL']
    },
    {
      id: uuidv4(),
      name: 'Marcus Vance',
      email: 'marcus@example.com',
      bio: 'Backend & Cloud Infrastructure Engineer. Specializing in high-throughput APIs and reliable databases.',
      avatar_url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80',
      github_username: 'marcusvance',
      portfolio_url: 'https://marcusvance.io',
      skills: ['Node.js', 'PostgreSQL', 'Docker', 'Python', 'Go']
    },
    {
      id: uuidv4(),
      name: 'Elena Rostova',
      email: 'elena@example.com',
      bio: 'Security Researcher & Senior Code Reviewer. Focused on static code analysis, vulnerability remediation, and best practices.',
      avatar_url: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&auto=format&fit=crop&q=80',
      github_username: 'elenarostova',
      portfolio_url: 'https://elenarostova.tech',
      skills: ['TypeScript', 'Python', 'Docker', 'PostgreSQL']
    }
  ];

  for (const u of users) {
    await query(
      `INSERT INTO users (id, name, email, password_hash, bio, avatar_url, github_username, portfolio_url, role, is_public, created_at, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'user', TRUE, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
      [u.id, u.name, u.email, passwordHash, u.bio, u.avatar_url, u.github_username, u.portfolio_url]
    );

    for (const s of u.skills) {
      if (skillMap[s]) {
        await query('INSERT INTO user_skills (user_id, skill_id) VALUES ($1, $2)', [u.id, skillMap[s]]);
      }
    }
  }

  // Developer Connections
  await query(
    `INSERT INTO connections (id, requester_id, receiver_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'accepted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [uuidv4(), users[0].id, users[1].id]
  );
  await query(
    `INSERT INTO connections (id, requester_id, receiver_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'accepted', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [uuidv4(), users[0].id, users[2].id]
  );
  await query(
    `INSERT INTO connections (id, requester_id, receiver_id, status, created_at, updated_at)
     VALUES ($1, $2, $3, 'pending', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [uuidv4(), users[3].id, users[0].id]
  );

  // Projects
  const project1Id = uuidv4();
  await query(
    `INSERT INTO projects (id, owner_id, title, description, visibility, collaboration_type, status, technologies, repository_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'public', 'paid', 'active', $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      project1Id,
      users[0].id,
      'DevCollab Core Suite',
      'Unified developer networking, real-time code editor with CRDT synchronization, GitHub webhooks, and verified milestone compensation.',
      JSON.stringify(['React.js', 'Node.js', 'PostgreSQL', 'WebSockets', 'Tailwind CSS']),
      'https://github.com/devcollab-org/devcollab-suite'
    ]
  );

  const project2Id = uuidv4();
  await query(
    `INSERT INTO projects (id, owner_id, title, description, visibility, collaboration_type, status, technologies, repository_url, created_at, updated_at)
     VALUES ($1, $2, $3, $4, 'public', 'free', 'active', $5, $6, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
    [
      project2Id,
      users[1].id,
      'EcoTrace Carbon Footprint Tracker',
      'Open-source environmental tracking tool for developers and small teams to measure digital server emissions and compute offset recommendations.',
      JSON.stringify(['React.js', 'TypeScript', 'GraphQL', 'Python']),
      'https://github.com/ecotrace/tracker'
    ]
  );

  // Project Members
  // Project 1 members
  await query(`INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, 'owner')`, [uuidv4(), project1Id, users[0].id]);
  await query(`INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, 'contributor')`, [uuidv4(), project1Id, users[1].id]);
  await query(`INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, 'reviewer')`, [uuidv4(), project1Id, users[3].id]);

  // Project 2 members
  await query(`INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, 'owner')`, [uuidv4(), project2Id, users[1].id]);
  await query(`INSERT INTO project_members (id, project_id, user_id, role) VALUES ($1, $2, $3, 'contributor')`, [uuidv4(), project2Id, users[2].id]);

  // Tasks
  const task1Id = uuidv4();
  await query(
    `INSERT INTO tasks (id, project_id, assignee_id, title, description, status, priority, due_date)
     VALUES ($1, $2, $3, $4, $5, 'in_progress', 'high', $6)`,
    [
      task1Id,
      project1Id,
      users[1].id,
      'Build Monaco editor presence pill',
      'Display active peer cursors and connection status inside the collaborative code editor panel.',
      new Date(Date.now() + 86400000 * 5).toISOString()
    ]
  );

  await query(
    `INSERT INTO tasks (id, project_id, assignee_id, title, description, status, priority, due_date)
     VALUES ($1, $2, $3, $4, $5, 'completed', 'medium', $6)`,
    [
      uuidv4(),
      project1Id,
      users[0].id,
      'Set up PostgreSQL dual-mode schema',
      'Implement foreign key constraints, indexes, and zero-friction SQLite fallback for local developer setups.',
      new Date(Date.now() - 86400000).toISOString()
    ]
  );

  await query(
    `INSERT INTO tasks (id, project_id, assignee_id, title, description, status, priority, due_date)
     VALUES ($1, $2, $3, $4, $5, 'todo', 'urgent', $6)`,
    [
      uuidv4(),
      project1Id,
      users[3].id,
      'Verify HMAC webhook signature verification',
      'Ensure GitHub webhook requests are cryptographically verified and reject spoofed payloads.',
      new Date(Date.now() + 86400000 * 3).toISOString()
    ]
  );

  // GitHub Repository & Webhook Events
  const githubRepoId = uuidv4();
  await query(
    `INSERT INTO github_repositories (id, project_id, repository_id, owner, name, url, default_branch, visibility)
     VALUES ($1, $2, 'devcollab-org/devcollab-suite', 'devcollab-org', 'devcollab-suite', 'https://github.com/devcollab-org/devcollab-suite', 'main', 'public')`,
    [githubRepoId, project1Id]
  );

  await query(
    `INSERT INTO repository_events (id, repository_id, delivery_id, event_type, payload_summary, occurred_at)
     VALUES ($1, $2, $3, 'push', $4, CURRENT_TIMESTAMP)`,
    [
      uuidv4(),
      githubRepoId,
      'del_982138127391',
      JSON.stringify({ summary: 'Pushed 2 commits to branch main: Feat: Add Yjs sync provider; Fix: Token expiration' })
    ]
  );

  await query(
    `INSERT INTO repository_events (id, repository_id, delivery_id, event_type, payload_summary, occurred_at)
     VALUES ($1, $2, $3, 'pull_request', $4, CURRENT_TIMESTAMP)`,
    [
      uuidv4(),
      githubRepoId,
      'del_982138127392',
      JSON.stringify({ summary: 'PR #12 opened: "Implement responsive sidebar and dark-mode styling" by @priyasharma-code' })
    ]
  );

  // Documents
  const doc1Id = uuidv4();
  const sampleCode = `// DevCollab Collaborative Synchronizer
export function synchronizeDocument(docId, changes) {
  console.log(\`[Sync] Applying \${changes.length} delta mutations to \${docId}\`);
  // CRDT logic handles concurrent modifications safely
  return {
    synchronized: true,
    timestamp: Date.now()
  };
}

// Example usage:
const session = synchronizeDocument('doc_main', [{ op: 'insert', index: 0, text: '// Ready' }]);
console.log('Session status:', session.synchronized);
`;

  await query(
    `INSERT INTO editor_documents (id, project_id, file_path, content, language, updated_by)
     VALUES ($1, $2, 'src/syncEngine.js', $3, 'javascript', $4)`,
    [doc1Id, project1Id, sampleCode, users[0].id]
  );

  await query(
    `INSERT INTO editor_documents (id, project_id, file_path, content, language, updated_by)
     VALUES ($1, $2, 'README.md', '# DevCollab Core Suite\\n\\nCollaborative developer platform workspace with Monaco Editor & Yjs.', 'markdown', $3)`,
    [uuidv4(), project1Id, users[0].id]
  );

  // Reviews & Comments
  const reviewId = uuidv4();
  await query(
    `INSERT INTO reviews (id, project_id, author_id, title, status)
     VALUES ($1, $2, $3, $4, 'approved')`,
    [reviewId, project1Id, users[1].id, 'Review: Synchronizer engine delta batching']
  );

  await query(
    `INSERT INTO review_comments (id, review_id, author_id, file_path, line_number, body, suggestion, status)
     VALUES ($1, $2, $3, 'src/syncEngine.js', 2, 'Ensure timestamp formatting uses ISO 8601 for interoperability.', 'timestamp: new Date().toISOString()', 'accepted')`,
    [uuidv4(), reviewId, users[3].id]
  );

  // Collaboration Offers & Payments
  const offerId = uuidv4();
  await query(
    `INSERT INTO collaboration_offers (id, project_id, creator_id, contributor_id, terms, amount, currency, status)
     VALUES ($1, $2, $3, $4, $5, 450.00, 'USD', 'completed')`,
    [
      offerId,
      project1Id,
      users[0].id,
      users[1].id,
      'Design & implement Monaco editor real-time presence indicators and responsive sidebar controls.'
    ]
  );

  const paymentId = uuidv4();
  await query(
    `INSERT INTO payments (id, offer_id, provider_reference, amount, currency, status, method)
     VALUES ($1, $2, 'SANDBOX_TX_98721349_CONFIRMED', 450.00, 'USD', 'completed', 'sandbox_card')`,
    [paymentId, offerId]
  );

  // Notifications
  await query(
    `INSERT INTO notifications (id, user_id, type, message, related_entity_type, related_entity_id, is_read)
     VALUES ($1, $2, 'OFFER_ACCEPTED', 'Priya Sharma accepted your collaboration offer for DevCollab Core Suite.', 'OFFER', $3, TRUE)`,
    [uuidv4(), users[0].id, offerId]
  );

  await query(
    `INSERT INTO notifications (id, user_id, type, message, related_entity_type, related_entity_id, is_read)
     VALUES ($1, $2, 'PAYMENT_RECEIVED', 'Payment of USD 450.00 for "DevCollab Core Suite" was confirmed.', 'PAYMENT', $3, FALSE)`,
    [uuidv4(), users[1].id, paymentId]
  );

  console.log('[DevCollab Seed] Database seeded successfully!');
  console.log('Demo Login Credentials:');
  console.log('1. alex@example.com    / password123 (Project Owner)');
  console.log('2. priya@example.com   / password123 (Contributor)');
  console.log('3. marcus@example.com  / password123 (Backend Engineer)');
  console.log('4. elena@example.com   / password123 (Reviewer)');
}

if (require.main === module) {
  seed()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('[DevCollab Seed] Error:', err);
      process.exit(1);
    });
}

module.exports = seed;
