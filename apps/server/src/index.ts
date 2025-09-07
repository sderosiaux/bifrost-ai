import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import fastifyStatic from '@fastify/static';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';
import { modelRoutes } from './routes/model.js';
import { chatRoutes } from './routes/chat.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

const server = Fastify({
  logger: process.env.ALLOW_DEV_LOGS === 'true' ? {
    level: 'warn', // Only show warnings and errors, not info (HTTP requests)
    transport: {
      target: 'pino-pretty',
      options: {
        translateTime: 'HH:MM:ss',
        ignore: 'pid,hostname,reqId',
        colorize: true,
        singleLine: true,
      },
    },
  } : false,
});

// CORS setup
await server.register(cors, {
  origin: process.env.WEB_ORIGIN || 'http://localhost:5173',
  credentials: true,
});

// Rate limiting
await server.register(rateLimit, {
  max: 100, // max 100 requests
  timeWindow: '1 minute',
  cache: 10000,
  ban: 3, // ban after 3 429 responses
  skipOnError: true,
});

// Register routes
await server.register(modelRoutes);
await server.register(chatRoutes);

// Health check
server.get('/health', async () => {
  return { status: 'ok' };
});

// Serve static files in production
if (process.env.NODE_ENV === 'production') {
  const webDistPath = join(__dirname, '../../web/dist');
  console.log('[Server] Checking for frontend dist at:', webDistPath);
  if (existsSync(webDistPath)) {
    console.log('[Server] Serving frontend from:', webDistPath);
    await server.register(fastifyStatic, {
      root: webDistPath,
      prefix: '/',
    });
    
    // Catch-all for SPA routing
    server.setNotFoundHandler((request, reply) => {
      if (!request.url.startsWith('/api')) {
        reply.sendFile('index.html');
      } else {
        reply.code(404).send({ error: 'Not found' });
      }
    });
  }
}

const port = parseInt(process.env.PORT || '5174');
const host = '0.0.0.0';

console.log('[Server] Starting server...');
console.log('[Server] Environment variables:');
console.log('  MODEL_URL:', process.env.MODEL_URL ? 'Configured' : 'NOT CONFIGURED');
console.log('  MODEL_SHA256:', process.env.MODEL_SHA256 ? 'Configured' : 'Not configured');
console.log('  PORT:', port);
console.log('  WEB_ORIGIN:', process.env.WEB_ORIGIN || 'http://localhost:5173');
console.log('  ALLOW_DEV_LOGS:', process.env.ALLOW_DEV_LOGS);

try {
  await server.listen({ port, host });
  console.log(`[Server] ✅ Server listening on http://localhost:${port}`);
  console.log(`[Server] Frontend expected at: ${process.env.WEB_ORIGIN || 'http://localhost:5173'}`);
} catch (err) {
  console.error('[Server] ❌ Failed to start server:', err);
  server.log.error(err);
  process.exit(1);
}