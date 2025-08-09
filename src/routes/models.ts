import { Hono } from 'hono';
import type { ProxyConfig } from '../config.ts';
import { handleModelsProxy } from '../handlers/models.ts';

export function handleModelsRoute() {
  const r = new Hono<{ Variables: { config: ProxyConfig } }>();

  r.get('/', async (c) => {
    const config = c.get('config');
    return handleModelsProxy(c.req.raw, config);
  });

  return r;
}


