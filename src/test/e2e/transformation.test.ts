import { describe, expect, test } from "bun:test";
import { createMockLanguageModelV2StreamPart } from "../../utils/test-utils";
import { anthropicRequestToCallOptions } from "../../converters/anthropic/request";
import { transformToAnthropicResponse } from "../../converters/anthropic/response";
import type { AnthropicMessagesRequest } from "../../schemas/anthropic";
import type { LanguageModelV2 } from "@ai-sdk/provider";

describe("E2E Transformation Tests", () => {
	const _mockConfig = {
		targetBaseUrl: "http://localhost:8080",
		targetApiKey: "test-key",
		targetModel: "claude-3-5-sonnet-20241022",
		port: 3000,
		host: "localhost",
		enableLogging: false,
		enableCors: true,
		enableDebug: false,
	};

	describe("Non-streaming responses", () => {
		test("should handle complete request-response cycle for basic text", async () => {
			// Step 1: Original Anthropic request
			const anthropicRequest: AnthropicMessagesRequest = {
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Hello, how are you?",
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(anthropicRequest);

			// Step 3: Mock AI SDK response (simulating model response)
			const mockAiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
				content: [
					{
						type: "text",
						text: "I'm doing well, thank you for asking! How can I help you today?",
					},
				],
				finishReason: "stop",
				usage: {
					inputTokens: 12,
					outputTokens: 15,
				},
				response: {
					id: "resp_12345",
				},
			};

			// Step 4: Transform back to Anthropic response
			const anthropicResponse = transformToAnthropicResponse(mockAiSdkResponse, anthropicRequest.model);

			// Verify the complete transformation
			expect(anthropicResponse).toEqual({
				id: "resp_12345",
				type: "message",
				role: "assistant",
				content: [
					{
						type: "text",
						text: "I'm doing well, thank you for asking! How can I help you today?",
						citations: null,
					},
				],
				model: "claude-3-5-sonnet-20241022",
				stop_reason: "end_turn",
				stop_sequence: null,
				usage: {
					input_tokens: 12,
					output_tokens: 15,
					cache_creation_input_tokens: null,
					cache_read_input_tokens: null,
					cache_creation: null,
					server_tool_use: null,
					service_tier: null,
				},
				container: null,
			});

			// Verify that the CallOptions transformation was correct
			expect(callOptions.prompt).toEqual([
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Hello, how are you?",
						},
					],
				},
			]);
		});

		test("should handle complete cycle with tool calls", async () => {
			// Step 1: Original Anthropic request with tools
			const anthropicRequest: AnthropicMessagesRequest = {
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 1000,
				tools: [
					{
						name: "get_weather",
						description: "Get weather information for a location",
						input_schema: {
							type: "object",
							properties: {
								location: {
									type: "string",
									description: "The location to get weather for",
								},
							},
							required: ["location"],
						},
					},
				],
				messages: [
					{
						role: "user",
						content: "What's the weather in San Francisco?",
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(anthropicRequest);

			// Step 3: Mock AI SDK response with tool calls
			const mockAiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
				content: [
					{
						type: "tool-call",
						toolCallId: "tool_123",
						toolName: "get_weather",
						input: {
							location: "San Francisco",
						},
					},
				],
				finishReason: "tool-calls",
				usage: {
					inputTokens: 25,
					outputTokens: 18,
				},
				response: {
					id: "resp_67890",
				},
			};

			// Step 4: Transform back to Anthropic response
			const anthropicResponse = transformToAnthropicResponse(mockAiSdkResponse, anthropicRequest.model);

			// Verify the complete transformation
			expect(anthropicResponse.content).toEqual([
				{
					type: "tool_use",
					id: "tool_123",
					name: "get_weather",
					input: {
						location: "San Francisco",
					},
				},
			]);

			expect(anthropicResponse.stop_reason).toBe("tool_use");

			// Verify tools were properly transformed
			expect(callOptions.tools).toEqual([
				{
					type: "function",
					name: "get_weather",
					description: "Get weather information for a location",
					inputSchema: {
						type: "object",
						properties: {
							location: {
								type: "string",
								description: "The location to get weather for",
							},
						},
						required: ["location"],
					},
				},
			]);
		});

		test("should handle complete cycle with mixed content", async () => {
			// Step 1: Original Anthropic request
			const anthropicRequest: AnthropicMessagesRequest = {
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: "Calculate 2+2 and then get the weather",
							},
						],
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(anthropicRequest);

			// Step 3: Mock AI SDK response with mixed content
			const mockAiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
				content: [
					{
						type: "text",
						text: "I'll help you with that calculation and weather check.",
					},
					{
						type: "tool-call",
						toolCallId: "calc_123",
						toolName: "calculate",
						input: {
							expression: "2+2",
						},
					},
					{
						type: "tool-call",
						toolCallId: "weather_456",
						toolName: "get_weather",
						input: {
							location: "San Francisco",
						},
					},
				],
				finishReason: "tool-calls",
				usage: {
					inputTokens: 20,
					outputTokens: 35,
				},
				response: {
					id: "resp_mixed_123",
				},
			};

			// Step 4: Transform back to Anthropic response
			const anthropicResponse = transformToAnthropicResponse(mockAiSdkResponse, anthropicRequest.model);

			// Verify the complete transformation
			expect(anthropicResponse.content).toHaveLength(3);
			expect(anthropicResponse.content[0]).toEqual({
				type: "text",
				text: "I'll help you with that calculation and weather check.",
				citations: null,
			});
			expect(anthropicResponse.content[1]).toEqual({
				type: "tool_use",
				id: "calc_123",
				name: "calculate",
				input: {
					expression: "2+2",
				},
			});
			expect(anthropicResponse.content[2]).toEqual({
				type: "tool_use",
				id: "weather_456",
				name: "get_weather",
				input: {
					location: "San Francisco",
				},
			});
		});

		test("should handle complete cycle with reasoning blocks", async () => {
			// Step 1: Original Anthropic request
			const anthropicRequest: AnthropicMessagesRequest = {
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Solve this complex math problem step by step",
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(anthropicRequest);

			// Step 3: Mock AI SDK response with reasoning
			const mockAiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
				content: [
					{
						type: "reasoning",
						text: "I need to break this down into manageable steps. First, I'll identify the key components of the problem, then work through each part systematically.",
						providerMetadata: {
							anthropic: {
								signature: "abc123def456",
							},
						},
					},
					{
						type: "text",
						text: "Let me solve this step by step.",
					},
				],
				finishReason: "stop",
				usage: {
					inputTokens: 15,
					outputTokens: 25,
				},
				response: {
					id: "resp_reasoning_123",
				},
			};

			// Step 4: Transform back to Anthropic response
			const anthropicResponse = transformToAnthropicResponse(mockAiSdkResponse, anthropicRequest.model);

			// Verify the complete transformation
			expect(anthropicResponse.content).toHaveLength(2);
			expect(anthropicResponse.content[0]).toEqual({
				type: "thinking",
				signature: "abc123def456",
				thinking: "I need to break this down into manageable steps. First, I'll identify the key components of the problem, then work through each part systematically.",
			});
			expect(anthropicResponse.content[1]).toEqual({
				type: "text",
				text: "Let me solve this step by step.",
				citations: null,
			});
		});
	});

	describe("Streaming responses", () => {
		test("should handle complete streaming cycle for basic text", async () => {
			// Step 1: Original Anthropic request
			const anthropicRequest: AnthropicMessagesRequest = {
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 1000,
				stream: true,
				messages: [
					{
						role: "user",
						content: "Hello, how are you?",
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(anthropicRequest);

			// Step 3: Mock AI SDK stream parts
			const streamParts = [
				createMockLanguageModelV2StreamPart("stream-start"),
				createMockLanguageModelV2StreamPart("text-start"),
				createMockLanguageModelV2StreamPart("text-delta", { delta: "I'm" }),
				createMockLanguageModelV2StreamPart("text-delta", { delta: " doing" }),
				createMockLanguageModelV2StreamPart("text-delta", { delta: " well," }),
				createMockLanguageModelV2StreamPart("text-delta", { delta: " thank you!" }),
				createMockLanguageModelV2StreamPart("text-end"),
				createMockLanguageModelV2StreamPart("finish", {
					finishReason: "stop",
					usage: { inputTokens: 12, outputTokens: 8 },
				}),
			];

			// Verify that the CallOptions transformation preserves streaming intent
			expect(callOptions.prompt).toEqual([
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Hello, how are you?",
						},
					],
				},
			]);

			// Verify stream parts structure
			expect(streamParts).toHaveLength(8);
			expect(streamParts[0].type).toBe("stream-start");
			expect(streamParts[1].type).toBe("text-start");
			expect(streamParts[2].delta).toBe("I'm");
			expect(streamParts[6].type).toBe("text-end");
			expect(streamParts[7].finishReason).toBe("stop");
		});

		test("should handle complete streaming cycle with tool calls", async () => {
			// Step 1: Original Anthropic request with tools
			const anthropicRequest: AnthropicMessagesRequest = {
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 1000,
				stream: true,
				tools: [
					{
						name: "get_weather",
						description: "Get weather information",
						input_schema: {
							type: "object",
							properties: {
								location: { type: "string" },
							},
							required: ["location"],
						},
					},
				],
				messages: [
					{
						role: "user",
						content: "What's the weather in San Francisco?",
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(anthropicRequest);

			// Step 3: Mock AI SDK stream parts for tool calls
			const streamParts = [
				createMockLanguageModelV2StreamPart("stream-start"),
				createMockLanguageModelV2StreamPart("text-start"),
				createMockLanguageModelV2StreamPart("text-delta", { delta: "I'll check" }),
				createMockLanguageModelV2StreamPart("text-delta", { delta: " the weather" }),
				createMockLanguageModelV2StreamPart("text-end"),
				createMockLanguageModelV2StreamPart("tool-input-start", {
					id: "tool_123",
					toolName: "get_weather",
				}),
				createMockLanguageModelV2StreamPart("tool-input-delta", { delta: '{"location":' }),
				createMockLanguageModelV2StreamPart("tool-input-delta", { delta: '"San Francisco"}' }),
				createMockLanguageModelV2StreamPart("tool-input-end"),
				createMockLanguageModelV2StreamPart("finish", {
					finishReason: "tool-calls",
					usage: { inputTokens: 20, outputTokens: 15 },
				}),
			];

			// Verify CallOptions include tools
			expect(callOptions.tools).toHaveLength(1);
			expect(callOptions.tools[0].name).toBe("get_weather");

			// Verify stream parts structure
			expect(streamParts).toHaveLength(10);
			expect(streamParts[5].type).toBe("tool-input-start");
			expect(streamParts[5].id).toBe("tool_123");
			expect(streamParts[5].toolName).toBe("get_weather");
			expect(streamParts[6].delta).toBe('{"location":');
			expect(streamParts[7].delta).toBe('"San Francisco"}');
		});

		test("should handle complete streaming cycle with reasoning", async () => {
			// Step 1: Original Anthropic request
			const anthropicRequest: AnthropicMessagesRequest = {
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 1000,
				stream: true,
				messages: [
					{
						role: "user",
						content: "Help me think through this problem",
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(anthropicRequest);

			// Step 3: Mock AI SDK stream parts with reasoning
			const streamParts = [
				createMockLanguageModelV2StreamPart("stream-start"),
				createMockLanguageModelV2StreamPart("reasoning-start"),
				createMockLanguageModelV2StreamPart("reasoning-delta", { delta: "I need to" }),
				createMockLanguageModelV2StreamPart("reasoning-delta", { delta: " analyze this" }),
				createMockLanguageModelV2StreamPart("reasoning-delta", { delta: " step by step" }),
				createMockLanguageModelV2StreamPart("reasoning-end"),
				createMockLanguageModelV2StreamPart("text-start"),
				createMockLanguageModelV2StreamPart("text-delta", { delta: "Here's my analysis" }),
				createMockLanguageModelV2StreamPart("text-end"),
				createMockLanguageModelV2StreamPart("finish", {
					finishReason: "stop",
					usage: { inputTokens: 18, outputTokens: 20 },
				}),
			];

			// Verify CallOptions transformation
			expect(callOptions.prompt).toEqual([
				{
					role: "user",
					content: [
						{
							type: "text",
							text: "Help me think through this problem",
						},
					],
				},
			]);

			// Verify stream parts structure
			expect(streamParts).toHaveLength(10);
			expect(streamParts[1].type).toBe("reasoning-start");
			expect(streamParts[2].delta).toBe("I need to");
			expect(streamParts[3].delta).toBe(" analyze this");
			expect(streamParts[4].delta).toBe(" step by step");
			expect(streamParts[5].type).toBe("reasoning-end");
			expect(streamParts[7].delta).toBe("Here's my analysis");
		});
	});

	describe("Edge cases and error handling", () => {
		test("should handle empty responses", async () => {
			const anthropicRequest: AnthropicMessagesRequest = {
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Hello",
					},
				],
			};

			const callOptions = anthropicRequestToCallOptions(anthropicRequest);

			const mockAiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
				content: [],
				finishReason: "stop",
				usage: {
					inputTokens: 5,
					outputTokens: 0,
				},
				response: {
					id: "resp_empty_123",
				},
			};

			const anthropicResponse = transformToAnthropicResponse(mockAiSdkResponse, anthropicRequest.model);

			expect(anthropicResponse.content).toEqual([]);
			expect(anthropicResponse.usage.input_tokens).toBe(5);
			expect(anthropicResponse.usage.output_tokens).toBe(0);
		});

		test("should handle very long content", async () => {
			const longText = "A".repeat(10000);
			const anthropicRequest: AnthropicMessagesRequest = {
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Generate a long response",
					},
				],
			};

			const callOptions = anthropicRequestToCallOptions(anthropicRequest);

			const mockAiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
				content: [
					{
						type: "text",
						text: longText,
					},
				],
				finishReason: "stop",
				usage: {
					inputTokens: 8,
					outputTokens: 10000,
				},
				response: {
					id: "resp_long_123",
				},
			};

			const anthropicResponse = transformToAnthropicResponse(mockAiSdkResponse, anthropicRequest.model);

			expect(anthropicResponse.content[0].text).toBe(longText);
			expect(anthropicResponse.usage.output_tokens).toBe(10000);
		});

		test("should handle cache tokens when implemented", async () => {
			const anthropicRequest: AnthropicMessagesRequest = {
				model: "claude-3-5-sonnet-20241022",
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Hello",
					},
				],
			};

			const callOptions = anthropicRequestToCallOptions(anthropicRequest);

			const mockAiSdkResponse: Awaited<ReturnType<LanguageModelV2["doGenerate"]>> = {
				content: [
					{
						type: "text",
						text: "Hello!",
					},
				],
				finishReason: "stop",
				usage: {
					inputTokens: 10,
					outputTokens: 5,
					cachedInputTokens: 8, // This will be used for cache_read_input_tokens when implemented
				},
				response: {
					id: "resp_cache_123",
				},
			};

			const anthropicResponse = transformToAnthropicResponse(mockAiSdkResponse, anthropicRequest.model);

			// Currently cache tokens are null, but this test will verify when implemented
			expect(anthropicResponse.usage.cache_creation_input_tokens).toBeNull();
			expect(anthropicResponse.usage.cache_read_input_tokens).toBeNull();
			expect(anthropicResponse.usage.input_tokens).toBe(10);
			expect(anthropicResponse.usage.output_tokens).toBe(5);
		});
	});
});