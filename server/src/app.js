const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const env = require('./config/env');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');

// Route imports
const authRoutes = require('./modules/auth/authRoutes');
const userRoutes = require('./modules/users/userRoutes');
const connectionRoutes = require('./modules/connections/connectionRoutes');
const projectRoutes = require('./modules/projects/projectRoutes');
const taskRoutes = require('./modules/tasks/taskRoutes');
const githubRoutes = require('./modules/github/githubRoutes');
const editorRoutes = require('./modules/editor/editorRoutes');
const reviewRoutes = require('./modules/reviews/reviewRoutes');
const collaborationRoutes = require('./modules/collaborations/collaborationRoutes');
const paymentRoutes = require('./modules/payments/paymentRoutes');
const notificationRoutes = require('./modules/notifications/notificationRoutes');
const auditRoutes = require('./modules/audit/auditRoutes');

const app = express();

// Enable CORS (supports default CLIENT_ORIGIN and any local dev server port)
app.use(cors({
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (
      origin === env.CLIENT_ORIGIN ||
      /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
    ) {
      return callback(null, true);
    }
    callback(null, true);
  },
  credentials: true
}));

// HTTP Request logging
if (env.NODE_ENV !== 'test') {
  app.use(morgan('dev'));
}

// JSON & URL-encoded parser with rawBody capture for GitHub Webhooks (FR-19)
app.use(express.json({
  verify: (req, res, buf) => {
    req.rawBody = buf.toString();
  }
}));
app.use(express.urlencoded({ extended: true }));

// Health Check API
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    platform: 'DevCollab',
    timestamp: new Date().toISOString()
  });
});

// Mount modules
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/connections', connectionRoutes);
app.use('/api/projects', projectRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/github', githubRoutes);
app.use('/api/editor', editorRoutes);
app.use('/api/reviews', reviewRoutes);
app.use('/api/collaborations', collaborationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/audit', auditRoutes);

// 404 & Centralized Error Handlers
app.use(notFoundHandler);
app.use(errorHandler);

module.exports = app;
