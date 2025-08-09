// Library exports for programmatic usage
export { convertAnthropicToOpenAI, convertOpenAIToAnthropic, convertAnthropicResponseToOpenAI, convertOpenAIResponseToAnthropic } from './converters/messages/index.ts';

export {
  convertAnthropicModelsToOpenAI,
  convertOpenAIModelsToAnthropic,
  createMockOpenAIModelsResponse,
  createMockAnthropicModelsResponse,
  getOpenAIModelName,
  getAnthropicModelName,
} from './converters/models.ts';

export { createAnthropicToOpenAIStreamTransformer, createOpenAIToAnthropicStreamTransformer, formatSSE, parseSSEData } from './converters/streaming.ts';

// Export Zod schemas and validation functions
export { AnthropicMessagesRequestSchema, AnthropicMessagesResponseSchema, AnthropicModelsResponseSchema } from './schemas/anthropic.ts';
export { OpenAIChatCompletionRequestSchema } from './schemas/openai.ts';
export { validateAnthropicMessagesRequest, validateOpenAIChatCompletionRequest, createValidationError } from './schemas/index.ts';

// Export types (both from schemas and additional types)
export type { AnthropicMessagesRequest, AnthropicMessagesResponse, AnthropicModelsResponse, AnthropicMessage, AnthropicContentBlock, AnthropicStreamEvent, AnthropicError, CacheControl, AnthropicTool, OpenAIChatCompletionRequest, OpenAIChatCompletionResponse, OpenAIModelsResponse, OpenAIMessage, OpenAIContentPart, OpenAIChoice, OpenAIStreamChoice, OpenAIStreamChunk } from './types.ts';

export { loadConfig, type ProxyConfig } from './config.ts';
export { startServer } from './server.ts';

// Import functions for use in this module
import {
  convertAnthropicToOpenAI, 
  convertOpenAIToAnthropic,
  convertAnthropicResponseToOpenAI,
  convertOpenAIResponseToAnthropic,
} from './converters/messages/index.ts';

import {
  convertAnthropicModelsToOpenAI,
  convertOpenAIModelsToAnthropic,
  createMockOpenAIModelsResponse,
  createMockAnthropicModelsResponse,
  getOpenAIModelName,
  getAnthropicModelName,
} from './converters/models.ts';

import {
  createAnthropicToOpenAIStreamTransformer,
  createOpenAIToAnthropicStreamTransformer,
  formatSSE,
  parseSSEData,
} from './converters/streaming.ts';

import type {
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
  AnthropicModelsResponse,
  OpenAIChatCompletionRequest,
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
 * Converts Anthropic messages API request to OpenAI chat completions format
 * 
 * @param anthropicRequest - The Anthropic messages request
 * @returns OpenAI chat completion request
 */
export function anthropicMessagesToOpenAI(anthropicRequest: AnthropicMessagesRequest): OpenAIChatCompletionRequest {
  return convertAnthropicToOpenAI(anthropicRequest);
}

/**
 * Converts OpenAI chat completions request to Anthropic messages format
 * 
 * @param openaiRequest - The OpenAI chat completion request
 * @returns Anthropic messages request
 */
export function openAIToAnthropicMessages(openaiRequest: OpenAIChatCompletionRequest): AnthropicMessagesRequest {
  return convertOpenAIToAnthropic(openaiRequest);
}

/**
 * Converts Anthropic messages response to OpenAI chat completions format
 * 
 * @param anthropicResponse - The Anthropic messages response
 * @param requestId - Optional request ID for tracking
 * @returns OpenAI chat completion response
 */
export function anthropicResponseToOpenAI(
  anthropicResponse: AnthropicMessagesResponse,
  requestId?: string
): OpenAIChatCompletionResponse {
  return convertAnthropicResponseToOpenAI(anthropicResponse, requestId);
}

/**
 * Converts OpenAI chat completions response to Anthropic messages format
 * 
 * @param openaiResponse - The OpenAI chat completion response
 * @returns Anthropic messages response
 */
export function openAIResponseToAnthropic(openaiResponse: OpenAIChatCompletionResponse): AnthropicMessagesResponse {
  return convertOpenAIResponseToAnthropic(openaiResponse);
}

/**
 * Converts Anthropic models list to OpenAI models format
 * 
 * @param anthropicModels - The Anthropic models response
 * @returns OpenAI models response
 */
export function anthropicModelsToOpenAI(anthropicModels: AnthropicModelsResponse): OpenAIModelsResponse {
  return convertAnthropicModelsToOpenAI(anthropicModels);
}

/**
 * Converts OpenAI models list to Anthropic models format
 * 
 * @param openaiModels - The OpenAI models response
 * @returns Anthropic models response
 */
export function openAIModelsToAnthropic(openaiModels: OpenAIModelsResponse): AnthropicModelsResponse {
  return convertOpenAIModelsToAnthropic(openaiModels);
}

/**
 * Creates a mock OpenAI models response with Anthropic models
 * 
 * @returns Mock OpenAI models response
 */
export function getMockOpenAIModels(): OpenAIModelsResponse {
  return createMockOpenAIModelsResponse();
}

/**
 * Creates a mock Anthropic models response
 * 
 * @returns Mock Anthropic models response
 */
export function getMockAnthropicModels(): AnthropicModelsResponse {
  return createMockAnthropicModelsResponse();
}

/**
 * Converts model names between Anthropic and OpenAI formats
 */
export const modelNameConverter = {
  anthropicToOpenAI: getOpenAIModelName,
  openAIToAnthropic: getAnthropicModelName,
};

/**
 * Streaming utilities for converting between formats
 */
export const streaming = {
  anthropicToOpenAI: createAnthropicToOpenAIStreamTransformer,
  openAIToAnthropic: createOpenAIToAnthropicStreamTransformer,
  formatSSE,
  parseSSEData,
};

/**
 * Utility functions
 */
export const utils = {
  generateRequestId,
};