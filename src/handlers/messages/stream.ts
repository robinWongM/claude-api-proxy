import type { LanguageModelV2StreamPart } from "@ai-sdk/provider";
import type { ProxyConfig } from "../../config.ts";

// Anthropic streaming event types based on their documentation
interface AnthropicMessageStartEvent {
	type: "message_start";
	message: {
		id: string;
		type: "message";
		role: "assistant";
		content: Array<never>;
		model: string;
		stop_reason: null;
		stop_sequence: null;
		usage: {
			input_tokens: number;
			output_tokens: number;
			cache_read_input_tokens?: number | null;
		};
	};
}

interface AnthropicContentBlockStartEvent {
	type: "content_block_start";
	index: number;
	content_block:
		| {
				type: "text";
				text: string;
		  }
		| {
				type: "tool_use";
				id: string;
				name: string;
				input: Record<string, unknown>;
		  };
}

interface AnthropicContentBlockDeltaEvent {
	type: "content_block_delta";
	index: number;
	delta:
		| {
				type: "text_delta";
				text: string;
		  }
		| {
				type: "input_json_delta";
				partial_json: string;
		  };
}

interface AnthropicContentBlockStopEvent {
	type: "content_block_stop";
	index: number;
}

interface AnthropicMessageDeltaEvent {
	type: "message_delta";
	delta: {
		stop_reason: string | null;
		stop_sequence: string | null;
	};
	usage: {
		input_tokens: number;
		output_tokens: number;
		cache_read_input_tokens?: number | null;
	};
}

interface AnthropicMessageStopEvent {
	type: "message_stop";
}

interface AnthropicErrorEvent {
	type: "error";
	error: {
		type: string;
		message: string;
	};
}

type AnthropicEvent =
	| AnthropicMessageStartEvent
	| AnthropicContentBlockStartEvent
	| AnthropicContentBlockDeltaEvent
	| AnthropicContentBlockStopEvent
	| AnthropicMessageDeltaEvent
	| AnthropicMessageStopEvent
	| AnthropicErrorEvent;

export function handleStream(
	stream: ReadableStream<LanguageModelV2StreamPart>,
	_requestId?: string,
	_config?: ProxyConfig,
): Response {
	const encoder = new TextEncoder();
	const readable = new ReadableStream({
		async start(controller) {
			const enqueueEvent = <T extends AnthropicEvent>(event: T) => {
				controller.enqueue(
					encoder.encode(
						`event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`,
					),
				);
			};
			try {
				const reader = stream.getReader();
				const messageId = `msg_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;
				let contentBlockIndex = 0;
				let inputTokens = 0;
				let outputTokens = 0;
				let cacheReadInputTokens = 0;

				// Send message_start event when stream-start is received
				let messageStartSent = false;

				// Track active content block type
				let activeBlockType: "text" | "tool" | "reasoning" | null = null;

				// Process stream chunks
				while (true) {
					const { done, value } = await reader.read();
					if (done) break;

					switch (value.type) {
						case "stream-start": {
							if (!messageStartSent) {
								const startEvent: AnthropicMessageStartEvent = {
									type: "message_start",
									message: {
										id: messageId,
										type: "message",
										role: "assistant",
										content: [],
										model: "claude-3-5-sonnet-20241022",
										stop_reason: null,
										stop_sequence: null,
										usage: {
											input_tokens: inputTokens,
											output_tokens: outputTokens,
											cache_read_input_tokens: cacheReadInputTokens,
										},
									},
								};
								enqueueEvent(startEvent);
								messageStartSent = true;
							}
							break;
						}

						case "text-start": {
							// Start a new text content block
							activeBlockType = "text";
							const contentStartEvent: AnthropicContentBlockStartEvent = {
								type: "content_block_start",
								index: contentBlockIndex,
								content_block: {
									type: "text",
									text: "",
								},
							};
							enqueueEvent(contentStartEvent);
							break;
						}

						case "text-delta": {
							// If there's no active text block, create one first
							if (activeBlockType !== "text") {
								contentBlockIndex++;
								const textStartEvent: AnthropicContentBlockStartEvent = {
									type: "content_block_start",
									index: contentBlockIndex,
									content_block: {
										type: "text",
										text: "",
									},
								};
								enqueueEvent(textStartEvent);
								activeBlockType = "text";
							}

							const textDeltaEvent: AnthropicContentBlockDeltaEvent = {
								type: "content_block_delta",
								index: contentBlockIndex,
								delta: {
									type: "text_delta",
									text: value.delta || "",
								},
							};
							enqueueEvent(textDeltaEvent);
							break;
						}

						case "text-end": {
							if (activeBlockType === "text") {
								const contentStopEvent: AnthropicContentBlockStopEvent = {
									type: "content_block_stop",
									index: contentBlockIndex,
								};
								enqueueEvent(contentStopEvent);
								contentBlockIndex++;
								activeBlockType = null;
							}
							break;
						}

						case "reasoning-start": {
							// Start a reasoning content block (map to text)
							activeBlockType = "reasoning";
							const contentStartEvent: AnthropicContentBlockStartEvent = {
								type: "content_block_start",
								index: contentBlockIndex,
								content_block: {
									type: "text",
									text: "",
								},
							};
							enqueueEvent(contentStartEvent);
							break;
						}

						case "reasoning-delta": {
							const textDeltaEvent: AnthropicContentBlockDeltaEvent = {
								type: "content_block_delta",
								index: contentBlockIndex,
								delta: {
									type: "text_delta",
									text: value.delta || "",
								},
							};
							enqueueEvent(textDeltaEvent);
							break;
						}

						case "reasoning-end": {
							if (activeBlockType === "reasoning") {
								const contentStopEvent: AnthropicContentBlockStopEvent = {
									type: "content_block_stop",
									index: contentBlockIndex,
								};
								enqueueEvent(contentStopEvent);
								contentBlockIndex++;
								activeBlockType = null;
							}
							break;
						}

						case "tool-input-start": {
							// If there's an active text block, close it first
							if (activeBlockType === "text") {
								const textStopEvent: AnthropicContentBlockStopEvent = {
									type: "content_block_stop",
									index: contentBlockIndex,
								};
								enqueueEvent(textStopEvent);
								contentBlockIndex++;
							}

							// Start tool content block
							activeBlockType = "tool";
							const toolCallEvent: AnthropicContentBlockStartEvent = {
								type: "content_block_start",
								index: contentBlockIndex,
								content_block: {
									type: "tool_use",
									id: value.id,
									name: value.toolName,
									input: {},
								},
							};
							enqueueEvent(toolCallEvent);
							break;
						}

						case "tool-input-end": {
							if (activeBlockType === "tool") {
								const toolStopEvent: AnthropicContentBlockStopEvent = {
									type: "content_block_stop",
									index: contentBlockIndex,
								};
								enqueueEvent(toolStopEvent);
								contentBlockIndex++;
								activeBlockType = null;
							}
							break;
						}

						case "tool-call": {
							// This event is redundant with tool-input-start/tool-input-end sequence
							// Skip it to avoid duplicate content blocks
							break;
						}

						case "tool-input-delta": {
							const toolDeltaEvent: AnthropicContentBlockDeltaEvent = {
								type: "content_block_delta",
								index: contentBlockIndex,
								delta: {
									type: "input_json_delta",
									partial_json: value.delta || "",
								},
							};
							enqueueEvent(toolDeltaEvent);
							break;
						}

						case "finish": {
							// Update usage if available
							if (value.usage) {
								inputTokens = value.usage.inputTokens || 0;
								outputTokens = value.usage.outputTokens || 0;
								cacheReadInputTokens = value.usage.cachedInputTokens || 0;

								// Send message_delta with final usage
								const usageEvent: AnthropicMessageDeltaEvent = {
									type: "message_delta",
									delta: {
										stop_reason:
											value.finishReason === "stop"
												? "end_turn"
												: value.finishReason,
										stop_sequence: null,
									},
									usage: {
										input_tokens: inputTokens,
										output_tokens: outputTokens,
										cache_read_input_tokens: cacheReadInputTokens,
									},
								};
								enqueueEvent(usageEvent);
							}
							break;
						}

						case "error": {
							// Handle error events
							const errorEvent: AnthropicErrorEvent = {
								type: "error",
								error: {
									type: "api_error",
									message: "Unknown error",
								},
							};
							enqueueEvent(errorEvent);
							break;
						}

						case "source":
						case "file":
						case "tool-result":
							// Skip these events as they're not directly translatable
							break;
					}
				}

				// Send message_stop event
				const stopEvent: AnthropicMessageStopEvent = {
					type: "message_stop",
				};
				enqueueEvent(stopEvent);

				controller.close();
			} catch (error) {
				controller.error(error);
			}
		},
	});

	return new Response(readable, {
		headers: {
			"Content-Type": "text/event-stream",
			"Cache-Control": "no-cache",
			Connection: "keep-alive",
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Headers": "*",
		},
	});
}
