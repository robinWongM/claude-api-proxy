import { createWriteStream } from "node:fs";
import { mkdir, open, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { LanguageModelV2StreamPart } from "@ai-sdk/provider";
import type { ProxyConfig } from "../config.ts";

export interface DebugContext {
	requestId: string;
	config: ProxyConfig;
}

function checkDebugEnabled(config: ProxyConfig): boolean {
	return config.enableDebug;
}

async function getDebugFilePath(
	requestId: string,
	config: ProxyConfig,
	fileName: string,
): Promise<string> {
	const debugDir = await createDebugDirectory(requestId, config);
	return join(debugDir, fileName);
}

async function safeWriteFile(
	filePath: string,
	content: string | (() => Promise<string>),
	errorContext: string,
): Promise<void> {
	try {
		const fileContent = typeof content === 'string' ? content : await content();
		await writeFile(filePath, fileContent);
	} catch (error) {
		console.error(`Failed to ${errorContext} to: ${filePath}`, error);
	}
}

function createStreamTransform(
	filePath: string,
	chunkProcessor: (chunk: unknown) => string | Promise<string>,
): TransformStream {
	const fileHandle = createWriteStream(filePath);

	const transformStream = new TransformStream({
		async transform(chunk, controller) {
			const processedChunk = await chunkProcessor(chunk);
			fileHandle.write(processedChunk);
			controller.enqueue(chunk);
		},
		async flush() {
			fileHandle.end();
		},
	});

	return transformStream;
}

function createClonedResponse(
	originalResponse: Response,
	transformedStream: TransformStream,
): Response {
	return new Response(originalResponse.body?.pipeThrough(transformedStream), {
		status: originalResponse.status,
		statusText: originalResponse.statusText,
		headers: originalResponse.headers,
	});
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
	if (!checkDebugEnabled(config)) return;

	const filePath = await getDebugFilePath(requestId, config, "request.json");
	await safeWriteFile(filePath, JSON.stringify(request, null, 2), "dump request");
}

export async function dumpAiSdkCallOptions(
	callOptions: unknown,
	requestId: string,
	config: ProxyConfig,
): Promise<void> {
	if (!checkDebugEnabled(config)) return;

	const filePath = await getDebugFilePath(requestId, config, "ai-sdk-call-options.json");
	await safeWriteFile(filePath, JSON.stringify(callOptions, null, 2), "dump callOptions");
}

export async function dumpProviderRequest(
	request: Request,
	requestId: string,
	config: ProxyConfig,
): Promise<void> {
	if (!checkDebugEnabled(config)) return;

	const filePath = await getDebugFilePath(requestId, config, "provider-request.json");
	await safeWriteFile(filePath, () => request.clone().text(), "dump provider request");
}

export async function dumpProviderResponse(
	response: Response,
	requestId: string,
	config: ProxyConfig,
): Promise<Response> {
	if (!checkDebugEnabled(config)) return response;
	if (!response.body) return response;

	const filePath = await getDebugFilePath(requestId, config, "provider-response.txt");

	try {
		const transformStream = createStreamTransform(
			filePath,
			(chunk) => chunk,
		);
		return createClonedResponse(response, transformStream);
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
	if (!checkDebugEnabled(config)) return stream;

	const filePath = await getDebugFilePath(requestId, config, "ai-sdk-stream-part.txt");

	try {
		const transformStream = createStreamTransform(
			filePath,
			(chunk) => `${JSON.stringify(chunk)}\n`,
		);
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
	if (!checkDebugEnabled(config)) return response;
	if (!response.body) return response;

	const filePath = await getDebugFilePath(requestId, config, "response.txt");

	try {
		const transformStream = createStreamTransform(
			filePath,
			(chunk) => chunk,
		);
		return createClonedResponse(response, transformStream);
	} catch (error) {
		console.error(`Failed to setup stream dumping to: ${filePath}`, error);
		return response;
	}
}
