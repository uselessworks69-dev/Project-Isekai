import express from 'express'; import cors from 'cors'; import helmet from 'helmet'; import dotenv from 'dotenv'; import { createServer } from 'http'; import { Server } from 'socket.io'; import { initDatabase } from './config/database.js'; import authRoutes from './routes/auth.js'; import progressRoutes from './routes/progress.js'; import dungeonRoutes from './routes/dungeon.js'; import shopRoutes from './routes/shop.js'; import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express(); const httpServer = createServer(app);

// Use an explicit FRONTEND origin (falls back to your Vercel url)
const FRONTEND = process.env.FRONTEND_URL || process.env.FRONTEND || 'https://project-isekai.vercel.app';

const io = new Server(httpServer, { cors: { origin: FRONTEND, credentials: true } });

// Basic security + parsing middleware
app.use(helmet()); app.use(cors({ origin: FRONTEND, credentials: true })); app.use(express.json()); app.use(express.urlencoded({ extended: true }));

// Database connection
initDatabase().catch(err => console.error('[DB ERROR]', err));

// WebSocket connections (optional: may be limited on some hosts)
io.on('connection', (socket) => { console.log('Client connected:', socket.id);

socket.on('join-room', (room) => { socket.join(room); console.log(Socket ${socket.id} joined room ${room}); });

socket.on('progress-update', (data) => { if (data && data.userId) { socket.to(user-${data.userId}).emit('progress-updated', data); } });

socket.on('disconnect', () => { console.log('Client disconnected:', socket.id); }); });

// --------- Public root route (important!) ---------
app.get('/', (req, res) => { res.json({ status: 'Project Isekai backend online ⚔️', version: process.env.npm_package_version || '0.3.0', timestamp: new Date().toISOString() }); });

// Health endpoint (useful for load balancers / uptime checks)
app.get('/health', (req, res) => { res.json({ status: 'healthy', version: process.env.npm_package_version || '0.3.0', timestamp: new Date().toISOString() }); });

// Mount API routes (protected routes use auth middleware)
app.use('/api/auth', authRoutes); app.use('/api/progress', authMiddleware, progressRoutes); app.use('/api/dungeon', authMiddleware, dungeonRoutes); app.use('/api/shop', authMiddleware, shopRoutes);

// 404 handler (must come after all routes) 
app.use('*', (req, res) => { res.status(404).json({ error: { message: 'Route not found', code: 'ROUTE_NOT_FOUND' } }); });

// Error handler (last middleware)
app.use((err, req, res, next) => { console.error('[Server Error]:', err);

res.status(err.status || 500).json({ error: { message: err.message || 'Internal server error', code: err.code || 'SERVER_ERROR', timestamp: new Date().toISOString() } }); });

const PORT = process.env.PORT || 3000; httpServer.listen(PORT, () => { console.log(\n🚀 Project Isekai Backend Server\n📡 Port: ${PORT}\n🌐 Environment: ${process.env.NODE_ENV || 'development'}\n🕐 ${new Date().toLocaleString()}\n); });

// Optional: catch unhandled rejections to keep Render logs useful
process.on('unhandledRejection', (reason) => { console.error('[UNHANDLED REJECTION]', reason); }); process.on('uncaughtException', (err) => { console.error('[UNCAUGHT EXCEPTION]', err); });
