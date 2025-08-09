import type { OpenAIStreamChunk } from "../../types.ts";
import { formatSSEWithEvent } from "./events.ts";

interface ChunkContent {
	hasContent: boolean;
	content?: string;
	hasToolCalls: boolean;
	activeToolIndex?: number;
	toolId?: string;
	toolName?: string;
	toolArgs?: string;
}

export class ChunkComparator {
	private previousChunk: ChunkContent | null = null;
	private toolCallState = new Map<
		number,
		{ id?: string; name?: string; args: string }
	>();
	private activeBlockType: "text" | "tool" | null = null;
	private activeToolIndex: number | null = null;

	processChunk(
		chunk: OpenAIStreamChunk,
		controller: TransformStreamDefaultController<Uint8Array>,
	): void {
		const currentChunk = this.extractChunkContent(chunk);

		if (this.previousChunk === null) {
			// First chunk
			this.handleFirstChunk(currentChunk, controller, chunk);
		} else {
			// Compare with previous chunk and emit transitions
			this.handleChunkTransition(
				this.previousChunk,
				currentChunk,
				controller,
				chunk,
			);
		}

		this.previousChunk = currentChunk;
	}

	finalize(controller: TransformStreamDefaultController<Uint8Array>): void {
		// Close whatever block is currently active
		if (this.activeBlockType === "text") {
			controller.enqueue(
				new TextEncoder().encode(
					formatSSEWithEvent("content_block_stop", {
						type: "content_block_stop",
						index: 0,
					}),
				),
			);
		} else if (
			this.activeBlockType === "tool" &&
			this.activeToolIndex !== null
		) {
			const blockIndex = this.activeToolIndex + 1;
			controller.enqueue(
				new TextEncoder().encode(
					formatSSEWithEvent("content_block_stop", {
						type: "content_block_stop",
						index: blockIndex,
					}),
				),
			);
		}

		// Reset state
		this.activeBlockType = null;
		this.activeToolIndex = null;
	}

	hasSawToolCalls(): boolean {
		return this.toolCallState.size > 0;
	}

	private extractChunkContent(chunk: OpenAIStreamChunk): ChunkContent {
		const delta = chunk.choices[0]?.delta;
		if (!delta) return { hasContent: false, hasToolCalls: false };

		const content: ChunkContent = {
			hasContent: !!delta.content,
			content: delta.content,
			hasToolCalls: !!delta.tool_calls,
		};

		if (delta.tool_calls && delta.tool_calls.length > 0) {
			const toolCall = delta.tool_calls[0]; // Focus on first tool call
			content.activeToolIndex =
				typeof toolCall.index === "number" ? toolCall.index : 0;
			content.toolId = toolCall.id;
			content.toolName = toolCall.function?.name;
			content.toolArgs = toolCall.function?.arguments;

			// Update tool call state
			const idx = content.activeToolIndex!;
			const prev = this.toolCallState.get(idx) || {
				id: undefined,
				name: undefined,
				args: "",
			};
			this.toolCallState.set(idx, {
				id: toolCall.id ?? prev.id,
				name: toolCall.function?.name ?? prev.name,
				args: prev.args + (toolCall.function?.arguments || ""),
			});
		}

		return content;
	}

	private handleFirstChunk(
		current: ChunkContent,
		controller: TransformStreamDefaultController<Uint8Array>,
		_chunk: OpenAIStreamChunk,
	): void {
		if (current.hasContent) {
			// First chunk with content -> emit content_block_start + content_block_delta
			controller.enqueue(
				new TextEncoder().encode(
					formatSSEWithEvent("content_block_start", {
						type: "content_block_start",
						index: 0,
						content_block: { type: "text", text: "" },
					}),
				),
			);
			controller.enqueue(
				new TextEncoder().encode(
					formatSSEWithEvent("content_block_delta", {
						type: "content_block_delta",
						index: 0,
						delta: { type: "text_delta", text: current.content! },
					}),
				),
			);
			this.activeBlockType = "text";
			this.activeToolIndex = null;
		} else if (current.hasToolCalls) {
			// First chunk with tool calls -> emit tool_use content_block_start
			this.emitToolCallStart(current, controller);
			if (current.toolArgs) {
				this.emitToolCallDelta(current, controller);
			}
			this.activeBlockType = "tool";
			this.activeToolIndex = current.activeToolIndex!;
		}
	}

	private handleChunkTransition(
		previous: ChunkContent,
		current: ChunkContent,
		controller: TransformStreamDefaultController<Uint8Array>,
		_chunk: OpenAIStreamChunk,
	): void {
		if (previous.hasContent && current.hasContent) {
			// previous has content, current has content -> emit content_block_delta
			controller.enqueue(
				new TextEncoder().encode(
					formatSSEWithEvent("content_block_delta", {
						type: "content_block_delta",
						index: 0,
						delta: { type: "text_delta", text: current.content! },
					}),
				),
			);
		} else if (previous.hasContent && current.hasToolCalls) {
			// previous has content, current has tool_calls -> close text, start tool
			controller.enqueue(
				new TextEncoder().encode(
					formatSSEWithEvent("content_block_stop", {
						type: "content_block_stop",
						index: 0,
					}),
				),
			);
			this.emitToolCallStart(current, controller);
			if (current.toolArgs) {
				this.emitToolCallDelta(current, controller);
			}
			this.activeBlockType = "tool";
			this.activeToolIndex = current.activeToolIndex!;
		} else if (previous.hasToolCalls && current.hasToolCalls) {
			if (previous.activeToolIndex === current.activeToolIndex) {
				// Same tool call -> emit content_block_delta
				if (current.toolArgs) {
					this.emitToolCallDelta(current, controller);
				}
			} else {
				// Different tool call -> close previous, start new
				const prevBlockIndex = previous.activeToolIndex! + 1;
				controller.enqueue(
					new TextEncoder().encode(
						formatSSEWithEvent("content_block_stop", {
							type: "content_block_stop",
							index: prevBlockIndex,
						}),
					),
				);
				this.emitToolCallStart(current, controller);
				if (current.toolArgs) {
					this.emitToolCallDelta(current, controller);
				}
				this.activeBlockType = "tool";
				this.activeToolIndex = current.activeToolIndex!;
			}
		} else if (previous.hasToolCalls && current.hasContent) {
			// previous has tool_calls, current has content -> close tool, start text
			const prevBlockIndex = previous.activeToolIndex! + 1;
			controller.enqueue(
				new TextEncoder().encode(
					formatSSEWithEvent("content_block_stop", {
						type: "content_block_stop",
						index: prevBlockIndex,
					}),
				),
			);
			controller.enqueue(
				new TextEncoder().encode(
					formatSSEWithEvent("content_block_start", {
						type: "content_block_start",
						index: 0,
						content_block: { type: "text", text: "" },
					}),
				),
			);
			controller.enqueue(
				new TextEncoder().encode(
					formatSSEWithEvent("content_block_delta", {
						type: "content_block_delta",
						index: 0,
						delta: { type: "text_delta", text: current.content! },
					}),
				),
			);
			this.activeBlockType = "text";
			this.activeToolIndex = null;
		} else if (
			!previous.hasContent &&
			!previous.hasToolCalls &&
			current.hasContent
		) {
			// previous has nothing, current has content -> start new text block
			controller.enqueue(
				new TextEncoder().encode(
					formatSSEWithEvent("content_block_start", {
						type: "content_block_start",
						index: 0,
						content_block: { type: "text", text: "" },
					}),
				),
			);
			controller.enqueue(
				new TextEncoder().encode(
					formatSSEWithEvent("content_block_delta", {
						type: "content_block_delta",
						index: 0,
						delta: { type: "text_delta", text: current.content! },
					}),
				),
			);
			this.activeBlockType = "text";
			this.activeToolIndex = null;
		} else if (
			!previous.hasContent &&
			!previous.hasToolCalls &&
			current.hasToolCalls
		) {
			// previous has nothing, current has tool_calls -> start new tool block
			this.emitToolCallStart(current, controller);
			if (current.toolArgs) {
				this.emitToolCallDelta(current, controller);
			}
			this.activeBlockType = "tool";
			this.activeToolIndex = current.activeToolIndex!;
		}
		// Note: if both chunks have no content/tool_calls, we do nothing
	}

	private emitToolCallStart(
		current: ChunkContent,
		controller: TransformStreamDefaultController<Uint8Array>,
	): void {
		const blockIndex = current.activeToolIndex! + 1;
		const toolState = this.toolCallState.get(current.activeToolIndex!);
		const id =
			current.toolId || toolState?.id || `toolu_${current.activeToolIndex}`;
		const name = current.toolName || toolState?.name || "function";

		controller.enqueue(
			new TextEncoder().encode(
				formatSSEWithEvent("content_block_start", {
					type: "content_block_start",
					index: blockIndex,
					content_block: {
						type: "tool_use",
						id,
						name,
						input: {},
					},
				}),
			),
		);
	}

	private emitToolCallDelta(
		current: ChunkContent,
		controller: TransformStreamDefaultController<Uint8Array>,
	): void {
		const blockIndex = current.activeToolIndex! + 1;
		controller.enqueue(
			new TextEncoder().encode(
				formatSSEWithEvent("content_block_delta", {
					type: "content_block_delta",
					index: blockIndex,
					delta: {
						type: "input_json_delta",
						partial_json: current.toolArgs!,
					},
				}),
			),
		);
	}
}
