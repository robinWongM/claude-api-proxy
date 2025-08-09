import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { loadConfig, type ProxyConfig } from './config.ts';
import { handleModelsRoute } from './routes/models.ts';
import { handleMessagesRoute } from './routes/messages.ts';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

export function createApp(config?: ProxyConfig) {
  const app = new Hono<{ Bindings: { }; Variables: { config: ProxyConfig; requestId?: string; anthropicRequest?: unknown } }>();

  const resolved = config ?? loadConfig();
  app.use('*', async (c, next) => {
    c.set('config', resolved);
    await next();
  });

  // CORS
  app.use('*', cors());

  // Debug middleware: dump Anthropic requests and non-streaming responses
  app.use('/v1/messages/*', async (c, next) => {
    const config = c.get('config');
    if (!config.enableDebug) return next();

    const ensureDir = async () => {
      await mkdir(config.debugDir, { recursive: true }).catch(() => {});
    };

    const generateRequestId = () => {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const rand = Math.random().toString(36).slice(2, 10);
      return `${timestamp}-${rand}`;
    };

    const requestId = generateRequestId();
    c.set('requestId', requestId);

    // Read and store the Anthropic request body once via clone to avoid consuming original
    try {
      const cloned = c.req.raw.clone();
      const bodyText = await cloned.text();
      await ensureDir();
      await writeFile(join(config.debugDir, `anthropic-request-${requestId}.json`), bodyText);
      try {
        const parsed = JSON.parse(bodyText);
        c.set('anthropicRequest', parsed);
      } catch {
        // Leave unset if not JSON
      }
    } catch {
      // Ignore read errors
    }

    await next();

    // For non-streaming JSON responses, dump the Anthropic response
    try {
      const contentType = c.res.headers.get('Content-Type') || '';
      const isStream = contentType.includes('text/event-stream');
      if (!isStream && contentType.includes('application/json')) {
        const cloned = c.res.clone();
        const text = await cloned.text();
        await ensureDir();
        await writeFile(join(config.debugDir, `anthropic-response-${requestId}.json`), text);
      }
    } catch {
      // Ignore dump errors
    }

    // For streaming SSE responses, tee and dump entire Anthropic SSE into a single file
    try {
      const contentType = c.res.headers.get('Content-Type') || '';
      const isStream = contentType.includes('text/event-stream');
      const body = c.res.body;
      if (isStream && body && requestId) {
        const [forClient, forDump] = body.tee();
        const newHeaders = new Headers(c.res.headers);
        c.res = new Response(forClient, { status: c.res.status, statusText: c.res.statusText, headers: newHeaders });

        const decoder = new TextDecoder();
        let collected = '';
        (async () => {
          try {
            const reader = forDump.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) collected += decoder.decode(value);
            }
          } finally {
            await ensureDir();
            await writeFile(join(config.debugDir, `anthropic-stream-${requestId}.sse.txt`), collected).catch(() => {});
          }
        })();
      }
    } catch {
      // Ignore SSE dump errors
    }
  });

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


