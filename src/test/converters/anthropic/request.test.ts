import { describe, expect, test } from "bun:test";
import { anthropicRequestToCallOptions } from "../../../converters/anthropic/request";
import type { AnthropicMessagesRequest } from "../../../schemas/anthropic";

describe("anthropicRequestToCallOptions", () => {
	test("should convert basic text request", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1000,
			messages: [
				{
					role: "user",
					content: "Hello, how are you?",
				},
			],
		};

		const result = anthropicRequestToCallOptions(request);

		expect(result).toEqual({
			prompt: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Hello, how are you?",
						},
					],
				},
			],
			tools: [],
			maxOutputTokens: 1000,
			stopSequences: undefined,
			temperature: undefined,
			topK: undefined,
			topP: undefined,
		});
	});

	test("should convert request with system message", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1000,
			system: "You are a helpful assistant",
			messages: [
				{
					role: "user",
					content: "Hello",
				},
			],
		};

		const result = anthropicRequestToCallOptions(request);

		expect(result).toEqual({
			prompt: [
				{
					role: "system",
					content: "You are a helpful assistant",
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Hello",
						},
					],
				},
			],
			tools: [],
			maxOutputTokens: 1000,
			stopSequences: undefined,
			temperature: undefined,
			topK: undefined,
			topP: undefined,
		});
	});

	test("should convert request with array system message", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1000,
			system: [
				{
					type: "text",
					text: "You are a helpful assistant",
				},
				{
					type: "text",
					text: "Be concise",
				},
			],
			messages: [
				{
					role: "user",
					content: "Hello",
				},
			],
		};

		const result = anthropicRequestToCallOptions(request);

		expect(result).toEqual({
			prompt: [
				{
					role: "system",
					content: "You are a helpful assistant\nBe concise",
				},
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Hello",
						},
					],
				},
			],
			tools: [],
			maxOutputTokens: 1000,
			stopSequences: undefined,
			temperature: undefined,
			topK: undefined,
			topP: undefined,
		});
	});

	test("should convert request with structured content", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1000,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Hello",
						},
					],
				},
			],
		};

		const result = anthropicRequestToCallOptions(request);

		expect(result).toEqual({
			prompt: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Hello",
						},
					],
				},
			],
			tools: [],
			maxOutputTokens: 1000,
			stopSequences: undefined,
			temperature: undefined,
			topK: undefined,
			topP: undefined,
		});
	});

	test("should convert request with tool use", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1000,
			tools: [
				{
					name: "get_weather",
					description: "Get weather information",
					input_schema: {
						type: "object",
						properties: {
							location: {
								type: "string",
							},
						},
						required: ["location"],
					},
				},
			],
			messages: [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool_1",
							name: "get_weather",
							input: {
								location: "San Francisco",
							},
						},
					],
				},
			],
		};

		const result = anthropicRequestToCallOptions(request);

		expect(result).toEqual({
			prompt: [
				{
					role: "assistant",
					content: [
						{
							type: "tool-call",
							toolCallId: "tool_1",
							toolName: "get_weather",
							input: {
								location: "San Francisco",
							},
						},
					],
				},
			],
			tools: [
				{
					type: "function",
					name: "get_weather",
					description: "Get weather information",
					inputSchema: {
						type: "object",
						properties: {
							location: {
								type: "string",
							},
						},
						required: ["location"],
					},
				},
			],
			maxOutputTokens: 1000,
			stopSequences: undefined,
			temperature: undefined,
			topK: undefined,
			topP: undefined,
		});
	});

	test("should convert request with tool results", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1000,
			messages: [
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool_1",
							content: "The weather is sunny",
						},
					],
				},
			],
		};

		// This should throw an error because tool name is not available in isolation
		expect(() => anthropicRequestToCallOptions(request)).toThrow();
	});

	test("should convert request with tool results when tool was previously used", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1000,
			messages: [
				{
					role: "assistant",
					content: [
						{
							type: "tool_use",
							id: "tool_1",
							name: "get_weather",
							input: {
								location: "San Francisco",
							},
						},
					],
				},
				{
					role: "user",
					content: [
						{
							type: "tool_result",
							tool_use_id: "tool_1",
							content: "The weather is sunny",
						},
					],
				},
			],
		};

		const result = anthropicRequestToCallOptions(request);

		expect(result.prompt[1]).toEqual({
			role: "tool",
			content: [
				{
					type: "tool-result",
					toolCallId: "tool_1",
					toolName: "get_weather",
					output: {
						type: "text",
						value: "The weather is sunny",
					},
				},
			],
		});
	});

	test("should convert request with provider-defined tools", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1000,
			tools: [
				{
					name: "bash",
					type: "bash_20241022",
				},
			],
			messages: [
				{
					role: "user",
					content: "Run a command",
				},
			],
		};

		const result = anthropicRequestToCallOptions(request);

		expect(result.tools).toEqual([
			{
				type: "provider-defined",
				id: "anthropic.bash",
				name: "bash",
				args: {},
			},
		]);
	});

	test("should convert request with thinking blocks", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1000,
			messages: [
				{
					role: "assistant",
					content: [
						{
							type: "thinking",
							thinking: "I need to think about this",
							signature: "abc123",
						},
					],
				},
			],
		};

		const result = anthropicRequestToCallOptions(request);

		expect(result.prompt[0]).toEqual({
			role: "assistant",
			content: [
				{
					type: "reasoning",
					text: "I need to think about this",
					providerOptions: {
						anthropic: {
							signature: "abc123",
						},
					},
				},
			],
		});
	});

	test("should handle all optional parameters", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1000,
			temperature: 0.7,
			top_p: 0.9,
			top_k: 50,
			stop_sequences: ["\n\n", "Human:"],
			messages: [
				{
					role: "user",
					content: "Hello",
				},
			],
		};

		const result = anthropicRequestToCallOptions(request);

		expect(result).toEqual({
			prompt: [
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Hello",
						},
					],
				},
			],
			tools: [],
			maxOutputTokens: 1000,
			stopSequences: ["\n\n", "Human:"],
			temperature: 0.7,
			topK: 50,
			topP: 0.9,
		});
	});

	test("should cap max_output_tokens at 8192", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 10000,
			messages: [
				{
					role: "user",
					content: "Hello",
				},
			],
		};

		const result = anthropicRequestToCallOptions(request);

		expect(result.maxOutputTokens).toBe(8192);
	});

	test("should throw error for unsupported tool type", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1000,
			tools: [
				{
					name: "unknown_tool",
					// @ts-expect-error - This is a test
					type: "unknown_type",
				},
			],
			messages: [
				{
					role: "user",
					content: "Hello",
				},
			],
		};

		expect(() => anthropicRequestToCallOptions(request)).toThrow(
			"Unsupported tool type: unknown_type",
		);
	});

	test("should throw error for unsupported message part type", () => {
		const request: AnthropicMessagesRequest = {
			model: "claude-3-5-sonnet-20241022",
			max_tokens: 1000,
			messages: [
				{
					role: "user",
					content: [
						{
							// @ts-expect-error - This is a test
							type: "unknown_type",
							data: "test",
						},
					],
				},
			],
		};

		expect(() => anthropicRequestToCallOptions(request)).toThrow(
			"Unsupported message part type: unknown_type",
		);
	});
});