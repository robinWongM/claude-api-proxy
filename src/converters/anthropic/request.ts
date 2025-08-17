import type {
	LanguageModelV2CallOptions,
	LanguageModelV2FunctionTool,
	LanguageModelV2Message,
	LanguageModelV2ProviderDefinedTool,
	LanguageModelV2ReasoningPart,
	LanguageModelV2TextPart,
	LanguageModelV2ToolCallPart,
	LanguageModelV2ToolResultOutput,
	LanguageModelV2ToolResultPart,
} from "@ai-sdk/provider";
import type {
	AnthropicMessagesRequest,
	AnthropicTool,
} from "../../schemas/anthropic";
import type { AnthropicMessage } from "../../schemas/anthropic/request";
import type {
	RequestTextBlock,
	RequestThinkingBlock,
	RequestToolResultBlock,
	RequestToolUseBlock,
} from "../../schemas/anthropic/request-content";

export function anthropicRequestToCallOptions(
	request: AnthropicMessagesRequest,
): LanguageModelV2CallOptions {
	const system = convertSystemMessages(request.system);
	const messages = convertMessages(request.messages);
	const tools = convertTools(request.tools);

	return {
		prompt: [...(system ? [system] : []), ...messages],
		tools,
		maxOutputTokens: Math.min(request.max_tokens, 8192),
		stopSequences: request.stop_sequences,
		temperature: request.temperature,
		topK: request.top_k,
		topP: request.top_p,
		// TODO: Handle other options
	};
}

function convertSystemMessages(
	system: AnthropicMessagesRequest["system"],
): LanguageModelV2Message | undefined {
	if (!system) {
		return;
	}

	// TODO: Can we have multiple system messages?
	// TODO: Handle cache_control
	const content = Array.isArray(system)
		? system.map((block) => block.text).join("\n")
		: system;
	return {
		role: "system",
		content,
	};
}

function convertMessages(
	messages: AnthropicMessage[],
): LanguageModelV2Message[] {
	const modelMessages: LanguageModelV2Message[] = [];

	const toolNameMap = new Map<string, string>();

	for (const message of messages) {
		if (typeof message.content === "string") {
			modelMessages.push({
				role: message.role,
				content: [convertTextPart(message.content)],
			});

			continue;
		}

		for (const part of message.content) {
			if (part.type === "text") {
				modelMessages.push({
					role: message.role,
					content: [convertTextPart(part)],
				});

				continue;
			}

			// if (part.type === "image" && message.role === "user") {
			// 	modelMessages.push({
			// 		role: message.role,
			// 		content: [convertImagePart(part)],
			// 	});
			// }

			// if (part.type === "document") {
			// 	modelMessages.push({
			// 		role: message.role,
			// 		content: [convertDocumentPart(part)],
			// 	});
			// }

			if (part.type === "tool_use" && message.role === "assistant") {
				modelMessages.push({
					role: message.role,
					content: [convertToolUsePart(part)],
				});
				toolNameMap.set(part.id, part.name);

				continue;
			}

			if (part.type === "tool_result") {
				const role = message.role === "user" ? "tool" : message.role;
				modelMessages.push({
					role,
					content: [
						convertToolResultPart(part, toolNameMap.get(part.tool_use_id)),
					],
				});

				continue;
			}

			if (part.type === "thinking" && message.role === "assistant") {
				modelMessages.push({
					role: message.role,
					content: [convertThinkingPart(part)],
				});

				continue;
			}

			throw new Error(`Unsupported message part type: ${part.type}`);
		}
	}

	return modelMessages;
}

function convertTools(
	tools: AnthropicTool[] | undefined,
): Array<LanguageModelV2FunctionTool | LanguageModelV2ProviderDefinedTool> {
	if (!tools) {
		return [];
	}

	return tools.map((tool) => {
		switch (tool.type) {
			case "custom":
			case undefined:
				return {
					type: "function",
					name: tool.name,
					description: tool.description,
					inputSchema: tool.input_schema,
				};

			case "bash_20241022":
			case "bash_20250124":
			case "code_execution_20250522":
			case "computer_20241022":
			case "computer_20250124":
			case "text_editor_20241022":
			case "text_editor_20250124":
			case "text_editor_20250429":
			case "text_editor_20250728":
			case "web_search_20250305":
				return {
					type: "provider-defined",
					id: `anthropic.${tool.name}`,
					name: tool.name,
					// TODO: Handle args
					args: {},
				};

			default:
				// @ts-expect-error future tools is not included in our TypeScript types
				throw new Error(`Unsupported tool type: ${tool.type}`);
		}
	});
}

function convertTextPart(
	part: string | RequestTextBlock,
): LanguageModelV2TextPart {
	// TODO: Handle citations
	return {
		type: "text",
		text: typeof part === "string" ? part : part.text,
	};
}

// function convertImagePart(part: RequestImageBlock): ImagePart {
// 	if (part.source.type === "file") {
// 		throw new Error("File images are not supported");
// 	}

// 	if (part.source.type === "url") {
// 		return {
// 			type: "image",
// 			image: part.source.url,
// 		};
// 	}

// 	return {
// 		type: "image",
// 		image: part.source.data,
// 		mediaType: part.source.media_type,
// 	};
// }

// function convertDocumentPart(part: RequestDocumentBlock): FilePart {
// 	switch (part.source.type) {
// 		case "base64":
// 			return {
// 				type: "file",
// 				data: part.source.data,
// 				mediaType: part.source.media_type,
// 			};

// 		case "url":
// 			return {
// 				type: "file",
// 				data: part.source.url,
// 				mediaType: "application/pdf",
// 			};

// 		default:
// 			throw new Error(`Unsupported document source type: ${part.source.type}`);
// 	}
// }

function convertToolUsePart(
	part: RequestToolUseBlock,
): LanguageModelV2ToolCallPart {
	return {
		type: "tool-call",
		toolCallId: part.id,
		toolName: part.name,
		input: part.input,
		// TODO: Handle providerExecuted?
	};
}

function convertToolResultPart(
	part: RequestToolResultBlock,
	toolName: string | undefined,
): LanguageModelV2ToolResultPart {
	if (!toolName) {
		throw new Error(
			`Tool name is required for tool result part: ${part.tool_use_id}`,
		);
	}

	let output: LanguageModelV2ToolResultOutput;

	if (part.is_error) {
		if (typeof part.content !== "string") {
			throw new Error(`Tool result content is not a string: ${part.content}`);
		}

		output = {
			type: "error-text",
			value: part.content,
		};
	} else if (typeof part.content === "string") {
		output = {
			type: "text",
			value: part.content,
		};
	} else {
		output = {
			type: "content",
			value: part.content.map((block) => {
				if (block.type === "text") {
					return {
						type: "text",
						text: block.text,
					};
				}

				if (block.type === "image" && block.source.type === "base64") {
					return {
						type: "media",
						data: block.source.data,
						mediaType: block.source.media_type,
					};
				}

				throw new Error(`Unsupported tool result content type: ${block.type}`);
			}),
		};
	}

	return {
		type: "tool-result",
		toolCallId: part.tool_use_id,
		toolName,
		output,
	};
}

function convertThinkingPart(
	part: RequestThinkingBlock,
): LanguageModelV2ReasoningPart {
	return {
		type: "reasoning",
		text: part.thinking,
		providerOptions: {
			anthropic: {
				signature: part.signature,
			},
		},
	};
}
