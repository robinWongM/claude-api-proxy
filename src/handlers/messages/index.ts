import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { ProxyConfig } from "../../config.ts";
import {
	anthropicRequestToCallOptions,
	transformToAnthropicResponse,
} from "../../converters/anthropic/index.ts";
import type { AnthropicMessagesRequest } from "../../schemas/anthropic";
import {
	dumpAiSdkCallOptions,
	dumpAiSdkStreamPart,
} from "../../utils/debug.ts";
import { createDebugFetch } from "../../utils/debug-fetch.ts";
import { handleStream } from "./stream.ts";

export async function handleMessagesProxy(
	request: AnthropicMessagesRequest,
	config: ProxyConfig,
	requestId?: string,
): Promise<Response> {
	if (!requestId) {
		throw new Error("Request ID is required");
	}
	const callOptions = anthropicRequestToCallOptions(request);

	// GLM
	callOptions.temperature = 0.6;
	callOptions.topP = 1;

	await dumpAiSdkCallOptions(callOptions, requestId, config);

	const provider = createOpenAICompatible({
		name: 'openai',
		apiKey: config.targetApiKey,
		baseURL: config.targetBaseUrl,
		fetch: config.enableDebug ? createDebugFetch(config, requestId) : undefined,
	});
	const model = provider.chatModel(config.targetModel);

	if (request.stream) {
		const { stream } = await model.doStream(callOptions);

		// Clone and dump the stream
		const debugStream = await dumpAiSdkStreamPart(stream, requestId, config);
		return handleStream(debugStream, requestId, config);
	}

	const response = await model.doGenerate(callOptions);

	const anthropicResponse = transformToAnthropicResponse(
		response,
		config.targetModel,
	);

	return new Response(JSON.stringify(anthropicResponse), {
		headers: { "Content-Type": "application/json" },
	});
}
