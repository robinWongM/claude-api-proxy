import type { ProxyConfig } from "../config.ts";
import { dumpProviderRequest, dumpProviderResponse } from "./debug.ts";

export function createDebugFetch(
	config: ProxyConfig,
	requestId: string,
): typeof fetch {
	return async (input: RequestInfo | URL, init?: RequestInit) => {
		const request = new Request(input, init);

		// Dump the request before sending
		await dumpProviderRequest(request, requestId, config);

		// Perform the actual fetch
		const response = await fetch(request);

		// Dump the response and return the potentially modified response
		return await dumpProviderResponse(response, requestId, config);
	};
}
