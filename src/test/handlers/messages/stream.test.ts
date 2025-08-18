import { describe, expect, test } from "bun:test";
import { handleStream } from "../../../handlers/messages/stream";
import { readableFromAsyncIterable } from "../../../utils/test-utils";

describe("handleStream", () => {
	const mockConfig = {
		targetBaseUrl: "http://localhost:8080",
		targetApiKey: "test-key",
		targetModel: "test-model",
		port: 3000,
		host: "localhost",
		enableLogging: false,
		enableCors: true,
		enableDebug: false,
		debugDir: "./debug",
	};

	test("should convert basic text stream", async () => {
		const streamParts = [
			{ type: "stream-start" as const, warnings: [] },
			{ type: "text-start" as const },
			{ type: "text-delta" as const, delta: "Hello" },
			{ type: "text-delta" as const, delta: " world!" },
			{ type: "text-end" as const },
			{ type: "finish" as const, finishReason: "stop", usage: { inputTokens: 10, outputTokens: 6 } },
		];

		const readable = readableFromAsyncIterable(streamParts);
		const response = handleStream(readable, "test-123", mockConfig);

		expect(response.status).toBe(200);
		expect(response.headers.get("Content-Type")).toBe("text/event-stream");
		expect(response.headers.get("Cache-Control")).toBe("no-cache");
		expect(response.headers.get("Access-Control-Allow-Origin")).toBe("*");

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		const chunks: string[] = [];

		while (reader) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(decoder.decode(value));
		}

		const fullResponse = chunks.join("");
		expect(fullResponse).toContain("event: message_start");
		expect(fullResponse).toContain("event: content_block_start");
		expect(fullResponse).toContain("event: content_block_delta");
		expect(fullResponse).toContain("event: content_block_stop");
		expect(fullResponse).toContain("event: message_delta");
		expect(fullResponse).toContain("event: message_stop");
		expect(fullResponse).toContain("Hello");
		expect(fullResponse).toContain(" world!");
	});

	test("should convert reasoning stream", async () => {
		const streamParts = [
			{ type: "stream-start" as const, warnings: [] },
			{ type: "reasoning-start" as const },
			{ type: "reasoning-delta" as const, delta: "I need to think" },
			{ type: "reasoning-delta" as const, delta: " about this" },
			{ type: "reasoning-end" as const },
			{ type: "finish" as const, finishReason: "stop", usage: { inputTokens: 15, outputTokens: 8 } },
		];

		const readable = readableFromAsyncIterable(streamParts);
		const response = handleStream(readable, "test-456", mockConfig);

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		const chunks: string[] = [];

		while (reader) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(decoder.decode(value));
		}

		const fullResponse = chunks.join("");
		expect(fullResponse).toContain("I need to think");
		expect(fullResponse).toContain(" about this");
		expect(fullResponse).toContain("\"type\":\"text_delta\"");
	});

	test("should convert tool use stream", async () => {
		const streamParts = [
			{ type: "stream-start" as const, warnings: [] },
			{ type: "tool-input-start" as const, id: "tool_1", toolName: "get_weather" },
			{ type: "tool-input-delta" as const, delta: '{"location"' },
			{ type: "tool-input-delta" as const, delta: ': "San Francisco"}' },
			{ type: "tool-input-end" as const },
			{ type: "finish" as const, finishReason: "tool-calls", usage: { inputTokens: 20, outputTokens: 12 } },
		];

		const readable = readableFromAsyncIterable(streamParts);
		const response = handleStream(readable, "test-789", mockConfig);

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		const chunks: string[] = [];

		while (reader) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(decoder.decode(value));
		}

		const fullResponse = chunks.join("");
		expect(fullResponse).toContain("\"type\":\"tool_use\"");
		expect(fullResponse).toContain("\"id\":\"tool_1\"");
		expect(fullResponse).toContain("\"name\":\"get_weather\"");
		expect(fullResponse).toContain("\"type\":\"input_json_delta\"");
		expect(fullResponse).toContain("{\\\"location\\\"");
		expect(fullResponse).toContain(": \\\"San Francisco\\\"}");
	});

	test("should handle mixed content stream", async () => {
		const streamParts = [
			{ type: "stream-start" as const, warnings: [] },
			{ type: "text-start" as const },
			{ type: "text-delta" as const, delta: "I'll help you " },
			{ type: "text-end" as const },
			{ type: "tool-input-start" as const, id: "tool_1", toolName: "calculate" },
			{ type: "tool-input-delta" as const, delta: '{"expr": "2+2"}' },
			{ type: "tool-input-end" as const },
			{ type: "text-start" as const },
			{ type: "text-delta" as const, delta: " with that." },
			{ type: "text-end" as const },
			{ type: "finish" as const, finishReason: "stop", usage: { inputTokens: 25, outputTokens: 18 } },
		];

		const readable = readableFromAsyncIterable(streamParts);
		const response = handleStream(readable, "test-mixed", mockConfig);

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		const chunks: string[] = [];

		while (reader) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(decoder.decode(value));
		}

		const fullResponse = chunks.join("");
		expect(fullResponse).toContain("I'll help you ");
		expect(fullResponse).toContain(" with that.");
		expect(fullResponse).toContain("\"type\":\"tool_use\"");
		expect(fullResponse).toContain("{\\\"expr\\\": \\\"2+2\\\"}");
	});

	test("should handle cache tokens in usage", async () => {
		const streamParts = [
			{ type: "stream-start" as const, warnings: [] },
			{ type: "text-start" as const },
			{ type: "text-delta" as const, delta: "Response with cache" },
			{ type: "text-end" as const },
			{ type: "finish" as const, finishReason: "stop", usage: { inputTokens: 10, outputTokens: 5, cachedInputTokens: 8 } },
		];

		const readable = readableFromAsyncIterable(streamParts);
		const response = handleStream(readable, "test-cache", mockConfig);

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		const chunks: string[] = [];

		while (reader) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(decoder.decode(value));
		}

		const fullResponse = chunks.join("");
		expect(fullResponse).toContain("\"cache_read_input_tokens\":8");
		expect(fullResponse).toContain("\"cache_read_input_tokens\":8");
	});

	test("should handle error events", async () => {
		const streamParts = [
			{ type: "error" as const, error: new Error("Test error") },
		];

		const readable = readableFromAsyncIterable(streamParts);
		const response = handleStream(readable, "test-error", mockConfig);

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		const chunks: string[] = [];

		while (reader) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(decoder.decode(value));
		}

		const fullResponse = chunks.join("");
		expect(fullResponse).toContain("event: error");
		expect(fullResponse).toContain("\"type\":\"api_error\"");
		expect(fullResponse).toContain("\"message\":\"Unknown error\"");
	});

	test("should skip unsupported events", async () => {
		const streamParts = [
			{ type: "stream-start" as const, warnings: [] },
			{ type: "text-start" as const },
			{ type: "text-delta" as const, delta: "Test" },
			{ type: "text-end" as const },
			{ type: "source" as const },
			{ type: "file" as const },
			{ type: "tool-result" as const },
			{ type: "finish" as const, finishReason: "stop", usage: { inputTokens: 5, outputTokens: 2 } },
		];

		const readable = readableFromAsyncIterable(streamParts);
		const response = handleStream(readable, "test-skip", mockConfig);

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		const chunks: string[] = [];

		while (reader) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(decoder.decode(value));
		}

		const fullResponse = chunks.join("");
		expect(fullResponse).toContain("Test");
		expect(fullResponse).toContain("event: message_stop");
		// Should not contain unsupported events
		expect(fullResponse).not.toContain("type: \"source\"");
		expect(fullResponse).not.toContain("type: \"file\"");
		expect(fullResponse).not.toContain("type: \"tool-result\"");
	});

	test("should handle empty stream", async () => {
		const streamParts: Array<{ type: string }> = [
			{ type: "stream-start" as const, warnings: [] },
			{ type: "finish" as const, finishReason: "stop", usage: { inputTokens: 0, outputTokens: 0 } },
		];

		const readable = readableFromAsyncIterable(streamParts);
		const response = handleStream(readable, "test-empty", mockConfig);

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		const chunks: string[] = [];

		while (reader) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(decoder.decode(value));
		}

		const fullResponse = chunks.join("");
		expect(fullResponse).toContain("event: message_start");
		expect(fullResponse).toContain("event: message_delta");
		expect(fullResponse).toContain("event: message_stop");
	});

	test("should handle finish without usage", async () => {
		const streamParts = [
			{ type: "stream-start" as const, warnings: [] },
			{ type: "text-start" as const },
			{ type: "text-delta" as const, delta: "Test" },
			{ type: "text-end" as const },
			{ type: "finish" as const, finishReason: "stop" },
		];

		const readable = readableFromAsyncIterable(streamParts);
		const response = handleStream(readable, "test-no-usage", mockConfig);

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		const chunks: string[] = [];

		while (reader) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(decoder.decode(value));
		}

		const fullResponse = chunks.join("");
		expect(fullResponse).toContain("Test");
		expect(fullResponse).toContain("event: message_stop");
	});

	test("should map finish reasons correctly", async () => {
		const testCases = [
			{ finishReason: "stop", expected: "end_turn" },
			{ finishReason: "length", expected: "max_tokens" },
			{ finishReason: "tool-calls", expected: "tool_use" },
		];

		for (const { finishReason, expected } of testCases) {
			const streamParts = [
				{ type: "stream-start" as const, warnings: [] },
				{ type: "text-start" as const },
				{ type: "text-delta" as const, delta: "Test" },
				{ type: "text-end" as const },
				{ type: "finish" as const, finishReason: finishReason as "stop" | "length" | "tool-calls" | "content-filter" | "unknown", usage: { inputTokens: 1, outputTokens: 1 } },
			];

			const readable = readableFromAsyncIterable(streamParts);
			const response = handleStream(readable, `test-${finishReason}`, mockConfig);

			const reader = response.body?.getReader();
			const decoder = new TextDecoder();
			const chunks: string[] = [];

			while (reader) {
				const { done, value } = await reader.read();
				if (done) break;
				chunks.push(decoder.decode(value));
			}

			const fullResponse = chunks.join("");
			expect(fullResponse).toContain(`"stop_reason":"${expected}"`);
		}
	});

	test("should handle multiple message starts", async () => {
		const streamParts = [
			{ type: "stream-start" as const, warnings: [] },
			{ type: "stream-start" as const, warnings: [] }, // Duplicate
			{ type: "text-start" as const },
			{ type: "text-delta" as const, delta: "Test" },
			{ type: "text-end" as const },
			{ type: "finish" as const, finishReason: "stop", usage: { inputTokens: 1, outputTokens: 1 } },
		];

		const readable = readableFromAsyncIterable(streamParts);
		const response = handleStream(readable, "test-duplicate-start", mockConfig);

		const reader = response.body?.getReader();
		const decoder = new TextDecoder();
		const chunks: string[] = [];

		while (reader) {
			const { done, value } = await reader.read();
			if (done) break;
			chunks.push(decoder.decode(value));
		}

		const fullResponse = chunks.join("");
		// Should only have one message_start event
		const messageStartCount = (fullResponse.match(/event: message_start/g) || []).length;
		expect(messageStartCount).toBe(1);
	});
});