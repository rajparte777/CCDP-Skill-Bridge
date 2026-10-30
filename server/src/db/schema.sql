-- ============================================================
-- DevCollab Database Schema
-- Conforming to SRS Section 8 (Data Requirements & DB Design)
-- ============================================================

-- Users table (FR-01, FR-02, FR-03, FR-04, FR-05)
CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    bio TEXT DEFAULT '',
    avatar_url TEXT DEFAULT '',
    github_username VARCHAR(255) DEFAULT '',
    github_id VARCHAR(100) DEFAULT '',
    github_access_token TEXT DEFAULT '',
    portfolio_url TEXT DEFAULT '',
    is_public BOOLEAN DEFAULT TRUE,
    role VARCHAR(50) DEFAULT 'user',
    reset_token VARCHAR(255) DEFAULT '',
    reset_token_expires TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Skills table
CREATE TABLE IF NOT EXISTS skills (
    id TEXT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
);

-- User skills junction table
CREATE TABLE IF NOT EXISTS user_skills (
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    skill_id TEXT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, skill_id)
);

-- Developer connections table (FR-06, FR-07, FR-08)
CREATE TABLE IF NOT EXISTS connections (
    id TEXT PRIMARY KEY,
    requester_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('pending', 'accepted', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT chk_no_self_connection CHECK (requester_id <> receiver_id)
);

-- Projects table (FR-10, FR-11, FR-12)
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    visibility VARCHAR(20) NOT NULL DEFAULT 'public' CHECK (visibility IN ('public', 'private')),
    collaboration_type VARCHAR(20) NOT NULL DEFAULT 'free' CHECK (collaboration_type IN ('free', 'paid')),
    status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    technologies TEXT DEFAULT '[]', -- JSON array of strings
    repository_url TEXT DEFAULT '',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project members & RBAC table (FR-13, FR-14)
CREATE TABLE IF NOT EXISTS project_members (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(20) NOT NULL DEFAULT 'contributor' CHECK (role IN ('owner', 'contributor', 'reviewer', 'viewer')),
    joined_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, user_id)
);

-- Tasks table (FR-15)
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    assignee_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    description TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'todo' CHECK (status IN ('todo', 'in_progress', 'review', 'completed')),
    priority VARCHAR(20) DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high', 'urgent')),
    due_date TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GitHub repository linking (FR-16, FR-17)
CREATE TABLE IF NOT EXISTS github_repositories (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE UNIQUE,
    repository_id VARCHAR(100) NOT NULL,
    owner VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    default_branch VARCHAR(100) DEFAULT 'main',
    visibility VARCHAR(50) DEFAULT 'public',
    connected_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- GitHub repository webhook / activity events (FR-18, FR-19)
CREATE TABLE IF NOT EXISTS repository_events (
    id TEXT PRIMARY KEY,
    repository_id TEXT NOT NULL REFERENCES github_repositories(id) ON DELETE CASCADE,
    delivery_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    payload_summary TEXT NOT NULL, -- JSON formatted summary
    occurred_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Code Reviews (FR-26, FR-28)
CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    status VARCHAR(30) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'changes_requested', 'approved')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Code Review Comments & Suggestions (FR-27, FR-29)
CREATE TABLE IF NOT EXISTS review_comments (
    id TEXT PRIMARY KEY,
    review_id TEXT NOT NULL REFERENCES reviews(id) ON DELETE CASCADE,
    author_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    line_number INTEGER,
    body TEXT NOT NULL,
    suggestion TEXT DEFAULT '',
    status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved', 'accepted', 'rejected')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collaborative Editor Documents (FR-21, FR-24, FR-25)
CREATE TABLE IF NOT EXISTS editor_documents (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_path VARCHAR(255) NOT NULL,
    content TEXT DEFAULT '',
    language VARCHAR(50) DEFAULT 'javascript',
    snapshot_reference TEXT DEFAULT '',
    updated_by TEXT REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, file_path)
);

-- Document Updates log for CRDT / durability (FR-24)
CREATE TABLE IF NOT EXISTS document_updates (
    id TEXT PRIMARY KEY,
    document_id TEXT NOT NULL REFERENCES editor_documents(id) ON DELETE CASCADE,
    update_data TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Collaboration Offers (FR-30, FR-31, FR-32)
CREATE TABLE IF NOT EXISTS collaboration_offers (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    creator_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    contributor_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    terms TEXT NOT NULL,
    amount DECIMAL(12, 2) DEFAULT 0.00,
    currency VARCHAR(10) DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined', 'completed')),
    task_id TEXT REFERENCES tasks(id) ON DELETE SET NULL,
    milestone_title VARCHAR(255) DEFAULT '',
    deliverable_note TEXT DEFAULT '',
    deliverable_url TEXT DEFAULT '',
    milestone_status VARCHAR(30) NOT NULL DEFAULT 'in_progress' CHECK (milestone_status IN ('in_progress', 'submitted', 'approved')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Project Collaboration Requests / Applications (FR-06, FR-13, FR-14, FR-30, FR-31)
CREATE TABLE IF NOT EXISTS collaboration_requests (
    id TEXT PRIMARY KEY,
    project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) NOT NULL DEFAULT 'contributor' CHECK (role IN ('contributor', 'reviewer')),
    pitch TEXT NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'declined')),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (project_id, user_id)
);

-- Payment records & Provider Sandbox (FR-33, FR-34, FR-35)
CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY,
    offer_id TEXT NOT NULL REFERENCES collaboration_offers(id) ON DELETE CASCADE,
    provider_reference VARCHAR(255) NOT NULL UNIQUE,
    amount DECIMAL(12, 2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'USD',
    status VARCHAR(20) NOT NULL DEFAULT 'initiated' CHECK (status IN ('initiated', 'pending', 'completed', 'failed', 'refunded')),
    method VARCHAR(50) DEFAULT 'sandbox_card',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- In-app Notifications (FR-36, FR-37, FR-38)
CREATE TABLE IF NOT EXISTS notifications (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    message TEXT NOT NULL,
    related_entity_type VARCHAR(50) DEFAULT '',
    related_entity_id TEXT DEFAULT '',
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Security Audit Log (FR-41)
CREATE TABLE IF NOT EXISTS audit_events (
    id TEXT PRIMARY KEY,
    actor_id TEXT REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50) NOT NULL,
    entity_id TEXT NOT NULL,
    details TEXT DEFAULT '{}',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
