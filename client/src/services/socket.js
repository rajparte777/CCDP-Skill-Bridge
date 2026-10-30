import { io } from 'socket.io-client';
import { getToken } from './api';

let socketInstance = null;

export function getSocket() {
  const token = getToken();
  if (!token) {
    if (socketInstance) {
      socketInstance.disconnect();
      socketInstance = null;
    }
    return null;
  }

  if (!socketInstance) {
    socketInstance = io('http://localhost:5000', {
      auth: { token },
      transports: ['websocket', 'polling'],
      autoConnect: true
    });

    socketInstance.on('connect', () => {
      console.log('[Socket.IO] Connected to real-time server with socket id:', socketInstance.id);
    });

    socketInstance.on('connect_error', (err) => {
      console.warn('[Socket.IO] Connection notice:', err.message);
    });
  }

  return socketInstance;
}

export function resetSocket() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
  return getSocket();
}
