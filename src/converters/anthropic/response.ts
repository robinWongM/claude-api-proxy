import type { LanguageModelV2, LanguageModelV2Content } from "@ai-sdk/provider";
import type { AnthropicMessagesResponse } from "../../schemas/anthropic";

const stopReasonMap: Record<string, AnthropicMessagesResponse["stop_reason"]> =
	{
		stop: "end_turn",
		length: "max_tokens",
		"tool-calls": "tool_use",
		"content-filter": "refusal",
	};

function mapContentBlock(block: LanguageModelV2Content) {
	if (block.type === "tool-call") {
		return {
			type: "tool_use" as const,
			id: block.toolCallId,
			name: block.toolName,
			input:
				typeof block.input === "string" ? JSON.parse(block.input) : block.input,
		};
	}

	if (block.type === "text") {
		return {
			type: "text" as const,
			text: block.text || "",
			citations: null,
		};
	}

	if (block.type === "reasoning") {
		const signature = block.providerMetadata?.anthropic?.signature;
		return {
			type: "thinking" as const,
			signature: typeof signature === "string" ? signature : "",
			thinking: block.text || "",
		};
	}

	if (block.type === "tool-result") {
		// Tool results shouldn't appear in assistant responses
		throw new Error("Tool results should not appear in assistant responses");
	}

	if (block.type === "file") {
		// Files/images are not supported in Anthropic assistant responses
		throw new Error("Files and images are not supported in Anthropic assistant responses");
	}

	throw new Error(`Unsupported content type: ${block.type}`);
}

export function transformToAnthropicResponse(
	aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>>,
	model: string,
): AnthropicMessagesResponse {
	const content = aiSdkResponse.content.map(mapContentBlock);

	return {
		id: aiSdkResponse.response?.id ?? crypto.randomUUID(),
		type: "message",
		role: "assistant",
		content,
		model,
		stop_reason: stopReasonMap[aiSdkResponse.finishReason] || "end_turn",
		stop_sequence: null,
		usage: {
			input_tokens: aiSdkResponse.usage.inputTokens || 0,
			output_tokens: aiSdkResponse.usage.outputTokens || 0,
			cache_creation_input_tokens: null,
			cache_read_input_tokens: null,
			cache_creation: null,
			server_tool_use: null,
			service_tier: null,
		},
		container: null,
	};
}
