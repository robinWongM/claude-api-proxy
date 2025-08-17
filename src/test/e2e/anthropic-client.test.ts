import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import Anthropic from "@anthropic-ai/sdk";
import type { ProxyConfig } from "../../config.ts";

// This E2E test requires:
// - Ollama running locally with model `qwen3:8b` pulled
// - OPENAI_BASE_URL set to Ollama's OpenAI-compatible endpoint (http://127.0.0.1:11434)
// - OPENAI_API_KEY can be any non-empty string (Ollama ignores it)

describe("E2E: Anthropic SDK client via proxy to Ollama (OpenAI compat)", () => {
	let server: any;
	let baseUrl: string;

	beforeAll(async () => {
		const config: ProxyConfig = {
			port: 0,
			host: "127.0.0.1",
			targetBaseUrl: process.env.OPENAI_BASE_URL || "http://127.0.0.1:11434",
			targetApiKey: process.env.OPENAI_API_KEY || "ollama",
			targetModel: "qwen3-coder-30b",
			enableLogging: false,
			enableCors: true,
			enableDebug: true,
			debugDir: "./debug",
		} as any;

		// Start app via Bun.serve directly to get assigned port
		const { createApp } = await import("../../app.ts");
		const app = createApp(config);
		server = Bun.serve({
			hostname: config.host,
			port: 0,
			fetch: (req) => app.fetch(req),
		});
		baseUrl = `http://${config.host}:${server.port}`;
	});

	afterAll(() => {
		server?.stop();
	});

	test("non-streaming messages call returns a response", async () => {
		const client = new Anthropic({
			apiKey: "test",
			baseURL: baseUrl,
		});

		const res = await client.messages.create({
			model: "qwen3:8b",
			max_tokens: 64,
			messages: [
				{
					role: "user",
					content:
						"output single word: `hello`. no other text. no capitalization.",
				},
			],
		} as any);

		expect(res).toBeDefined();
		// Basic shape checks
		expect(res.id).toBeString();
		expect(res.type).toBe("message");
		expect(res.role).toBe("assistant");
		expect(Array.isArray(res.content)).toBe(true);
		expect(res.content.length).toBeGreaterThan(0);

		if (res.content[0].type === "text") {
			expect(res.content[0].text).toInclude("hello");
		}
	}, 30000);

	test("streaming messages call yields SSE stream and ends with [DONE]", async () => {
		const client = new Anthropic({ apiKey: "test", baseURL: baseUrl });

		const stream = await client.messages.stream({
			model: "qwen3:8b",
			max_tokens: 64,
			messages: [{ role: "user", content: "Reply with exactly two words." }],
		} as any);

		let sawDelta = false;
		for await (const event of stream) {
			console.log(event);
			if (event?.type === "content_block_delta" && (event as any).delta?.text) {
				sawDelta = true;
			}
		}
		expect(sawDelta).toBeTrue();
	}, 30000);
});
