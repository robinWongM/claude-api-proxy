import { Hono } from 'hono';
import type { ProxyConfig } from '../config.ts';
import { handleMessagesProxy } from '../handlers/messages/index.ts';
import { streamSSE } from 'hono/streaming';

export function handleMessagesRoute() {
  const r = new Hono<{ Variables: { config: ProxyConfig } }>();

  r.post('/', async (c) => {
    const config = c.get('config');
    // Delegate to handler; if it returns SSE, just return as-is.
    const resp = await handleMessagesProxy(c.req.raw, config);
    const isSSE = (resp.headers.get('Content-Type') || '').includes('text/event-stream');
    if (!isSSE) return resp;

    // Wrap the existing SSE stream with Hono's streaming helper for proper headers and lifecycle
    return streamSSE(c, async (stream) => {
      const body = resp.body;
      if (!body) return;
      const reader = body.getReader();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          await stream.write(value);
        }
      }
    });
  });

  return r;
}


