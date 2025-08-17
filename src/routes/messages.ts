import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import type { ProxyConfig } from "../config.ts";
import { handleMessagesProxy } from "../handlers/messages/index.ts";
import { AnthropicMessagesRequestSchema } from "../schemas/anthropic";

export function handleMessagesRoute() {
	const r = new Hono<{ Variables: { config: ProxyConfig } }>();

	r.post("/", zValidator("json", AnthropicMessagesRequestSchema), async (c) => {
		const config = c.get("config");
		const reqId = c.get("requestId");

		const validated = c.req.valid("json");
		return await handleMessagesProxy(validated, config, reqId);
	});

	return r;
}
