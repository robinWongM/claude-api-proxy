import type { LanguageModelV2 } from "@ai-sdk/provider";
import type { AnthropicMessagesResponse } from "../../schemas/anthropic";

export function transformToAnthropicResponse(
	aiSdkResponse: Awaited<ReturnType<LanguageModelV2['doGenerate']>>,
	model: string,
): AnthropicMessagesResponse {
	const content = aiSdkResponse.content.map((block) => {
		if (block.type === "tool-call") {
			return {
				type: "tool_use" as const,
				id: block.toolCallId,
				name: block.toolName,
				input:
					typeof block.input === "string"
						? JSON.parse(block.input)
						: block.input,
			};
		} else {
			return {
				type: "text" as const,
				text: block.text || "",
			};
		}
	});

	const stopReasonMap: Record<
		string,
		AnthropicMessagesResponse["stop_reason"]
	> = {
		stop: "end_turn",
		length: "max_tokens",
		"tool-calls": "tool_use",
		"content-filter": "refusal",
	};

	return {
		id: crypto.randomUUID(),
		type: "message",
		role: "assistant",
		content,
		model,
		stop_reason: stopReasonMap[aiSdkResponse.finishReason] || "end_turn",
		stop_sequence: null,
		usage: {
			input_tokens: aiSdkResponse.usage.inputTokens,
			output_tokens: aiSdkResponse.usage.outputTokens,
			cache_creation_input_tokens: null,
			cache_read_input_tokens: null,
			cache_creation: null,
			server_tool_use: null,
			service_tier: null,
		},
		container: null,
	};
}
