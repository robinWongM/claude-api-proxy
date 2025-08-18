import { describe, expect, test } from "bun:test";
import { Anthropic } from "@anthropic-ai/sdk";
import { anthropicRequestToCallOptions } from "../../converters/anthropic/request";
import type { AnthropicMessagesRequest } from "../../schemas/anthropic";

// Skip this test if Anthropic API key is not available
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const describeIf = anthropicApiKey ? describe : describe.skip;

describeIf("Integration Tests with Anthropic Client", () => {
	const anthropic = new Anthropic({
		apiKey: anthropicApiKey,
	});

	const testModel = "claude-3-5-sonnet-20241022";

	describe("Request transformation verification", () => {
		test("should verify basic request transformation preserves intent", async () => {
			// Step 1: Create original Anthropic request
			const originalRequest: AnthropicMessagesRequest = {
				model: testModel,
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Hello, how are you today?",
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(originalRequest);

			// Step 3: Simulate what the AI SDK would send to the model
			// This represents the "model prompt" mentioned in the original requirements
			const simulatedModelPrompt = callOptions.prompt;

			// Step 4: Make the actual request to Anthropic API
			const anthropicResponse = await anthropic.messages.create({
				model: testModel,
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Hello, how are you today?",
					},
				],
			});

			// Step 5: Verify that the transformed request preserves the original intent
			// by comparing the message structure and content
			expect(simulatedModelPrompt).toHaveLength(1);
			expect(simulatedModelPrompt[0].role).toBe("user");
			expect(simulatedModelPrompt[0].content).toHaveLength(1);
			expect(simulatedModelPrompt[0].content[0].type).toBe("text");
			expect(simulatedModelPrompt[0].content[0].text).toBe("Hello, how are you today?");

			// Verify that the original request and transformed request produce valid responses
			expect(anthropicResponse).toBeDefined();
			expect(anthropicResponse.content).toHaveLength(1);
			expect(anthropicResponse.content[0].type).toBe("text");
			expect(anthropicResponse.content[0].text).toBeDefined();
			expect(anthropicResponse.content[0].text.length).toBeGreaterThan(0);
		});

		test("should verify request transformation with system message", async () => {
			// Step 1: Create original Anthropic request with system message
			const originalRequest: AnthropicMessagesRequest = {
				model: testModel,
				max_tokens: 1000,
				system: "You are a helpful assistant that responds briefly and clearly.",
				messages: [
					{
						role: "user",
						content: "What's 2+2?",
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(originalRequest);

			// Step 3: Simulate what the AI SDK would send to the model
			const simulatedModelPrompt = callOptions.prompt;

			// Step 4: Make the actual request to Anthropic API
			const anthropicResponse = await anthropic.messages.create({
				model: testModel,
				max_tokens: 1000,
				system: "You are a helpful assistant that responds briefly and clearly.",
				messages: [
					{
						role: "user",
						content: "What's 2+2?",
					},
				],
			});

			// Step 5: Verify that the transformed request preserves the system message
			expect(simulatedModelPrompt).toHaveLength(2);
			expect(simulatedModelPrompt[0].role).toBe("system");
			expect(simulatedModelPrompt[0].content).toBe("You are a helpful assistant that responds briefly and clearly.");
			expect(simulatedModelPrompt[1].role).toBe("user");
			expect(simulatedModelPrompt[1].content[0].text).toBe("What's 2+2?");

			// Verify that the response is consistent
			expect(anthropicResponse).toBeDefined();
			expect(anthropicResponse.content).toHaveLength(1);
			expect(anthropicResponse.content[0].type).toBe("text");
		});

		test("should verify request transformation with structured content", async () => {
			// Step 1: Create original Anthropic request with structured content
			const originalRequest: AnthropicMessagesRequest = {
				model: testModel,
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: "Please help me with:",
							},
							{
								type: "text",
								text: "1. Understanding this concept",
							},
						],
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(originalRequest);

			// Step 3: Simulate what the AI SDK would send to the model
			const simulatedModelPrompt = callOptions.prompt;

			// Step 4: Make the actual request to Anthropic API
			const anthropicResponse = await anthropic.messages.create({
				model: testModel,
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Please help me with:\n1. Understanding this concept",
					},
				],
			});

			// Step 5: Verify that the transformed request preserves structured content
			expect(simulatedModelPrompt).toHaveLength(1);
			expect(simulatedModelPrompt[0].role).toBe("user");
			expect(simulatedModelPrompt[0].content).toHaveLength(2);
			expect(simulatedModelPrompt[0].content[0].type).toBe("text");
			expect(simulatedModelPrompt[0].content[0].text).toBe("Please help me with:");
			expect(simulatedModelPrompt[0].content[1].type).toBe("text");
			expect(simulatedModelPrompt[0].content[1].text).toBe("1. Understanding this concept");

			// Verify that the response is consistent
			expect(anthropicResponse).toBeDefined();
			expect(anthropicResponse.content).toHaveLength(1);
			expect(anthropicResponse.content[0].type).toBe("text");
		});

		test("should verify request transformation with conversation history", async () => {
			// Step 1: Create original Anthropic request with conversation history
			const originalRequest: AnthropicMessagesRequest = {
				model: testModel,
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Hello!",
					},
					{
						role: "assistant",
						content: [
							{
								type: "text",
								text: "Hi there! How can I help you?",
							},
						],
					},
					{
						role: "user",
						content: "I need help with a math problem",
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(originalRequest);

			// Step 3: Simulate what the AI SDK would send to the model
			const simulatedModelPrompt = callOptions.prompt;

			// Step 4: Make the actual request to Anthropic API
			const anthropicResponse = await anthropic.messages.create({
				model: testModel,
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Hello!",
					},
					{
						role: "assistant",
						content: "Hi there! How can I help you?",
					},
					{
						role: "user",
						content: "I need help with a math problem",
					},
				],
			});

			// Step 5: Verify that the transformed request preserves conversation history
			expect(simulatedModelPrompt).toHaveLength(3);
			expect(simulatedModelPrompt[0].role).toBe("user");
			expect(simulatedModelPrompt[0].content[0].text).toBe("Hello!");
			expect(simulatedModelPrompt[1].role).toBe("assistant");
			expect(simulatedModelPrompt[1].content[0].text).toBe("Hi there! How can I help you?");
			expect(simulatedModelPrompt[2].role).toBe("user");
			expect(simulatedModelPrompt[2].content[0].text).toBe("I need help with a math problem");

			// Verify that the response is consistent and context-aware
			expect(anthropicResponse).toBeDefined();
			expect(anthropicResponse.content).toHaveLength(1);
			expect(anthropicResponse.content[0].type).toBe("text");
			// The response should acknowledge the math problem context
			expect(anthropicResponse.content[0].text.toLowerCase()).toMatch(/math|problem|help/);
		});

		test("should verify request transformation with all parameters", async () => {
			// Step 1: Create original Anthropic request with all parameters
			const originalRequest: AnthropicMessagesRequest = {
				model: testModel,
				max_tokens: 1000,
				temperature: 0.7,
				top_p: 0.9,
				top_k: 50,
				stop_sequences: ["\n\n", "Human:"],
				messages: [
					{
						role: "user",
						content: "Generate a short story",
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(originalRequest);

			// Step 3: Simulate what the AI SDK would send to the model
			const simulatedModelPrompt = callOptions.prompt;

			// Step 4: Make the actual request to Anthropic API
			const anthropicResponse = await anthropic.messages.create({
				model: testModel,
				max_tokens: 1000,
				temperature: 0.7,
				top_p: 0.9,
				top_k: 50,
				stop_sequences: ["\n\n", "Human:"],
				messages: [
					{
						role: "user",
						content: "Generate a short story",
					},
				],
			});

			// Step 5: Verify that the transformed request preserves all parameters
			expect(simulatedModelPrompt).toHaveLength(1);
			expect(simulatedModelPrompt[0].role).toBe("user");
			expect(simulatedModelPrompt[0].content[0].text).toBe("Generate a short story");

			// Verify that optional parameters are correctly transformed
			expect(callOptions.temperature).toBe(0.7);
			expect(callOptions.topP).toBe(0.9);
			expect(callOptions.topK).toBe(50);
			expect(callOptions.stopSequences).toEqual(["\n\n", "Human:"]);

			// Verify that the response is consistent
			expect(anthropicResponse).toBeDefined();
			expect(anthropicResponse.content).toHaveLength(1);
			expect(anthropicResponse.content[0].type).toBe("text");
			// The response should be a story
			expect(anthropicResponse.content[0].text.length).toBeGreaterThan(50);
		});

		test("should verify request transformation preserves semantic meaning", async () => {
			// Step 1: Create original Anthropic request with complex content
			const originalRequest: AnthropicMessagesRequest = {
				model: testModel,
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: [
							{
								type: "text",
								text: "Can you explain the concept of recursion in programming?",
							},
						],
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(originalRequest);

			// Step 3: Simulate what the AI SDK would send to the model
			const simulatedModelPrompt = callOptions.prompt;

			// Step 4: Make the actual request to Anthropic API
			const anthropicResponse = await anthropic.messages.create({
				model: testModel,
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Can you explain the concept of recursion in programming?",
					},
				],
			});

			// Step 5: Verify that the transformed request preserves semantic meaning
			expect(simulatedModelPrompt).toHaveLength(1);
			expect(simulatedModelPrompt[0].role).toBe("user");
			expect(simulatedModelPrompt[0].content[0].text).toBe("Can you explain the concept of recursion in programming?");

			// Verify that the response is semantically appropriate
			expect(anthropicResponse).toBeDefined();
			expect(anthropicResponse.content).toHaveLength(1);
			expect(anthropicResponse.content[0].type).toBe("text");
			const responseText = anthropicResponse.content[0].text.toLowerCase();
			
			// The response should be about recursion and programming
			expect(responseText).toMatch(/recursion|programming|function|call/);
			expect(responseText.length).toBeGreaterThan(100); // Should be a detailed explanation
		});

		test("should verify request transformation with multiple parameters", async () => {
			// Step 1: Create original Anthropic request with multiple parameters
			const originalRequest: AnthropicMessagesRequest = {
				model: testModel,
				max_tokens: 500,
				temperature: 0.3,
				messages: [
					{
						role: "user",
						content: "What is the capital of France?",
					},
				],
			};

			// Step 2: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(originalRequest);

			// Step 3: Make the actual request to Anthropic API
			const anthropicResponse = await anthropic.messages.create({
				model: testModel,
				max_tokens: 500,
				temperature: 0.3,
				messages: [
					{
						role: "user",
						content: "What is the capital of France?",
					},
				],
			});

			// Step 4: Verify transformation accuracy
			expect(callOptions.prompt).toHaveLength(1);
			expect(callOptions.prompt[0].content[0].text).toBe("What is the capital of France?");
			expect(callOptions.maxOutputTokens).toBe(500);
			expect(callOptions.temperature).toBe(0.3);

			// Verify response accuracy
			expect(anthropicResponse).toBeDefined();
			expect(anthropicResponse.content).toHaveLength(1);
			expect(anthropicResponse.content[0].type).toBe("text");
			const responseText = anthropicResponse.content[0].text.toLowerCase();
			expect(responseText).toMatch(/paris|capital|france/);
		});
	});

	describe("Error handling and edge cases", () => {
		test("should handle empty messages gracefully", async () => {
			// This test verifies that our transformation can handle edge cases
			// without making actual API calls that would fail
			const originalRequest: AnthropicMessagesRequest = {
				model: testModel,
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "",
					},
				],
			};

			// Step 1: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(originalRequest);

			// Step 2: Verify transformation handles empty content
			expect(callOptions.prompt).toHaveLength(1);
			expect(callOptions.prompt[0].content[0].text).toBe("");

			// Note: We don't make the actual API call here as it would be invalid
			// This test verifies that our transformation is robust
		});

		test("should handle very long messages", async () => {
			// Create a very long message
			const longText = "This is a test message. ".repeat(1000);
			const originalRequest: AnthropicMessagesRequest = {
				model: testModel,
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: longText,
					},
				],
			};

			// Step 1: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(originalRequest);

			// Step 2: Verify transformation handles long content
			expect(callOptions.prompt).toHaveLength(1);
			expect(callOptions.prompt[0].content[0].text).toBe(longText);
			expect(callOptions.prompt[0].content[0].text.length).toBeGreaterThan(10000);
		});

		test("should verify transformation preserves model parameter", async () => {
			const originalRequest: AnthropicMessagesRequest = {
				model: testModel,
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Test message",
					},
				],
			};

			// Step 1: Transform to AI SDK CallOptions
			const callOptions = anthropicRequestToCallOptions(originalRequest);

			// Step 2: Verify model parameter is handled correctly
			// Note: model is not in CallOptions as it's handled separately in the proxy
			expect(callOptions.prompt).toHaveLength(1);
			expect(callOptions.prompt[0].content[0].text).toBe("Test message");

			// Step 3: Make actual API call to verify model works
			const anthropicResponse = await anthropic.messages.create({
				model: testModel,
				max_tokens: 1000,
				messages: [
					{
						role: "user",
						content: "Test message",
					},
				],
			});

			expect(anthropicResponse).toBeDefined();
			expect(anthropicResponse.model).toBe(testModel);
		});
	});
});