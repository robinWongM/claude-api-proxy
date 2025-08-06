import { z } from 'zod';
import type { ProxyConfig } from './config.ts';
import { DebugLogger } from './debug.ts';
import {
  convertAnthropicToOpenAI,
  convertOpenAIResponseToAnthropic,
} from './converters/messages.ts';
import {
  convertOpenAIModelsToAnthropic,
  createMockOpenAIModelsResponse,
} from './converters/models.ts';
import {
  createOpenAIToAnthropicStreamTransformer,
  formatSSE,
} from './converters/streaming.ts';
import {
  validateAnthropicMessagesRequest,
  createValidationError,
  type AnthropicMessagesRequest,
  type AnthropicMessagesResponse,
  type AnthropicModelsResponse,
  type OpenAIChatCompletionRequest,
  type AnthropicError,
  type CacheControl,
} from './schemas.ts';
import type {
  OpenAIChatCompletionResponse,
  OpenAIModelsResponse,
} from './types.ts';

/**
 * Generates a unique request ID for tracking
 */
function generateRequestId(): string {
  return `chatcmpl-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Logs request/response for debugging
 */
function log(message: string, data?: any) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
  if (data) {
    console.log(JSON.stringify(data, null, 2));
  }
}

/**
 * Handles CORS headers
 */
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version, x-api-key');
  headers.set('Access-Control-Max-Age', '86400');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

/**
 * Processes cache control directives and adds appropriate headers
 */
function processCacheControl(request: AnthropicMessagesRequest, headers: Headers): void {
  let hasCacheControl = false;
  
  // Check for cache control in system messages
  if (Array.isArray(request.system)) {
    for (const systemBlock of request.system) {
      if (systemBlock.cache_control) {
        hasCacheControl = true;
        break;
      }
    }
  }
  
  // Check for cache control in messages
  if (!hasCacheControl) {
    for (const message of request.messages) {
      if (message.cache_control) {
        hasCacheControl = true;
        break;
      }
    }
  }
  
  // Check for cache control in tools
  if (!hasCacheControl && request.tools) {
    for (const tool of request.tools) {
      if (tool.cache_control) {
        hasCacheControl = true;
        break;
      }
    }
  }
  
  // Add cache control headers if present
  if (hasCacheControl) {
    headers.set('anthropic-beta', 'prompt-caching-2024-07-31');
  }
}

/**
 * Proxy handler for Anthropic messages API to OpenAI chat completions
 */
export async function handleMessagesProxy(
  request: Request,
  config: ProxyConfig
): Promise<Response> {
  const debugLogger = new DebugLogger(config);
  let debugRequestId: string | null = null;

  try {
    const requestId = generateRequestId();
    
    if (config.enableLogging) {
      log('Incoming Anthropic messages request', {
        method: request.method,
        url: request.url,
        headers: Object.fromEntries(request.headers.entries()),
      });
    }

    // Parse and validate the Anthropic request
    const requestBody = await request.json();
    
    let anthropicRequest: AnthropicMessagesRequest;
    try {
      anthropicRequest = validateAnthropicMessagesRequest(requestBody);
    } catch (error) {
      if (error instanceof z.ZodError) {
        const validationError = createValidationError(error);
        if (config.enableLogging) {
          log('Request validation failed', { error: validationError, originalRequest: requestBody });
        }
        
        // Debug dump validation error
        if (debugRequestId) {
          await debugLogger.dumpError(error, debugRequestId, 'validation_failed');
        }
        
        const response = new Response(JSON.stringify(validationError), {
          status: 400,
          headers: { 'Content-Type': 'application/json' },
        });
        return config.enableCors ? addCorsHeaders(response) : response;
      }
      throw error;
    }
    
    // Debug dump original Anthropic request
    debugRequestId = await debugLogger.dumpAnthropicRequest(anthropicRequest);
    
    if (config.enableLogging) {
      log('Parsed and validated Anthropic request', anthropicRequest);
    }

    // Convert to OpenAI format
    const openaiRequest: OpenAIChatCompletionRequest = convertAnthropicToOpenAI(anthropicRequest);
    
    // Debug dump converted OpenAI request
    if (debugRequestId) {
      await debugLogger.dumpOpenAIRequest(openaiRequest, debugRequestId);
    }
    
    if (config.enableLogging) {
      log('Converted to OpenAI request', openaiRequest);
    }

    // Prepare headers for target request
    const targetHeaders = new Headers();
    targetHeaders.set('Content-Type', 'application/json');
    
    // Process cache control directives
    processCacheControl(anthropicRequest, targetHeaders);
    
    if (config.targetApiKey) {
      targetHeaders.set('Authorization', `Bearer ${config.targetApiKey}`);
    } else {
      // Forward the authorization header from the original request
      const authHeader = request.headers.get('authorization') || request.headers.get('x-api-key');
      if (authHeader) {
        targetHeaders.set('Authorization', authHeader.startsWith('Bearer ') ? authHeader : `Bearer ${authHeader}`);
      }
    }

    // Add custom headers
    if (config.customHeaders) {
      for (const [key, value] of Object.entries(config.customHeaders)) {
        targetHeaders.set(key, value);
      }
    }

    // Make request to target OpenAI-compatible API
    const targetUrl = `${config.targetBaseUrl}/v1/chat/completions`;
    const targetResponse = await fetch(targetUrl, {
      method: 'POST',
      headers: targetHeaders,
      body: JSON.stringify(openaiRequest),
    });

    if (config.enableLogging) {
      log('Target API response status', { status: targetResponse.status, statusText: targetResponse.statusText });
    }

    // Handle streaming response
    if (openaiRequest.stream && targetResponse.body) {
      // Note: Debug dumping for streaming responses is not implemented yet
      // as it would require intercepting and buffering the stream chunks
      if (config.enableLogging && debugRequestId) {
        log(`[DEBUG] Streaming response started for request: ${debugRequestId}`);
      }
      
      const transformer = createOpenAIToAnthropicStreamTransformer();
      
      // Create streaming response with proper headers
      const streamHeaders = new Headers();
      streamHeaders.set('Content-Type', 'text/event-stream');
      streamHeaders.set('Cache-Control', 'no-cache');
      streamHeaders.set('Connection', 'keep-alive');
      
      // Use the transformer to convert OpenAI stream to Anthropic format
      const anthropicStream = targetResponse.body.pipeThrough(transformer);
      
      const response = new Response(anthropicStream, {
        status: 200,
        headers: streamHeaders,
      });
      
      return config.enableCors ? addCorsHeaders(response) : response;
    }

    // Handle non-streaming response
    if (!targetResponse.ok) {
      // Forward error response as-is
      const errorBody = await targetResponse.text();
      const response = new Response(errorBody, {
        status: targetResponse.status,
        statusText: targetResponse.statusText,
        headers: { 'Content-Type': 'application/json' },
      });
      return config.enableCors ? addCorsHeaders(response) : response;
    }

    const openaiResponse = await targetResponse.json() as OpenAIChatCompletionResponse;
    
    // Debug dump OpenAI response
    if (debugRequestId) {
      await debugLogger.dumpOpenAIResponse(openaiResponse, debugRequestId);
    }
    
    if (config.enableLogging) {
      log('Target API response', openaiResponse);
    }

    // Convert back to Anthropic format
    const anthropicResponse: AnthropicMessagesResponse = convertOpenAIResponseToAnthropic(openaiResponse);
    
    // Debug dump converted Anthropic response
    if (debugRequestId) {
      await debugLogger.dumpAnthropicResponse(anthropicResponse, debugRequestId);
    }
    
    if (config.enableLogging) {
      log('Converted to Anthropic response', anthropicResponse);
    }

    const response = new Response(JSON.stringify(anthropicResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    return config.enableCors ? addCorsHeaders(response) : response;
  } catch (error) {
    // Debug dump error
    if (debugRequestId) {
      await debugLogger.dumpError(error, debugRequestId, 'messages_proxy_error');
    }

    if (config.enableLogging) {
      log('Error in messages proxy', error);
    }

    const errorResponse: AnthropicError = {
      type: 'error',
      error: {
        type: 'api_error',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    };

    const response = new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });

    return config.enableCors ? addCorsHeaders(response) : response;
  }
}

/**
 * Proxy handler for Anthropic models API to OpenAI models
 */
export async function handleModelsProxy(
  request: Request,
  config: ProxyConfig
): Promise<Response> {
  try {
    if (config.enableLogging) {
      log('Incoming Anthropic models request', {
        method: request.method,
        url: request.url,
      });
    }

    // Prepare headers for target request
    const targetHeaders = new Headers();
    
    if (config.targetApiKey) {
      targetHeaders.set('Authorization', `Bearer ${config.targetApiKey}`);
    } else {
      // Forward the authorization header from the original request
      const authHeader = request.headers.get('authorization') || request.headers.get('x-api-key');
      if (authHeader) {
        targetHeaders.set('Authorization', authHeader.startsWith('Bearer ') ? authHeader : `Bearer ${authHeader}`);
      }
    }

    // Add custom headers
    if (config.customHeaders) {
      for (const [key, value] of Object.entries(config.customHeaders)) {
        targetHeaders.set(key, value);
      }
    }

    // Make request to target OpenAI-compatible API
    const targetUrl = `${config.targetBaseUrl}/v1/models`;
    const targetResponse = await fetch(targetUrl, {
      method: 'GET',
      headers: targetHeaders,
    });

    if (config.enableLogging) {
      log('Target API response status', { status: targetResponse.status, statusText: targetResponse.statusText });
    }

    let anthropicResponse: AnthropicModelsResponse;

    if (targetResponse.ok) {
      const openaiResponse = await targetResponse.json() as OpenAIModelsResponse;
      
      if (config.enableLogging) {
        log('Target API response', openaiResponse);
      }

      // Convert to Anthropic format
      anthropicResponse = convertOpenAIModelsToAnthropic(openaiResponse);
    } else {
      // If target API fails, return mock models
      if (config.enableLogging) {
        log('Target API failed, returning mock models');
      }
      
      const mockOpenAIResponse = createMockOpenAIModelsResponse();
      anthropicResponse = convertOpenAIModelsToAnthropic(mockOpenAIResponse);
    }

    if (config.enableLogging) {
      log('Converted to Anthropic response', anthropicResponse);
    }

    const response = new Response(JSON.stringify(anthropicResponse), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

    return config.enableCors ? addCorsHeaders(response) : response;
  } catch (error) {
    if (config.enableLogging) {
      log('Error in models proxy', error);
    }

    const errorResponse: AnthropicError = {
      type: 'error',
      error: {
        type: 'api_error',
        message: error instanceof Error ? error.message : 'Internal server error',
      },
    };

    const response = new Response(JSON.stringify(errorResponse), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });

    return config.enableCors ? addCorsHeaders(response) : response;
  }
}

/**
 * Handle OPTIONS requests for CORS
 */
export function handleOptions(): Response {
  const headers = new Headers();
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version, x-api-key');
  headers.set('Access-Control-Max-Age', '86400');
  
  return new Response(null, {
    status: 204,
    headers,
  });
}
