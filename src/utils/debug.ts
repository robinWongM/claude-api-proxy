import { createWriteStream } from "node:fs";
import { mkdir, open, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LanguageModelV2StreamPart } from "@ai-sdk/provider";
import type { ProxyConfig } from "../config.ts";

export interface DebugContext {
	requestId: string;
	config: ProxyConfig;
}

export async function createDebugDirectory(
	requestId: string,
	config: ProxyConfig,
): Promise<string> {
	const debugDir = join(config.debugDir, requestId);

	// Ensure debug directory exists
	try {
		await mkdir(debugDir, { recursive: true });
	} catch (error) {
		console.error(`Failed to create debug directory: ${debugDir}`, error);
	}

	return debugDir;
}

export async function dumpRequest(
	request: unknown,
	requestId: string,
	config: ProxyConfig,
): Promise<void> {
	if (!config.enableDebug) return;

	const debugDir = await createDebugDirectory(requestId, config);
	const filePath = join(debugDir, "request.json");

	try {
		await writeFile(filePath, JSON.stringify(request, null, 2));
	} catch (error) {
		console.error(`Failed to dump request to: ${filePath}`, error);
	}
}

export async function dumpAiSdkCallOptions(
	callOptions: unknown,
	requestId: string,
	config: ProxyConfig,
): Promise<void> {
	if (!config.enableDebug) return;

	const debugDir = await createDebugDirectory(requestId, config);
	const filePath = join(debugDir, "ai-sdk-call-options.json");

	try {
		await writeFile(filePath, JSON.stringify(callOptions, null, 2));
	} catch (error) {
		console.error(`Failed to dump callOptions to: ${filePath}`, error);
	}
}

export async function dumpProviderRequest(
	request: Request,
	requestId: string,
	config: ProxyConfig,
): Promise<void> {
	if (!config.enableDebug) return;

	const debugDir = await createDebugDirectory(requestId, config);
	const filePath = join(debugDir, "provider-request.json");

	try {
		await writeFile(filePath, await request.clone().text());
	} catch (error) {
		console.error(`Failed to dump provider request to: ${filePath}`, error);
	}
}

export async function dumpProviderResponse(
	response: Response,
	requestId: string,
	config: ProxyConfig,
): Promise<Response> {
	if (!config.enableDebug) return response;

	if (!response.body) {
		return response;
	}

	const debugDir = await createDebugDirectory(requestId, config);
	const filePath = join(debugDir, "provider-response.txt");
	const stream = response.body;

	try {
		// Create a file writer stream
		const fileHandle = createWriteStream(filePath);

		// Clone the stream by creating a transform stream
		const transformStream = new TransformStream({
			async transform(chunk, controller) {
				fileHandle.write(chunk);
				// Forward chunk to original consumer
				controller.enqueue(chunk);
			},
			async flush() {
				fileHandle.end();
			},
		});

		// Return the cloned stream
		return new Response(stream.pipeThrough(transformStream), {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	} catch (error) {
		console.error(`Failed to setup stream dumping to: ${filePath}`, error);
		return response;
	}
}

export async function dumpAiSdkStreamPart(
	stream: ReadableStream<LanguageModelV2StreamPart>,
	requestId: string,
	config: ProxyConfig,
): Promise<ReadableStream> {
	if (!config.enableDebug) return stream;

	const debugDir = await createDebugDirectory(requestId, config);
	const filePath = join(debugDir, "ai-sdk-stream-part.txt");

	try {
		// Create a file writer stream
		const fileHandle = createWriteStream(filePath);

		// Clone the stream by creating a transform stream
		const transformStream = new TransformStream({
			async transform(chunk, controller) {
				fileHandle.write(`${JSON.stringify(chunk)}\n`);
				// Forward chunk to original consumer
				controller.enqueue(chunk);
			},
			async flush() {
				fileHandle.end();
			},
		});

		// Return the cloned stream
		return stream.pipeThrough(transformStream);
	} catch (error) {
		console.error(`Failed to setup stream dumping to: ${filePath}`, error);
		return stream;
	}
}

export async function dumpResponse(
	response: Response,
	requestId: string,
	config: ProxyConfig,
): Promise<Response> {
	if (!config.enableDebug) return response;

	if (!response.body) {
		return response;
	}

	const debugDir = await createDebugDirectory(requestId, config);
	const filePath = join(debugDir, "response.txt");
	const stream = response.body;

	try {
		// Create a file writer stream
		const fileHandle = await open(filePath, "w");

		// Clone the stream by creating a transform stream
		const transformStream = new TransformStream({
			async transform(chunk, controller) {
				await fileHandle.write(chunk);
				// Forward chunk to original consumer
				controller.enqueue(chunk);
			},
			async flush() {
				await fileHandle.close();
			},
		});

		// Return the cloned stream
		return new Response(stream.pipeThrough(transformStream), {
			status: response.status,
			statusText: response.statusText,
			headers: response.headers,
		});
	} catch (error) {
		console.error(`Failed to setup stream dumping to: ${filePath}`, error);
		return response;
	}
}
