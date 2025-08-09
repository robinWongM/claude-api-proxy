import { z } from 'zod';
import type { ProxyConfig } from '../../config.ts';
import { convertAnthropicToOpenAI, convertOpenAIResponseToAnthropic } from '../../converters/messages';
import { createOpenAIToAnthropicStreamTransformer } from '../../converters/streaming';
import type { OpenAIChatCompletionResponse } from '../../types.ts';
import { validateAnthropicMessagesRequest, createValidationError, type AnthropicMessagesRequest, type AnthropicMessagesResponse, type AnthropicError, type OpenAIChatCompletionRequest } from '../../schemas/index.ts';
import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';

// Removed unused generateRequestId

function buildTargetHeaders(request: Request, config: ProxyConfig, anthropicRequest: AnthropicMessagesRequest): Headers {
  const headers = new Headers();
  headers.set('Content-Type', 'application/json');

  // Prompt caching beta header only when cache_control present
  let hasCache = false;
  if (Array.isArray(anthropicRequest.system)) {
    hasCache = anthropicRequest.system.some(s => 'cache_control' in s && !!s.cache_control);
  }
  if (!hasCache) hasCache = anthropicRequest.messages.some(m => !!m.cache_control);
  if (!hasCache && anthropicRequest.tools) hasCache = anthropicRequest.tools.some(t => !!t.cache_control);
  if (hasCache) headers.set('anthropic-beta', 'prompt-caching-2024-07-31');

  if (config.targetApiKey) headers.set('Authorization', `Bearer ${config.targetApiKey}`);
  else {
    const auth = request.headers.get('authorization') || request.headers.get('x-api-key');
    if (auth) headers.set('Authorization', auth.startsWith('Bearer ') ? auth : `Bearer ${auth}`);
  }
  if (config.customHeaders) for (const [k, v] of Object.entries(config.customHeaders)) headers.set(k, v);
  return headers;
}

export async function handleMessagesProxy(request: Request, config: ProxyConfig, requestId?: string): Promise<Response> {
  let debugRequestId: string | null = null;

  try {
    const requestBody = await request.json();

    let anthropicRequest: AnthropicMessagesRequest;
    try {
      anthropicRequest = validateAnthropicMessagesRequest(requestBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = createValidationError(error);
        const response = new Response(JSON.stringify(validationError), { status: 400, headers: { 'Content-Type': 'application/json' } });
        return response;
      }
      throw error;
    }

    const openaiRequest: OpenAIChatCompletionRequest = convertAnthropicToOpenAI(anthropicRequest);
    
    // OpenAI debug: assign request id and dump request
    const ensureDir = async (dir?: string) => { const d = dir ?? config.debugDir; if (config.enableDebug) await mkdir(d, { recursive: true }).catch(() => {}); };
    if (config.enableDebug && requestId) {
      const dir = join(config.debugDir, requestId);
      await ensureDir(dir);
      await writeFile(join(dir, `openai-request.json`), JSON.stringify(openaiRequest, null, 2));
    }

    const targetUrl = `${config.targetBaseUrl}/v1/chat/completions`;
    const targetHeaders = buildTargetHeaders(request, config, anthropicRequest);
    const targetResponse = await fetch(targetUrl, { method: 'POST', headers: targetHeaders, body: JSON.stringify(openaiRequest) });

    // Streaming path
    if (openaiRequest.stream && targetResponse.body) {
      // Tee raw OpenAI SSE into a debug file and transform the other branch to Anthropic SSE
      const [forTransform, forDump] = targetResponse.body.tee();
      const transformer = createOpenAIToAnthropicStreamTransformer();
      const anthropicStream = forTransform.pipeThrough(transformer);

      if (config.enableDebug && requestId) {
        const decoder = new TextDecoder();
        let collected = '';
        (async () => {
          try {
            const reader = forDump.getReader();
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              if (value) collected += decoder.decode(value);
            }
          } finally {
            const dir = join(config.debugDir, requestId);
            await ensureDir(dir);
            await writeFile(join(dir, `openai-stream.txt`), collected).catch(() => {});
          }
        })();
      }

      const streamHeaders = new Headers({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      return new Response(anthropicStream, { status: 200, headers: streamHeaders });
    }

    if (!targetResponse.ok) {
      const errorBody = await targetResponse.text();
      return new Response(errorBody, { status: targetResponse.status, statusText: targetResponse.statusText, headers: { 'Content-Type': 'application/json' } });
    }

    const openaiResponse = await targetResponse.json() as OpenAIChatCompletionResponse;
    if (config.enableDebug && debugRequestId) {
      const dir = join(config.debugDir, debugRequestId);
      await ensureDir(dir);
      await writeFile(join(dir, `openai-response.json`), JSON.stringify(openaiResponse, null, 2));
    }

    const anthropicResponse: AnthropicMessagesResponse = convertOpenAIResponseToAnthropic(openaiResponse);

    return new Response(JSON.stringify(anthropicResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    if (config.enableDebug && debugRequestId) {
      const dir = join(config.debugDir, debugRequestId);
      await mkdir(dir, { recursive: true }).catch(() => {});
      await writeFile(join(dir, `error.json`), JSON.stringify({ context: 'messages_proxy_error', error: error instanceof Error ? { name: error.name, message: error.message, stack: error.stack } : String(error) }, null, 2)).catch(() => {});
    }
    const errorResponse: AnthropicError = { type: 'error', error: { type: 'api_error', message: error instanceof Error ? error.message : 'Internal server error' } };
    return new Response(JSON.stringify(errorResponse), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}


