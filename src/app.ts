import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig, type ProxyConfig } from './config.ts';
import { handleModelsRoute } from './routes/models.ts';
import { handleMessagesRoute } from './routes/messages.ts';

export function createApp(config?: ProxyConfig) {
  const app = new Hono<{ Bindings: { }; Variables: { config: ProxyConfig } }>();

  const resolved = config ?? loadConfig();
  app.use('*', async (c, next) => {
    c.set('config', resolved);
    await next();
  });

  // CORS
  app.use('*', cors());

  // Health
  app.get('/health', (c) => c.json({
    status: 'ok',
    service: 'claude-api-proxy',
    version: '1.0.0',
    target: c.get('config').targetBaseUrl,
    timestamp: new Date().toISOString(),
  }));

  // Routes
  app.route('/v1/models', handleModelsRoute());
  app.route('/v1/messages', handleMessagesRoute());

  // Root
  app.get('/', (c) => c.redirect('/health'));

  return app;
}


