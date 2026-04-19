import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { createApp } from './app.js';
import { initSocket } from './services/socketService.js';
import { initCronJobs } from './services/cronService.js';

const app = createApp();
const httpServer = createServer(app);

// Export io instance for use by other services (e.g., insight broadcasting)
export let io: Server;

io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ['websocket'], // FORCE pure websockets for Cloud Run stability
  // Tuning for faster disconnect detection and mobile resilience
  pingInterval: 5000, // Send ping every 5 seconds
  pingTimeout: 10000   // Wait 10 seconds for pong response
});

// Initialize Socket Logic
initSocket(io);

// Initialize Cron Jobs (Insight Generation)
initCronJobs();

// Cloud Run uses 8080 by default, or the PORT env var
const PORT = process.env.PORT || 8080;

httpServer.listen(PORT, () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
  console.log(`🔌 Socket.io listo para conexiones`);
  console.log(`⏰ Cron jobs inicializados`);
});
