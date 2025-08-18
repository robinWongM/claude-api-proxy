import { describe, expect, test } from "bun:test";
import { transformToAnthropicResponse } from "../../../converters/anthropic/response";
import type { LanguageModelV2 } from "@ai-sdk/provider";

describe("transformToAnthropicResponse", () => {
	const mockModel = "claude-3-5-sonnet-20241022";

	test("should convert basic text response", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "text",
					text: "Hello! How can I help you?",
				},
			],
			finishReason: "stop",
			usage: {
				inputTokens: 10,
				outputTokens: 8,
			},
			response: {
				id: "resp_123",
			},
		};

		const result = transformToAnthropicResponse(aiSdkResponse, mockModel);

		expect(result).toEqual({
			id: "resp_123",
			type: "message",
			role: "assistant",
			content: [
				{
					type: "text",
					text: "Hello! How can I help you?",
					citations: null,
				},
			],
			model: mockModel,
			stop_reason: "end_turn",
			stop_sequence: null,
			usage: {
				input_tokens: 10,
				output_tokens: 8,
				cache_creation_input_tokens: null,
				cache_read_input_tokens: null,
				cache_creation: null,
				server_tool_use: null,
				service_tier: null,
			},
			container: null,
		});
	});

	test("should convert response with tool calls", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "tool-call",
					toolCallId: "tool_1",
					toolName: "get_weather",
					input: {
						location: "San Francisco",
						unit: "celsius",
					},
				},
			],
			finishReason: "tool-calls",
			usage: {
				inputTokens: 15,
				outputTokens: 12,
			},
		};

		const result = transformToAnthropicResponse(aiSdkResponse, mockModel);

		expect(result).toEqual({
			id: expect.any(String),
			type: "message",
			role: "assistant",
			content: [
				{
					type: "tool_use",
					id: "tool_1",
					name: "get_weather",
					input: {
						location: "San Francisco",
						unit: "celsius",
					},
				},
			],
			model: mockModel,
			stop_reason: "tool_use",
			stop_sequence: null,
			usage: {
				input_tokens: 15,
				output_tokens: 12,
				cache_creation_input_tokens: null,
				cache_read_input_tokens: null,
				cache_creation: null,
				server_tool_use: null,
				service_tier: null,
			},
			container: null,
		});
	});

	test("should convert tool call with string input", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "tool-call",
					toolCallId: "tool_2",
					toolName: "calculate",
					input: JSON.stringify({ expression: "2+2" }),
				},
			],
			finishReason: "tool-calls",
			usage: {
				inputTokens: 8,
				outputTokens: 6,
			},
		};

		const result = transformToAnthropicResponse(aiSdkResponse, mockModel);

		expect(result.content[0]).toEqual({
			type: "tool_use",
			id: "tool_2",
			name: "calculate",
			input: {
				expression: "2+2",
			},
		});
	});

	test("should convert response with reasoning blocks", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "reasoning",
					text: "I need to calculate the result step by step",
					providerMetadata: {
						anthropic: {
							signature: "abc123def456",
						},
					},
				},
			],
			finishReason: "stop",
			usage: {
				inputTokens: 20,
				outputTokens: 15,
			},
		};

		const result = transformToAnthropicResponse(aiSdkResponse, mockModel);

		expect(result).toEqual({
			id: expect.any(String),
			type: "message",
			role: "assistant",
			content: [
				{
					type: "thinking",
					signature: "abc123def456",
					thinking: "I need to calculate the result step by step",
				},
			],
			model: mockModel,
			stop_reason: "end_turn",
			stop_sequence: null,
			usage: {
				input_tokens: 20,
				output_tokens: 15,
				cache_creation_input_tokens: null,
				cache_read_input_tokens: null,
				cache_creation: null,
				server_tool_use: null,
				service_tier: null,
			},
			container: null,
		});
	});

	test("should convert reasoning without signature", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "reasoning",
					text: "Simple reasoning",
				},
			],
			finishReason: "stop",
			usage: {
				inputTokens: 5,
				outputTokens: 3,
			},
		};

		const result = transformToAnthropicResponse(aiSdkResponse, mockModel);

		expect(result.content[0]).toEqual({
			type: "thinking",
			signature: "",
			thinking: "Simple reasoning",
		});
	});

	test("should convert mixed content types", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "text",
					text: "I'll help you with that calculation.",
				},
				{
					type: "tool-call",
					toolCallId: "tool_3",
					toolName: "calculate",
					input: {
						expression: "2+2",
					},
				},
			],
			finishReason: "tool-calls",
			usage: {
				inputTokens: 18,
				outputTokens: 14,
			},
		};

		const result = transformToAnthropicResponse(aiSdkResponse, mockModel);

		expect(result.content).toEqual([
			{
				type: "text",
				text: "I'll help you with that calculation.",
				citations: null,
			},
			{
				type: "tool_use",
				id: "tool_3",
				name: "calculate",
				input: {
					expression: "2+2",
				},
			},
		]);
	});

	test("should handle zero token usage", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "text",
					text: "",
				},
			],
			finishReason: "stop",
			usage: {
				inputTokens: 0,
				outputTokens: 0,
			},
		};

		const result = transformToAnthropicResponse(aiSdkResponse, mockModel);

		expect(result.usage).toEqual({
			input_tokens: 0,
			output_tokens: 0,
			cache_creation_input_tokens: null,
			cache_read_input_tokens: null,
			cache_creation: null,
			server_tool_use: null,
			service_tier: null,
		});
	});

	test("should generate random ID when response ID is missing", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "text",
					text: "Hello",
				},
			],
			finishReason: "stop",
			usage: {
				inputTokens: 5,
				outputTokens: 2,
			},
		};

		const result = transformToAnthropicResponse(aiSdkResponse, mockModel);

		expect(result.id).toBeString();
		expect(result.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
	});

	test("should handle different finish reasons", () => {
		const testCases = [
			{ finishReason: "stop", expected: "end_turn" },
			{ finishReason: "length", expected: "max_tokens" },
			{ finishReason: "tool-calls", expected: "tool_use" },
			{ finishReason: "content-filter", expected: "refusal" },
			{ finishReason: "unknown", expected: "end_turn" },
		];

		testCases.forEach(({ finishReason, expected }) => {
			const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
				content: [
					{
						type: "text",
						text: "Test",
					},
				],
				finishReason: finishReason as "stop" | "length" | "tool-calls" | "content-filter" | "unknown",
				usage: {
					inputTokens: 1,
					outputTokens: 1,
				},
			};

			const result = transformToAnthropicResponse(aiSdkResponse, mockModel);
			expect(result.stop_reason).toBe(expected);
		});
	});

	test("should throw error for tool results in assistant response", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "tool-result",
					toolCallId: "tool_1",
					toolName: "test",
					output: {
						type: "text",
						value: "Result",
					},
				},
			],
			finishReason: "stop",
			usage: {
				inputTokens: 1,
				outputTokens: 1,
			},
		};

		expect(() => transformToAnthropicResponse(aiSdkResponse, mockModel)).toThrow(
			"Tool results should not appear in assistant responses",
		);
	});

	test("should throw error for files in assistant response", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "file",
					data: "base64data",
					mediaType: "image/jpeg",
				},
			],
			finishReason: "stop",
			usage: {
				inputTokens: 1,
				outputTokens: 1,
			},
		};

		expect(() => transformToAnthropicResponse(aiSdkResponse, mockModel)).toThrow(
			"Files and images are not supported in Anthropic assistant responses",
		);
	});

	test("should throw error for unsupported content type", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "unknown" as "text" | "tool-call" | "reasoning" | "tool-result" | "file",
					data: "test",
				},
			],
			finishReason: "stop",
			usage: {
				inputTokens: 1,
				outputTokens: 1,
			},
		};

		expect(() => transformToAnthropicResponse(aiSdkResponse, mockModel)).toThrow(
			"Unsupported content type: unknown",
		);
	});

	test("should handle empty text content", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "text",
					text: "",
				},
			],
			finishReason: "stop",
			usage: {
				inputTokens: 1,
				outputTokens: 0,
			},
		};

		const result = transformToAnthropicResponse(aiSdkResponse, mockModel);

		expect(result.content[0]).toEqual({
			type: "text",
			text: "",
			citations: null,
		});
	});

	test("should cache token fields are null until implemented", () => {
		const aiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
			content: [
				{
					type: "text",
					text: "Test response",
				},
			],
			finishReason: "stop",
			usage: {
				inputTokens: 10,
				outputTokens: 5,
			},
		};

		const result = transformToAnthropicResponse(aiSdkResponse, mockModel);

		expect(result.usage.cache_creation_input_tokens).toBeNull();
		expect(result.usage.cache_read_input_tokens).toBeNull();
		expect(result.usage.cache_creation).toBeNull();
	});
});