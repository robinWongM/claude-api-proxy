import { Hono } from 'hono';
import type { ProxyConfig } from '../config.ts';
import { handleMessagesProxy } from '../handlers/messages/index.ts';

export function handleMessagesRoute() {
  const r = new Hono<{ Variables: { config: ProxyConfig } }>();

  r.post('/', async (c) => {
    const config = c.get('config');
    const resp = await handleMessagesProxy(c.req.raw, config);
    return resp;
  });

  return r;
}


