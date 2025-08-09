import { z } from 'zod';
import type { ProxyConfig } from '../../config.ts';
import { DebugLogger } from '../../debug.ts';
import { convertAnthropicToOpenAI, convertOpenAIResponseToAnthropic } from '../../converters/messages.ts';
import { createOpenAIToAnthropicStreamTransformer } from '../../converters/streaming.ts';
import { validateAnthropicMessagesRequest, createValidationError, type AnthropicMessagesRequest, type AnthropicMessagesResponse, type AnthropicError, type OpenAIChatCompletionRequest } from '../../schemas.ts';

function generateRequestId(): string {
  return `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

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

export async function handleMessagesProxy(request: Request, config: ProxyConfig): Promise<Response> {
  const debugLogger = new DebugLogger(config);
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

    debugRequestId = await debugLogger.dumpAnthropicRequest(anthropicRequest);

    const openaiRequest: OpenAIChatCompletionRequest = convertAnthropicToOpenAI(anthropicRequest);
    if (debugRequestId) await debugLogger.dumpOpenAIRequest(openaiRequest, debugRequestId);

    const targetUrl = `${config.targetBaseUrl}/v1/chat/completions`;
    const targetHeaders = buildTargetHeaders(request, config, anthropicRequest);
    const targetResponse = await fetch(targetUrl, { method: 'POST', headers: targetHeaders, body: JSON.stringify(openaiRequest) });

    // Streaming path
    if (openaiRequest.stream && targetResponse.body) {
      const transformer = createOpenAIToAnthropicStreamTransformer();
      const anthropicStream = targetResponse.body.pipeThrough(transformer);
      const streamHeaders = new Headers({ 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache', Connection: 'keep-alive' });
      return new Response(anthropicStream, { status: 200, headers: streamHeaders });
    }

    if (!targetResponse.ok) {
      const errorBody = await targetResponse.text();
      return new Response(errorBody, { status: targetResponse.status, statusText: targetResponse.statusText, headers: { 'Content-Type': 'application/json' } });
    }

    const openaiResponse = await targetResponse.json();
    if (debugRequestId) await debugLogger.dumpOpenAIResponse(openaiResponse, debugRequestId);

    const anthropicResponse: AnthropicMessagesResponse = convertOpenAIResponseToAnthropic(openaiResponse);
    if (debugRequestId) await debugLogger.dumpAnthropicResponse(anthropicResponse, debugRequestId);

    return new Response(JSON.stringify(anthropicResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    if (debugRequestId) await debugLogger.dumpError(error, debugRequestId, 'messages_proxy_error');
    const errorResponse: AnthropicError = { type: 'error', error: { type: 'api_error', message: error instanceof Error ? error.message : 'Internal server error' } };
    return new Response(JSON.stringify(errorResponse), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}


