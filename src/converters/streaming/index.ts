import type { AnthropicStreamEvent } from "../../schemas/index.ts";
import type { OpenAIStreamChunk } from "../../types.ts";
import { ChunkComparator } from "./chunk-comparator.ts";
import { formatSSEWithEvent } from "./events.ts";

export { ChunkComparator } from "./chunk-comparator.ts";
// Re-export utilities
export { formatSSE, formatSSEWithEvent, parseSSEData } from "./events.ts";

/**
 * Creates a streaming response transformer from OpenAI to Anthropic format
 */
export function createOpenAIToAnthropicStreamTransformer() {
	let started = false;
	let sentStop = false;
	let chunkCount = 0;
	let buffer = ""; // Buffer to accumulate partial lines
	const comparator = new ChunkComparator();
	let usage = { input_tokens: 0, output_tokens: 0 }; // Track usage information

	function buildFinalizationEvents(
		controller?: TransformStreamDefaultController<Uint8Array>,
	): AnthropicStreamEvent[] {
		const finalEvents: AnthropicStreamEvent[] = [];

		// Use comparator to finalize any open blocks
		if (controller) {
			comparator.finalize(controller);
		}

		// message_delta with stop_reason
		const stop_reason = comparator.hasSawToolCalls() ? "tool_use" : "end_turn";
		finalEvents.push({
			type: "message_delta",
			delta: { stop_reason, stop_sequence: null },
			usage: usage,
		});
		// message_stop
		finalEvents.push({ type: "message_stop" });
		return finalEvents;
	}

	return new TransformStream({
		transform(chunk: Uint8Array, controller) {
			const text = new TextDecoder().decode(chunk);
			// Add new chunk to buffer
			buffer += text;

			// Split by lines but keep the last potentially incomplete line
			const lines = buffer.split("\n");
			// Keep the last line in buffer (might be incomplete)
			buffer = lines.pop() || "";

			// Process complete lines
			for (const line of lines) {
				if (line.startsWith("data: ")) {
					const data = line.slice(6).trim();

					if (data === "[DONE]") {
						// Send final stop events if not already sent
						if (started && !sentStop) {
							for (const ev of buildFinalizationEvents(controller)) {
								controller.enqueue(
									new TextEncoder().encode(formatSSEWithEvent(ev.type, ev)),
								);
							}
							sentStop = true;
						}
						continue;
					}

					if (data) {
						// Only process non-empty data
						try {
							const openaiChunk: OpenAIStreamChunk = JSON.parse(data);
							chunkCount++;

							// Extract usage information if available and convert to Anthropic format
							if (openaiChunk.usage) {
								usage = {
									input_tokens: openaiChunk.usage.prompt_tokens,
									output_tokens: openaiChunk.usage.completion_tokens,
								};
							}

							// Check if this chunk has finish_reason, indicating the end
							const isFinished =
								openaiChunk.choices[0]?.finish_reason &&
								openaiChunk.choices[0].finish_reason !== null;

							// Emit message_start if this is the first chunk
							if (!started) {
								const startEvent = {
									type: "message_start",
									message: {
										id: openaiChunk.id,
										type: "message",
										role: "assistant",
										content: [],
										model: openaiChunk.model,
										stop_sequence: null,
										usage: usage,
									},
								} as const;
								controller.enqueue(
									new TextEncoder().encode(
										formatSSEWithEvent("message_start", startEvent),
									),
								);
								started = true;
							}

							// Only process chunk through comparator if it has content/tool_calls or is not the final chunk
							const delta = openaiChunk.choices[0]?.delta;
							const hasContent = delta && (delta.content || delta.tool_calls);
							if (hasContent || !isFinished) {
								comparator.processChunk(openaiChunk, controller);
							}

							// If this chunk indicates the stream is finished, send finalization events
							if (isFinished && !sentStop) {
								for (const ev of buildFinalizationEvents(controller)) {
									controller.enqueue(
										new TextEncoder().encode(formatSSEWithEvent(ev.type, ev)),
									);
								}
								sentStop = true;
							}
						} catch (error) {
							console.error(
								"Error parsing OpenAI stream chunk:",
								error,
								"Data:",
								data,
							);
						}
					}
				}
			}
		},

		flush(controller) {
			// Process any remaining data in buffer
			if (buffer.trim()) {
				const line = buffer.trim();
				if (line.startsWith("data: ")) {
					const data = line.slice(6).trim();

					if (data === "[DONE]") {
						if (started && !sentStop) {
							for (const ev of buildFinalizationEvents(controller)) {
								controller.enqueue(
									new TextEncoder().encode(formatSSEWithEvent(ev.type, ev)),
								);
							}
							sentStop = true;
						}
					} else if (data) {
						try {
							const openaiChunk: OpenAIStreamChunk = JSON.parse(data);

							// Extract usage information if available and convert to Anthropic format
							if (openaiChunk.usage) {
								usage = {
									input_tokens: openaiChunk.usage.prompt_tokens,
									output_tokens: openaiChunk.usage.completion_tokens,
								};
							}

							// Check if this chunk has finish_reason, indicating the end
							const isFinished =
								openaiChunk.choices[0]?.finish_reason &&
								openaiChunk.choices[0].finish_reason !== null;

							// Emit message_start if this is the first chunk
							if (!started && chunkCount === 0) {
								const startEvent = {
									type: "message_start",
									message: {
										id: openaiChunk.id,
										type: "message",
										role: "assistant",
										content: [],
										model: openaiChunk.model,
										stop_sequence: null,
										usage: usage,
									},
								} as const;
								controller.enqueue(
									new TextEncoder().encode(
										formatSSEWithEvent("message_start", startEvent),
									),
								);
								started = true;
							}

							// Only process chunk through comparator if it has content/tool_calls or is not the final chunk
							const delta = openaiChunk.choices[0]?.delta;
							const hasContent = delta && (delta.content || delta.tool_calls);
							if (hasContent || !isFinished) {
								comparator.processChunk(openaiChunk, controller);
							}

							// If this chunk indicates the stream is finished, send finalization events
							if (isFinished && !sentStop) {
								for (const ev of buildFinalizationEvents(controller)) {
									controller.enqueue(
										new TextEncoder().encode(formatSSEWithEvent(ev.type, ev)),
									);
								}
								sentStop = true;
							}
						} catch (error) {
							console.error("Error parsing final OpenAI stream chunk:", error);
						}
					}
				}
			}
		},
	});
}
