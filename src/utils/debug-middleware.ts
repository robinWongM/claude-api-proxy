import type { Context, Next } from "hono";
import { dumpRequest, dumpResponse } from "./debug.ts";

export async function debugRequestMiddleware(c: Context, next: Next) {
	const config = c.get("config");
	const requestId = c.get("requestId");

	if (config.enableDebug) {
		// Clone the request body for debugging
		const requestBody = await c.req.json().catch(() => null);
		if (requestBody) {
			await dumpRequest(requestBody, requestId, config);
		}
	}

	await next();
}

export async function debugStreamResponseMiddleware(c: Context, next: Next) {
	const config = c.get("config");
	const requestId = c.get("requestId");

	await next();

	if (config.enableDebug) {
		const response = c.res;
		if (response?.body) {
			const pipedResponse = await dumpResponse(response, requestId, config);
			c.res = pipedResponse;
		}
	}
}
