# SOFTWARE REQUIREMENTS SPECIFICATION
## DevCollab — Collaborative Development & Networking Platform
**Major Project Report — Requirements Specification**  
**Prepared for:** Computer Engineering Major Project  
**Version:** 1.0 | 19 October 2026

---

### Document Control
| Item | Details |
| :--- | :--- |
| **Project Name** | DevCollab — Collaborative Development & Networking Platform |
| **Document** | Software Requirements Specification (SRS) |
| **Version** | 1.0 |
| **Status** | Proposed baseline for academic project planning |
| **Prepared for** | Computer Engineering Major Project |
| **Primary Stack** | React.js, Node.js, Express.js, PostgreSQL, Socket.IO, GitHub API |
| **Additional Components** | Monaco Editor, Yjs, y-monaco, GitHub Webhooks, payment-provider sandbox |
| **Audience** | Project team, project guide, testers, and evaluators |

*Note: This SRS defines intended requirements and proposed design. It does not claim that the software has already been implemented or tested.*

---

## Contents
1. [Introduction](#1-introduction)
2. [Overall Description](#2-overall-description)
3. [System Scope and Boundaries](#3-system-scope-and-boundaries)
4. [Functional Requirements](#4-functional-requirements)
5. [External Interface Requirements](#5-external-interface-requirements)
6. [Non-Functional Requirements](#6-non-functional-requirements)
7. [System Architecture and Design](#7-system-architecture-and-design)
8. [Data Requirements and Database Design](#8-data-requirements-and-database-design)
9. [Use Cases](#9-use-cases)
10. [Business Rules](#10-business-rules)
11. [Testing and Acceptance Criteria](#11-testing-and-acceptance-criteria)
12. [Risks, Constraints, and Assumptions](#12-risks-constraints-and-assumptions)
13. [Implementation Plan](#13-implementation-plan)
14. [Future Enhancements](#14-future-enhancements)
15. [Glossary and References](#15-glossary-and-references)

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) defines the functional and non-functional requirements for DevCollab, a web-based platform that brings together developer networking, project tracking, GitHub repository integration, real-time collaborative code editing, code review, and free or paid project collaboration. It provides a shared reference for implementation, testing, demonstration, and academic evaluation.

### 1.2 Intended Audience
- Project developers implementing the frontend, backend, database, and integrations.
- Project guide and academic evaluators reviewing scope and feasibility.
- Testers verifying functionality, security, reliability, and usability.
- Future maintainers extending the platform.

### 1.3 Product Vision
DevCollab helps developers discover suitable collaborators, create and manage software projects, connect existing GitHub repositories, edit shared code in real time, exchange review comments, and participate in free or paid collaborations. It is a project-centered collaboration platform, not a conventional job portal.

### 1.4 Definitions and Acronyms
| Term | Meaning |
| :--- | :--- |
| **SRS** | Software Requirements Specification |
| **API** | Application Programming Interface |
| **REST** | Representational State Transfer |
| **OAuth** | Authorization protocol used to grant limited access |
| **Webhook** | HTTP event notification sent by an external service |
| **Socket.IO** | Library for bidirectional event-based communication |
| **Yjs** | Shared data type framework for collaborative applications |
| **RBAC** | Role-Based Access Control |
| **MVP** | Minimum Viable Product |
| **CRDT** | Conflict-free Replicated Data Type |
| **PR** | Pull Request |
| **CRUD** | Create, Read, Update, Delete |

---

## 2. Overall Description

### 2.1 Product Perspective
DevCollab is a browser-based full-stack application. React.js provides the user interface. Node.js and Express.js expose REST APIs and enforce business rules. PostgreSQL stores application records. Socket.IO supports live notifications and presence events. Monaco Editor provides the coding interface, while Yjs with a Monaco binding synchronizes simultaneous edits. GitHub APIs and webhooks connect project records to repository activity.

### 2.2 Product Objectives
- Provide developer profiles and professional connections.
- Allow users to create, discover, and manage software projects.
- Integrate GitHub repositories and display repository activity.
- Allow authorized collaborators to edit shared files simultaneously.
- Support structured code review, corrections, and suggestions.
- Support free collaboration and paid collaboration agreements.
- Deliver timely notifications for important project events.
- Protect user accounts, private projects, code, and payment records.

### 2.3 Stakeholders
| Stakeholder | Interest / Responsibility |
| :--- | :--- |
| **Guest** | Browse public profiles and public project summaries, subject to access rules. |
| **Registered Developer** | Manage profile, connect with developers, create projects, and contribute. |
| **Project Owner** | Configure project, invite members, assign roles/tasks, and manage collaboration terms. |
| **Collaborator** | Work on shared files, tasks, and reviews within assigned permissions. |
| **Reviewer** | Inspect code changes and submit review comments or decisions. |
| **Administrator** | Moderate reported content and manage platform operations, if admin functionality is included. |
| **Payment Provider** | Process payment actions and report verified payment events. |
| **Project Guide / Evaluator** | Review requirements, implementation, testing, and demonstration. |

### 2.4 User Classes
- **Guest**: unauthenticated visitor with access only to public information.
- **Registered user**: authenticated account holder who can manage a profile and participate in permitted platform features.
- **Project owner**: user who owns a project and manages membership, tasks, and collaboration terms.
- **Project member**: invited or accepted participant with viewer, contributor, reviewer, or owner permissions.
- **Administrator**: trusted operator with limited moderation and support capabilities, if implemented.

### 2.5 Operating Environment
- **Client**: current versions of Chrome, Edge, Firefox, or other modern browsers.
- **Frontend**: React.js with JavaScript or TypeScript; responsive CSS framework or custom CSS.
- **Backend**: supported Node.js LTS release and Express.js.
- **Database**: PostgreSQL.
- **Real-time**: Socket.IO for application events; a compatible WebSocket provider for Yjs synchronization.
- **Code editor**: Monaco Editor and y-monaco binding.
- **External services**: GitHub API and webhook delivery; payment provider sandbox for academic testing.
- **Deployment**: HTTPS-enabled hosting for frontend/backend and a managed or self-hosted PostgreSQL instance.

### 2.6 Design and Implementation Constraints
- GitHub API permissions and rate limits constrain repository access and operations.
- GitHub events may arrive asynchronously or more than once; webhook processing must be idempotent.
- Real-time editing requires synchronization and conflict handling beyond simple Socket.IO message broadcasting.
- Only authorized project members may access private project files and editor sessions.
- Actual payments depend on provider onboarding, supported regions, and compliance requirements. A sandbox is acceptable for the academic prototype.
- Executing arbitrary user code is outside the initial scope.

---

## 3. System Scope and Boundaries

### 3.1 In Scope
- Account registration, login, logout, and profile management.
- Developer connections and project/activity feed.
- Project creation, discovery, membership, roles, and task management.
- GitHub repository linking, repository metadata, commit/PR activity, and webhook-based notifications.
- Shared browser-based code editor with real-time collaborative editing.
- Code review comments, suggestions, and review status.
- Free collaboration and paid collaboration offers/agreements.
- Payment status tracking through a provider sandbox or supported provider integration.
- In-app notifications and basic administration/moderation if time permits.

### 3.2 Out of Scope for Initial Release
- Replacing GitHub as a full source-control hosting service.
- Building a complete CI/CD pipeline or production-grade cloud IDE.
- Running arbitrary user code on the main application server.
- Guaranteed escrow, dispute arbitration, tax processing, or global payout support.
- Recruitment listings, applicant tracking, and conventional job applications.
- Native Android/iOS applications.
- Enterprise-scale analytics, advanced recommendation AI, and microservice deployment.

### 3.3 Existing System and Problem Statement
Developers commonly use separate tools for source control, professional networking, live collaboration, code review, and payment coordination. Moving between tools can fragment project context, updates, feedback, and contributor coordination. Git hosting tools primarily manage repositories; professional networks primarily manage profiles and connections; collaborative editors focus on simultaneous editing. DevCollab proposes a unified project-centered workflow while continuing to use GitHub for repository operations.

### 3.4 Proposed System
The proposed system connects developer identities, project workspaces, repository events, shared editing sessions, review workflows, and collaboration agreements. Users can discover a project or collaborator, join a project with explicit permissions, review activity, edit shared files, submit feedback, and track collaboration terms in one web application.

| Aspect | Existing fragmented workflow | Proposed DevCollab workflow |
| :--- | :--- | :--- |
| **Developer identity** | Profiles may be spread across services | Developer profile and project history in one place |
| **Project updates** | Users switch between tools | Project activity feed with GitHub event integration |
| **Code collaboration** | Separate editor or repository workflow | Shared editor plus GitHub repository integration |
| **Corrections** | Feedback may be informal or disconnected | Structured review comments and suggestions |
| **Team formation** | Coordination across separate channels | Connections, invitations, membership, and tasks |
| **Earning** | Payment terms may be tracked elsewhere | Collaboration offers and payment status records |

---

## 4. Functional Requirements

| ID | Requirement | Description | Priority |
| :--- | :--- | :--- | :--- |
| **FR-01** | Account registration | The system shall allow a visitor to register using a valid name, email address, and password. | Must |
| **FR-02** | Authentication | The system shall authenticate registered users and provide a secure logout mechanism. | Must |
| **FR-03** | Password security | The system shall store only a salted password hash, never a plaintext password. | Must |
| **FR-04** | Profile management | The system shall allow a user to create and update a profile containing a bio, skills, and optional portfolio links. | Must |
| **FR-05** | Public profile | The system shall display only profile fields permitted by the user's visibility settings. | Must |
| **FR-06** | Connection request | The system shall allow users to send connection requests to other users. | Must |
| **FR-07** | Connection response | The recipient shall be able to accept or reject a pending request. | Must |
| **FR-08** | Connection integrity | The system shall prevent duplicate active connection requests and self-connections. | Must |
| **FR-09** | Activity feed | The system shall display relevant public project posts and activity according to visibility and access rules. | Should |
| **FR-10** | Project creation | An authenticated user shall be able to create a project with a title, description, technologies, visibility, and collaboration type. | Must |
| **FR-11** | Project discovery | The system shall allow users to search or filter projects by title, technology, or collaboration type. | Must |
| **FR-12** | Project editing | The project owner shall be able to update project metadata and archive or close a project. | Must |
| **FR-13** | Membership | The owner shall be able to invite users and manage project membership. | Must |
| **FR-14** | Role enforcement | The system shall enforce project roles such as owner, contributor, reviewer, and viewer. | Must |
| **FR-15** | Task management | Authorized members shall be able to create tasks, assign tasks, update status, and view task progress. | Should |
| **FR-16** | Repository linking | A project owner or authorized member shall be able to link a GitHub repository after authorization. | Must |
| **FR-17** | Repository metadata | The system shall retrieve and display permitted repository metadata, such as repository name, URL, default branch, and visibility. | Must |
| **FR-18** | Repository activity | The system shall display supported commit and pull request activity obtained from GitHub. | Must |
| **FR-19** | Webhook processing | The backend shall validate GitHub webhook signatures and process subscribed events idempotently. | Must |
| **FR-20** | GitHub authorization | The system shall request only permissions required for the selected integration features. | Must |
| **FR-21** | Shared editor | Authorized project members shall be able to open shared text/code files in a browser-based editor. | Must |
| **FR-22** | Concurrent editing | The system shall synchronize concurrent edits using a collaboration mechanism such as Yjs. | Must |
| **FR-23** | Presence | The editor shall indicate active collaborators where technically available. | Should |
| **FR-24** | Document persistence | The system shall persist sufficient document state or updates to restore shared documents after a service restart. | Must |
| **FR-25** | Document authorization | The backend shall verify project membership and edit permissions before joining or modifying a shared document. | Must |
| **FR-26** | Review creation | Authorized users shall be able to create a review for a project change or file. | Must |
| **FR-27** | Review comments | Reviewers shall be able to attach comments to a file and, where supported, a line or code range. | Must |
| **FR-28** | Review decision | The system shall allow an authorized reviewer to mark a review as pending, changes requested, or approved. | Should |
| **FR-29** | Correction suggestions | The system shall support submitting and accepting or rejecting a proposed correction. | Should |
| **FR-30** | Free collaboration | A project owner shall be able to label a project or collaboration offer as unpaid/free. | Must |
| **FR-31** | Paid collaboration offer | An owner shall be able to define compensation terms, currency, scope, and relevant task or milestone details. | Must |
| **FR-32** | Offer acceptance | A contributor shall be able to accept or decline a collaboration offer; changes shall be recorded. | Must |
| **FR-33** | Payment initiation | The system shall initiate payment through a configured provider when enabled, without storing raw card data. | Should |
| **FR-34** | Payment verification | Payment status shall be updated only from a verified provider response or webhook, not from a client-side claim. | Must |
| **FR-35** | Payment history | Authorized users shall be able to view relevant payment status and transaction references. | Must |
| **FR-36** | Notifications | The system shall create in-app notifications for invitations, connections, reviews, tasks, repository events, and payment status changes. | Must |
| **FR-37** | Real-time delivery | The system shall deliver supported notifications and project events over Socket.IO to authorized recipients. | Must |
| **FR-38** | Notification state | Users shall be able to mark notifications as read. | Should |
| **FR-39** | Content reporting | Users should be able to report abusive or misleading profile/project content. | Could |
| **FR-40** | Administration | If an admin module is implemented, authorized administrators shall be able to review reports and take documented moderation actions. | Could |
| **FR-41** | Audit trail | The system shall record important security-sensitive actions, such as role changes and payment status changes, without logging secrets. | Should |
| **FR-42** | Error handling | The system shall return meaningful API error responses without exposing secrets, stack traces, or internal credentials. | Must |

---

## 5. External Interface Requirements

### 5.1 User Interface
- Registration and login pages with validation and clear error messages.
- Developer profile page showing permitted profile information, skills, connections, and public projects.
- Dashboard containing project activity, notifications, and relevant project links.
- Project details page with overview, members, tasks, repository activity, reviews, and collaboration terms.
- Collaborative editor with file navigation, syntax highlighting, editor status, and collaborator presence.
- Code review interface for comments, suggestions, and review status.
- Offer/payment view showing terms, amount, currency, status, and provider reference where applicable.
- Responsive layouts for desktop, tablet, and mobile browsers; the editor may have a desktop-first layout.

### 5.2 Software Interfaces
| Interface | Purpose / Contract |
| :--- | :--- |
| **React ↔ Express REST API** | JSON requests/responses over HTTPS; consistent status codes and validation errors. |
| **React ↔ Socket.IO** | Authenticated real-time events for notifications, project rooms, and presence. |
| **Yjs provider ↔ shared document** | Synchronization of shared text/code state; validate authorization before joining. |
| **Express ↔ PostgreSQL** | Parameterized SQL or a trusted database layer; transactions for multi-record operations. |
| **Backend ↔ GitHub API** | Authorized API requests for repositories and activity, subject to scopes and rate limits. |
| **GitHub ↔ webhook endpoint** | Signed event payloads; verify signature and deduplicate delivery. |
| **Backend ↔ payment provider** | Server-side payment creation and verified webhook/status processing. |

### 5.3 Communication Interfaces
- HTTPS for browser-to-server communication.
- WebSocket or Socket.IO transport for supported real-time application events.
- JSON as the standard REST API payload format.
- Environment variables or secret management for API credentials and database configuration.
- Webhook endpoints must be reachable over HTTPS in deployed environments.

### 5.4 API Response Convention
Successful requests shall return appropriate HTTP status codes and structured JSON. Invalid input shall return 400 or 422; unauthenticated requests 401; unauthorized requests 403; missing resources 404; conflicts 409; and unexpected server errors 500 with a generic public message and a server-side correlation identifier.  
Example error shape:
```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Please check the submitted fields."
  }
}
```

---

## 6. Non-Functional Requirements

| ID | Quality Attribute | Requirement |
| :--- | :--- | :--- |
| **NFR-01** | Security | Passwords must be hashed with a modern password-hashing algorithm; secrets must not be committed to source control. |
| **NFR-02** | Authorization | Every private API, editor document, and real-time room must enforce server-side access control. |
| **NFR-03** | Privacy | The system must honor public/private project visibility and avoid exposing private repository details to unauthorized users. |
| **NFR-04** | Performance | Under the agreed demo workload and normal network conditions, common API reads should target a 95th-percentile response time below 2 seconds, excluding external provider latency. |
| **NFR-05** | Live responsiveness | Under the agreed demo workload and normal network conditions, collaborative edits should typically appear to connected peers within 500 ms; this is a target, not a guarantee under all networks. |
| **NFR-06** | Availability | The prototype should recover cleanly after a controlled application restart, with durable records preserved in PostgreSQL. |
| **NFR-07** | Reliability | Webhook and payment event handlers must be idempotent and safe to retry. |
| **NFR-08** | Data integrity | Database constraints and transactions must protect relationships and avoid partial updates. |
| **NFR-09** | Usability | Primary workflows should be understandable without technical setup beyond account creation and, for GitHub features, authorization. |
| **NFR-10** | Compatibility | The core application should support current versions of major desktop browsers. |
| **NFR-11** | Maintainability | Backend features should be separated into modules, use consistent naming, validation, logging, and documented API contracts. |
| **NFR-12** | Scalability | The architecture should allow horizontal scaling later; Socket.IO adapter and shared persistence may be needed for multiple backend instances. |
| **NFR-13** | Accessibility | Forms should have labels, keyboard focus visibility, readable contrast, and useful error announcements. |
| **NFR-14** | Backup and recovery | The deployment should define a database backup approach and periodically verify restoration where the hosting environment permits. |
| **NFR-15** | Auditability | Important project permission, offer, and payment state changes should be traceable by actor and timestamp. |
| **NFR-16** | Legal/compliance | The system must follow the selected GitHub integration terms and payment provider requirements applicable to the deployment. |

---

## 7. System Architecture and Design

### 7.1 Logical Architecture
| Layer | Components | Responsibilities |
| :--- | :--- | :--- |
| **Presentation** | React.js, router, UI components, Monaco Editor | Rendering, form validation, user interaction, API calls. |
| **Application/API** | Node.js, Express.js, route modules, validation middleware | Authentication, business rules, authorization, REST endpoints. |
| **Real-time** | Socket.IO and Yjs WebSocket provider | Notifications, room events, presence, collaborative document synchronization. |
| **Persistence** | PostgreSQL and optional object storage | Accounts, projects, membership, reviews, notifications, offers, payment references, document state. |
| **Integrations** | GitHub API/webhooks, payment provider | Repository activity, authorized operations, payment events. |
| **Operations** | Logging, environment configuration, backups, deployment | Monitoring, configuration, recovery, and safe operations. |

### 7.2 Suggested Backend Module Structure
```
src/
  config/              — environment loading, database configuration, integration configuration
  middleware/          — authentication, authorization, request validation, error handling, rate limiting
  modules/
    auth/              — registration, login, session/token handling
    users/             — profile and skill management
    connections/       — connection requests and relationships
    projects/          — project CRUD, membership, visibility
    tasks/             — task assignment and status
    github/            — OAuth/app authorization, API client, webhook verification and processing
    editor/            — document authorization, persistence and Yjs provider integration
    reviews/           — reviews, comments and suggestions
    collaborations/    — free/paid offers and acceptance
    payments/          — provider integration, webhook verification and payment ledger references
    notifications/     — notification persistence and real-time delivery
  realtime/            — Socket.IO setup, event schemas and room authorization
  db/                  — migrations, seeds and database access
  app.js / server.js   — application initialization and server startup
```

### 7.3 Suggested Frontend Structure
```
src/
  app/                 — router, global providers and application layout
  components/          — reusable UI, forms, modals, navigation and status indicators
  features/
    auth/              — registration, login and logout
    profile/           — developer profile and skills
    network/           — connections and feed
    projects/          — discovery, details, members and tasks
    github/            — repository linking and activity
    editor/            — Monaco, Yjs binding and collaboration presence
    reviews/           — review comments and suggestions
    collaboration/     — free/paid offers and payment status
    notifications/     — notification list and real-time updates
  services/            — REST client and integration helpers
  hooks/               — reusable React hooks
  types/               — shared data types if TypeScript is used
```

### 7.4 GitHub Integration Flow
1. An authenticated user chooses to connect a GitHub repository.
2. The backend uses a supported authorization flow and requests the minimum permissions required.
3. The backend validates the selected repository and stores the repository identifier and required metadata.
4. The owner configures supported webhook events if the integration has sufficient permissions.
5. When GitHub sends an event, the backend verifies the webhook signature and delivery metadata.
6. The backend deduplicates the event, updates project activity, and creates notifications for authorized members.
7. Users open the project dashboard to view repository activity and follow the source repository on GitHub for full source-control operations.

### 7.5 Live Editing Flow
1. A user opens a project document; the backend verifies identity, membership, and edit permissions.
2. The client loads the persisted document state and joins the authorized collaboration session.
3. Monaco Editor displays the file and is bound to a shared Yjs document.
4. Yjs synchronizes concurrent edits through a compatible WebSocket provider and resolves concurrent changes using its shared data model.
5. The collaboration service persists updates or snapshots so the document can be restored.
6. When the session closes, presence is updated and the user's access remains subject to project membership.

### 7.6 Paid Collaboration Flow
1. The project owner creates an offer describing scope, amount, currency, milestones or tasks, and terms.
2. The contributor reviews and accepts or declines the offer.
3. If payments are enabled, the backend creates a provider transaction using server-side credentials.
4. The provider reports payment status through a verified webhook or server-side status query.
5. The backend records the provider reference and status; it does not trust a browser-only success signal.
6. Users can view the current status and relevant history. Disputes, escrow, and automatic payouts are not assumed unless separately implemented.

---

## 8. Data Requirements and Database Design

### 8.1 Core Entities
| Entity | Key Attributes | Relationships |
| :--- | :--- | :--- |
| **User** | `id`, `name`, `email`, `password_hash`, `bio`, `avatar_url`, `created_at` | Owns projects; has skills, connections, notifications and offers. |
| **Skill** | `id`, `name` | Linked to users through `user_skills`. |
| **Connection** | `id`, `requester_id`, `receiver_id`, `status`, `created_at` | Relates two users; status is `pending`, `accepted`, or `rejected`. |
| **Project** | `id`, `owner_id`, `title`, `description`, `visibility`, `collaboration_type`, `status` | Owned by a user; has members, tasks, repo links, reviews, documents and offers. |
| **ProjectMember** | `project_id`, `user_id`, `role`, `joined_at` | Associates a user with a project and role (`owner`, `contributor`, `reviewer`, `viewer`). |
| **Task** | `id`, `project_id`, `assignee_id`, `title`, `description`, `status`, `due_date` | Belongs to a project; may be assigned to a member. |
| **GitHubRepository** | `id`, `project_id`, `repository_id`, `owner`, `name`, `url`, `visibility` | Associates an external repository with a project. |
| **RepositoryEvent** | `id`, `repository_id`, `delivery_id`, `event_type`, `payload_summary`, `occurred_at` | Stores deduplicated webhook/activity records. |
| **Review** | `id`, `project_id`, `author_id`, `status`, `created_at` | Contains review comments and suggestions. |
| **ReviewComment** | `id`, `review_id`, `file_path`, `line_number`, `body`, `status` | Belongs to a review. |
| **EditorDocument** | `id`, `project_id`, `file_path`, `snapshot_reference`, `updated_at` | Represents a shared code/text document. |
| **DocumentUpdate** | `id`, `document_id`, `update_data`, `created_at` | Optional durable Yjs update log or equivalent storage. |
| **CollaborationOffer**| `id`, `project_id`, `contributor_id`, `terms`, `amount`, `currency`, `status` | Tracks free or paid collaboration agreements. |
| **Payment** | `id`, `offer_id`, `provider_reference`, `amount`, `currency`, `status`, `created_at` | Tracks payment status and provider reference. |
| **Notification** | `id`, `user_id`, `type`, `message`, `related_entity_id`, `is_read`, `created_at` | Belongs to a recipient. |
| **AuditEvent** | `id`, `actor_id`, `action`, `entity_type`, `entity_id`, `created_at` | Records important actions without sensitive secrets. |

### 8.2 Data Integrity Rules
- Email addresses must be unique after normalization.
- A user cannot create a connection to themselves.
- Only one active connection relationship should exist for a given user pair; enforce consistent ordering or application logic.
- A project must have a valid owner, and membership records must reference existing users and projects.
- Role values and status values must be constrained to defined enumerations.
- Money values must use an exact decimal or integer minor-unit representation and an explicit currency code.
- Provider event IDs or delivery IDs must be unique to prevent duplicate processing.
- Private document content and repository credentials must not be returned to unauthorized clients.
- Deletion behavior must be explicitly defined; use soft deletion or controlled cascading according to retention needs.

### 8.3 Data Retention
The prototype should define retention rules for account data, project content, editor updates, webhook event summaries, audit records, and payment references. Credentials and secrets must never be written to logs. Deletion of a user or project must account for contractual/payment records and external GitHub repositories; deleting a DevCollab record must not silently delete a GitHub repository.

---

## 9. Use Cases

| ID | Use Case | Actor | Main Success Scenario |
| :--- | :--- | :--- | :--- |
| **UC-01** | Register and log in | Guest / Registered user | User submits valid details; system validates input, stores a password hash, and creates an authenticated session. Invalid input returns a safe error. |
| **UC-02** | Connect with a developer | Registered user | User opens a profile, sends a request, and the recipient accepts or rejects it. System updates status and notifies participants. |
| **UC-03** | Create a project | Registered user / Owner | Owner enters project details and visibility. System validates and saves the project with the owner role. |
| **UC-04** | Invite a collaborator | Project owner | Owner selects a user and role. System checks authority, creates an invitation or membership record, and notifies the invitee. |
| **UC-05** | Link GitHub repository | Project owner / authorized member | User authorizes access, selects a repository, and confirms linking. Backend validates access and stores repository metadata. |
| **UC-06** | View repository activity | Project member | Member opens project activity. System returns permitted events from stored webhook records and/or GitHub API. |
| **UC-07** | Edit code together | Authorized editor | Members open the same document. System authorizes sessions, synchronizes edits, shows presence, and persists state. |
| **UC-08** | Submit a code review | Reviewer / project member | Reviewer selects a change or file, submits comments/suggestions, and records a review status. |
| **UC-09** | Create collaboration offer | Project owner | Owner selects free or paid type and enters scope/terms. System validates and stores the offer. |
| **UC-10** | Accept paid offer | Contributor | Contributor reviews terms and accepts. System records acceptance and exposes payment initiation if configured. |
| **UC-11** | Verify payment status | Payment provider / backend | Provider sends a signed event or backend checks status. System verifies it, deduplicates it, updates the payment record, and notifies relevant parties. |
| **UC-12** | Receive notification | Registered user | A relevant event creates a notification. The system stores it and delivers it to the authenticated recipient in real time when connected. |

### 9.1 Use Case: Collaborative Editing
- **Preconditions**: the user is authenticated, is a member of the project, and has editor permission. The document exists or can be created by an authorized user.
1. User opens the project editor and selects a file.
2. Backend validates project membership and role.
3. Client loads the persisted shared document state.
4. Client connects to the collaboration provider and joins the authorized document session.
5. User edits the file; the shared document engine synchronizes changes with other connected editors.
6. System persists updates or snapshots and updates presence.
7. On disconnection, the client reconnects and resynchronizes from durable state.
- **Alternate flow**: if access is denied, the editor is not joined and no document content is sent. If the network drops, the client displays connection status and attempts a safe reconnection.

### 9.2 Use Case: GitHub Webhook Processing
- **Preconditions**: a repository is linked and the webhook endpoint is configured. The backend has the required webhook secret.
1. GitHub sends an event to the webhook endpoint.
2. Backend validates the signature against the raw request body and configured secret.
3. Backend checks delivery/event identifiers to avoid duplicate processing.
4. Backend stores a minimal event summary and updates the project's activity timeline.
5. Backend creates notifications for relevant authorized members.
6. Backend returns a successful response after accepted processing; failures are logged without exposing secrets.

---

## 10. Business Rules
- **BR-01**: A user must be authenticated to create projects, send connection requests, join private projects, edit documents, submit reviews, or create collaboration offers.
- **BR-02**: Project visibility is enforced by the backend on every API and real-time channel.
- **BR-03**: Only the project owner or a user with appropriate permissions can invite members or change roles.
- **BR-04**: A repository link does not grant permissions beyond those authorized by GitHub and the DevCollab project membership.
- **BR-05**: GitHub source-control operations remain governed by GitHub permissions and the selected integration's scopes.
- **BR-06**: Shared editing access is granted only to authorized members; viewer roles cannot submit edits.
- **BR-07**: A code review decision must record the reviewer and timestamp.
- **BR-08**: A paid offer must specify amount, currency, scope, and acceptance status before payment initiation.
- **BR-09**: Payment status is authoritative only after server-side verification with the provider.
- **BR-10**: Free collaboration must not require a payment transaction.
- **BR-11**: Duplicate webhook deliveries and payment events must not create duplicate business actions.
- **BR-12**: Users may not impersonate another account or access another user's private project data.
- **BR-13**: DevCollab is not a job portal; project discovery is organized around projects and collaboration.
- **BR-14**: The initial system will not execute user code on the main application server.

---

## 11. Testing and Acceptance Criteria

### 11.1 Testing Types
- **Unit testing**: validation functions, permission rules, status transitions, and business logic.
- **API integration testing**: authentication, project CRUD, connections, membership, reviews, offers, and notifications.
- **Database testing**: constraints, relationships, transactions, and migration/recovery behavior.
- **GitHub integration testing**: authorization, repository access, webhook signature verification, duplicate events, and rate-limit/error handling.
- **Real-time testing**: two or more browser sessions editing the same document, reconnect behavior, presence, and unauthorized room access.
- **Security testing**: invalid tokens, privilege escalation attempts, private project access, input validation, secret leakage, and rate limiting.
- **Payment testing**: sandbox transactions, invalid webhook signatures, duplicate provider events, and failed/cancelled payments.
- **Usability testing**: navigation, form errors, responsive behavior, and clear status feedback.

### 11.2 Acceptance Criteria
| ID | Acceptance Test | Expected Result |
| :--- | :--- | :--- |
| **AT-01** | Register with valid and invalid details | Valid account is created; invalid or duplicate email is rejected safely. |
| **AT-02** | Attempt to access private project as non-member | Backend denies access and does not disclose private content. |
| **AT-03** | Send and accept a connection request | Request status changes correctly and relevant users are notified. |
| **AT-04** | Create a project and invite a member | Project is persisted and membership permissions work as configured. |
| **AT-05** | Link a test GitHub repository | Repository metadata is stored and visible to authorized project members. |
| **AT-06** | Send valid and invalid webhook payloads | Valid signed events are processed once; invalid signatures are rejected. |
| **AT-07** | Open the same editor document in two browsers | Changes made in one browser appear in the other without manual refresh, within the agreed test environment target. |
| **AT-08** | Restart backend after editing | Persisted document state can be restored according to the chosen persistence design. |
| **AT-09** | Submit a review and correction | Review/comment is stored and status is displayed accurately. |
| **AT-10** | Create and accept a free offer | Agreement is recorded without a payment transaction. |
| **AT-11** | Test paid offer in provider sandbox | Payment state changes only after verified provider confirmation. |
| **AT-12** | Inspect notifications | Only authorized recipients receive the relevant notifications. |
| **AT-13** | Attempt viewer edit or unauthorized Socket.IO join | Server rejects the operation. |
| **AT-14** | Run primary workflows on supported browsers | Core features work without critical errors. |

### 11.3 Definition of Done
- Acceptance criteria for the feature pass in a documented test.
- Authorization checks are enforced on the backend.
- Input validation and safe error handling are implemented.
- Database changes have migrations or reproducible schema scripts.
- Relevant environment variables are documented without real secrets.
- README includes setup, configuration, test, and run instructions.
- Known limitations are documented honestly.

---

## 12. Risks, Constraints, and Assumptions
| Risk / Assumption | Impact | Mitigation |
| :--- | :--- | :--- |
| **GitHub permissions or rate limits** | Repository integration may be limited or throttled. | Request minimum scopes, handle API errors, cache metadata, and explain authorization needs. |
| **Webhook delivery failures or duplicates** | Activity feed may be delayed or duplicated. | Verify signatures, deduplicate deliveries, retry safely, and log processing state. |
| **Concurrent editing complexity** | Edits may conflict or be lost if synchronization is poorly designed. | Use Yjs with a compatible provider; test simultaneous edits and reconnection; persist snapshots/updates. |
| **Private code leakage** | Serious confidentiality issue. | Enforce authorization at REST, Socket.IO, and document-provider layers; never trust client-supplied project IDs alone. |
| **Payment-provider limitations** | Live payments may be unavailable for the academic demo. | Use sandbox mode; isolate provider code; do not claim escrow or payouts unless implemented. |
| **Time constraints** | Full feature scope may exceed the semester timeline. | Deliver the MVP in phases; defer admin analytics and advanced payment features. |
| **External service outage** | GitHub or payment integration can become temporarily unavailable. | Display status clearly, retry safely, and keep core project records accessible where possible. |
| **Hosting constraints** | WebSockets or webhook delivery may not work on all hosting tiers. | Validate host support early and use HTTPS with a deployment that supports long-lived connections. |

### 12.1 Assumptions
- Users have a modern browser and internet access.
- Users who need GitHub integration have a GitHub account and grant the required permissions.
- The deployment has access to PostgreSQL and supports backend webhooks and WebSocket connections.
- The academic version may use a payment-provider sandbox rather than real-money transfers.
- Users are responsible for the content and permissions of repositories they connect.

---

## 13. Implementation Plan
| Phase | Deliverables | Exit Criteria |
| :--- | :--- | :--- |
| **1. Foundation** | Repository setup, React shell, Express server, PostgreSQL schema, authentication | User can register, log in, and update a profile. |
| **2. Networking and projects** | Profiles, connections, project CRUD, membership, tasks | Users can create projects and collaborate through membership. |
| **3. GitHub integration** | Repository linking, activity feed, webhook endpoint | Test repository events appear once in project activity. |
| **4. Collaborative editor** | Monaco, Yjs, provider, authorization, persistence | Two authorized browser sessions can edit the same document. |
| **5. Reviews and notifications** | Review workflows, correction suggestions, notification feed | Users can review changes and receive relevant events. |
| **6. Collaboration agreements** | Free/paid offers, acceptance, payment sandbox | Offer and payment states are traceable and verified. |
| **7. QA and deployment** | Automated/manual tests, deployment, README, report and demo | Acceptance tests pass and limitations are documented. |

### 13.1 Suggested Development Practices
- Use Git branches and pull requests for the DevCollab source code.
- Keep frontend and backend configuration in separate environment files; commit only example files.
- Use database migrations rather than relying only on manual database edits.
- Document API routes and payloads as they are added.
- Use seed/demo data that contains no real personal or payment information.
- Test permissions before integrating private repositories or live payment operations.

---

## 14. Future Enhancements
- Advanced project recommendations based on skills and interests.
- Team chat, voice/video meetings, and calendar integration.
- CI/CD status integration and automated test results from GitHub Actions.
- More advanced pull-request review synchronization and branch-aware code review.
- Secure isolated code execution or preview environments.
- Versioned collaborative documents, cursor selections, and richer editor presence.
- Reputation signals based on verified contributions and completed projects.
- Escrow, milestones, dispute handling, and broader payment-provider support, subject to legal and provider requirements.
- Accessibility enhancements and multilingual UI.
- Scaling real-time collaboration with shared adapters and durable document storage.

---

## 15. Glossary and References
### 15.1 Glossary
- **Collaborator**: A user authorized to participate in a project.
- **Project owner**: The user responsible for project configuration and membership.
- **Repository**: A GitHub-hosted source-code project with version history.
- **Commit**: A recorded set of changes in a Git repository.
- **Pull request**: A GitHub workflow for proposing and reviewing changes.
- **Shared document**: A code/text file synchronized among authorized editing sessions.
- **Presence**: An indication that a collaborator is currently connected or active.
- **Payment status**: A recorded state based on verified provider information.
- **Webhook signature**: A cryptographic value used to verify that a webhook payload came from the expected sender.

### 15.2 Technical References
- GitHub REST API: `https://docs.github.com/en/rest`
- GitHub Webhooks: `https://docs.github.com/en/webhooks`
- GitHub Apps: `https://docs.github.com/en/apps/creating-github-apps`
- Socket.IO documentation: `https://socket.io/docs/v4/`
- Yjs documentation: `https://docs.yjs.dev/`
- Yjs Monaco binding: `https://docs.yjs.dev/ecosystem/editor-bindings/monaco`
- Monaco Editor: `https://microsoft.github.io/monaco-editor/`
- PostgreSQL documentation: `https://www.postgresql.org/docs/`
- Express documentation: `https://expressjs.com/`
- Node.js documentation: `https://nodejs.org/docs/`
