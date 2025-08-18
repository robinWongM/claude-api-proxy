import type { ProxyConfig } from "../config.ts";
import { dumpProviderRequest, dumpProviderResponse } from "./debug.ts";

export function createDebugFetch(
	config: ProxyConfig,
	requestId: string,
): typeof fetch {
	// @ts-expect-error Bun types are not compatible with Node types
	return async (input: string | URL | Request, init?: RequestInit) => {
		// @ts-expect-error Bun types are not compatible with Node types
		const request = new Request(input, init);

		// Dump the request before sending
		await dumpProviderRequest(request, requestId, config);

		// Perform the actual fetch
		const response = await fetch(input, init);

		// Dump the response and return the potentially modified response
		return await dumpProviderResponse(response, requestId, config);
	};
}
