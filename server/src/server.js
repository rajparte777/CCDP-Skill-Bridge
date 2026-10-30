const http = require('http');
const { Server } = require('socket.io');
const app = require('./app');
const env = require('./config/env');
const { initDb } = require('./config/db');
const { setupSocketIO } = require('./realtime/socket');
const { setSocketIO } = require('./modules/notifications/notificationService');

async function startServer() {
  try {
    // Initialize Database
    console.log('[DevCollab Server] Initializing database...');
    await initDb();

    // Create HTTP & Socket.IO server
    const server = http.createServer(app);
    const io = new Server(server, {
      cors: {
        origin: (origin, callback) => callback(null, true),
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
      }
    });

    // Wire up Socket.IO with notifications & real-time editor
    setSocketIO(io);
    setupSocketIO(io);

    server.listen(env.PORT, () => {
      console.log(`====================================================`);
      console.log(`🚀 DevCollab Server running on port ${env.PORT}`);
      console.log(`📡 Socket.IO Real-Time Engine Active`);
      console.log(`🔗 REST API Root: http://localhost:${env.PORT}/api`);
      console.log(`====================================================`);
    });
  } catch (err) {
    console.error('[DevCollab Server] Fatal startup error:', err);
    process.exit(1);
  }
}

startServer();
