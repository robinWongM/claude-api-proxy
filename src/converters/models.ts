import type { AnthropicModel, AnthropicModelsResponse } from '../schemas/index.ts';
import type { OpenAIModel, OpenAIModelsResponse } from '../types.ts';

/**
 * Maps Anthropic model names to OpenAI-compatible model names
 */
const MODEL_NAME_MAPPING: Record<string, string> = {
  'claude-3-5-sonnet-20241022': 'claude-3.5-sonnet',
  'claude-3-5-sonnet-20240620': 'claude-3.5-sonnet',
  'claude-3-5-haiku-20241022': 'claude-3.5-haiku',
  'claude-3-opus-20240229': 'claude-3-opus',
  'claude-3-sonnet-20240229': 'claude-3-sonnet',
  'claude-3-haiku-20240307': 'claude-3-haiku',
  'claude-2.1': 'claude-2.1',
  'claude-2.0': 'claude-2.0',
  'claude-instant-1.2': 'claude-instant-1.2',
};

/**
 * Default Anthropic model versions for reverse mapping
 */
const DEFAULT_ANTHROPIC_VERSIONS: Record<string, string> = {
  'claude-3.5-sonnet': 'claude-3-5-sonnet-20241022',
  'claude-3.5-haiku': 'claude-3-5-haiku-20241022',
  'claude-3-opus': 'claude-3-opus-20240229',
  'claude-3-sonnet': 'claude-3-sonnet-20240229',
  'claude-3-haiku': 'claude-3-haiku-20240307',
  'claude-2.1': 'claude-2.1',
  'claude-2.0': 'claude-2.0',
  'claude-instant-1.2': 'claude-instant-1.2',
};

/**
 * Reverse mapping for OpenAI to Anthropic model names (uses default versions)
 */
const REVERSE_MODEL_NAME_MAPPING: Record<string, string> = DEFAULT_ANTHROPIC_VERSIONS;

/**
 * Gets the OpenAI-compatible model name for an Anthropic model
 */
export function getOpenAIModelName(anthropicModelName: string): string {
  return MODEL_NAME_MAPPING[anthropicModelName] || anthropicModelName;
}

/**
 * Gets the Anthropic model name for an OpenAI-compatible model name
 */
export function getAnthropicModelName(openaiModelName: string): string {
  return REVERSE_MODEL_NAME_MAPPING[openaiModelName] || openaiModelName;
}

/**
 * Converts an Anthropic model to OpenAI model format
 */
export function convertAnthropicModelToOpenAI(anthropicModel: AnthropicModel): OpenAIModel {
  return {
    id: getOpenAIModelName(anthropicModel.id),
    object: 'model',
    created: Math.floor(new Date(anthropicModel.created_at).getTime() / 1000),
    owned_by: 'anthropic',
  };
}

/**
 * Converts an OpenAI model to Anthropic model format
 */
export function convertOpenAIModelToAnthropic(openaiModel: OpenAIModel): AnthropicModel {
  return {
    id: getAnthropicModelName(openaiModel.id),
    type: 'model',
    display_name: openaiModel.id,
    created_at: new Date(openaiModel.created * 1000).toISOString(),
  };
}

/**
 * Converts an Anthropic models list response to OpenAI models format
 */
export function convertAnthropicModelsToOpenAI(anthropicResponse: AnthropicModelsResponse): OpenAIModelsResponse {
  return {
    object: 'list',
    data: anthropicResponse.data.map(convertAnthropicModelToOpenAI),
  };
}

/**
 * Converts an OpenAI models list response to Anthropic models format
 */
export function convertOpenAIModelsToAnthropic(openaiResponse: OpenAIModelsResponse): AnthropicModelsResponse {
  return {
    data: openaiResponse.data.map(convertOpenAIModelToAnthropic),
    has_more: false,
  };
}

/**
 * Creates a mock Anthropic models response with common models
 * This can be used when the actual Anthropic models API is not available
 */
export function createMockAnthropicModelsResponse(): AnthropicModelsResponse {
  const currentTime = new Date().toISOString();
  
  return {
    data: [
      {
        id: 'claude-3-5-sonnet-20241022',
        type: 'model',
        display_name: 'Claude 3.5 Sonnet',
        created_at: currentTime,
      },
      {
        id: 'claude-3-5-haiku-20241022',
        type: 'model',
        display_name: 'Claude 3.5 Haiku',
        created_at: currentTime,
      },
      {
        id: 'claude-3-opus-20240229',
        type: 'model',
        display_name: 'Claude 3 Opus',
        created_at: currentTime,
      },
      {
        id: 'claude-3-sonnet-20240229',
        type: 'model',
        display_name: 'Claude 3 Sonnet',
        created_at: currentTime,
      },
      {
        id: 'claude-3-haiku-20240307',
        type: 'model',
        display_name: 'Claude 3 Haiku',
        created_at: currentTime,
      },
    ],
    has_more: false,
  };
}

/**
 * Creates a mock OpenAI models response with Anthropic models converted to OpenAI format
 */
export function createMockOpenAIModelsResponse(): OpenAIModelsResponse {
  const mockAnthropicResponse = createMockAnthropicModelsResponse();
  return convertAnthropicModelsToOpenAI(mockAnthropicResponse);
}
