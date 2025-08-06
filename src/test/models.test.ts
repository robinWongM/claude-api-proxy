import { expect, test, describe } from 'bun:test';
import {
  convertAnthropicModelToOpenAI,
  convertOpenAIModelToAnthropic,
  convertAnthropicModelsToOpenAI,
  convertOpenAIModelsToAnthropic,
  getOpenAIModelName,
  getAnthropicModelName,
  createMockAnthropicModelsResponse,
  createMockOpenAIModelsResponse,
} from '../converters/models.ts';

import type {
  AnthropicModel,
  AnthropicModelsResponse,
  OpenAIModel,
  OpenAIModelsResponse,
} from '../types.ts';

describe('Models Converter', () => {
  describe('getOpenAIModelName', () => {
    test('should convert known Anthropic model names to OpenAI format', () => {
      expect(getOpenAIModelName('claude-3-5-sonnet-20241022')).toBe('claude-3.5-sonnet');
      expect(getOpenAIModelName('claude-3-5-haiku-20241022')).toBe('claude-3.5-haiku');
      expect(getOpenAIModelName('claude-3-opus-20240229')).toBe('claude-3-opus');
    });

    test('should return original name for unknown models', () => {
      expect(getOpenAIModelName('unknown-model')).toBe('unknown-model');
    });
  });

  describe('getAnthropicModelName', () => {
    test('should convert known OpenAI model names to Anthropic format', () => {
      expect(getAnthropicModelName('claude-3.5-sonnet')).toBe('claude-3-5-sonnet-20241022');
      expect(getAnthropicModelName('claude-3.5-haiku')).toBe('claude-3-5-haiku-20241022');
      expect(getAnthropicModelName('claude-3-opus')).toBe('claude-3-opus-20240229');
    });

    test('should return original name for unknown models', () => {
      expect(getAnthropicModelName('unknown-model')).toBe('unknown-model');
    });
  });

  describe('convertAnthropicModelToOpenAI', () => {
    test('should convert Anthropic model to OpenAI format', () => {
      const anthropicModel: AnthropicModel = {
        id: 'claude-3-5-sonnet-20241022',
        type: 'model',
        display_name: 'Claude 3.5 Sonnet',
        created_at: '2024-10-22T00:00:00Z',
      };

      const result = convertAnthropicModelToOpenAI(anthropicModel);

      expect(result).toEqual({
        id: 'claude-3.5-sonnet',
        object: 'model',
        created: 1729555200,
        owned_by: 'anthropic',
      });
    });

    test('should handle unknown model names', () => {
      const anthropicModel: AnthropicModel = {
        id: 'unknown-model',
        type: 'model',
        display_name: 'Unknown Model',
        created_at: '2024-01-01T00:00:00Z',
      };

      const result = convertAnthropicModelToOpenAI(anthropicModel);

      expect(result.id).toBe('unknown-model');
      expect(result.owned_by).toBe('anthropic');
    });
  });

  describe('convertOpenAIModelToAnthropic', () => {
    test('should convert OpenAI model to Anthropic format', () => {
      const openaiModel: OpenAIModel = {
        id: 'claude-3.5-sonnet',
        object: 'model',
        created: 1729555200,
        owned_by: 'anthropic',
      };

      const result = convertOpenAIModelToAnthropic(openaiModel);

      expect(result).toEqual({
        id: 'claude-3-5-sonnet-20241022',
        type: 'model',
        display_name: 'claude-3.5-sonnet',
        created_at: '2024-10-22T00:00:00.000Z',
      });
    });

    test('should handle unknown model names', () => {
      const openaiModel: OpenAIModel = {
        id: 'unknown-model',
        object: 'model',
        created: 1704067200,
        owned_by: 'openai',
      };

      const result = convertOpenAIModelToAnthropic(openaiModel);

      expect(result.id).toBe('unknown-model');
      expect(result.display_name).toBe('unknown-model');
    });
  });

  describe('convertAnthropicModelsToOpenAI', () => {
    test('should convert Anthropic models list to OpenAI format', () => {
      const anthropicResponse: AnthropicModelsResponse = {
        data: [
          {
            id: 'claude-3-5-sonnet-20241022',
            type: 'model',
            display_name: 'Claude 3.5 Sonnet',
            created_at: '2024-10-22T00:00:00Z',
          },
          {
            id: 'claude-3-5-haiku-20241022',
            type: 'model',
            display_name: 'Claude 3.5 Haiku',
            created_at: '2024-10-22T00:00:00Z',
          },
        ],
        has_more: false,
      };

      const result = convertAnthropicModelsToOpenAI(anthropicResponse);

      expect(result).toEqual({
        object: 'list',
        data: [
          {
            id: 'claude-3.5-sonnet',
            object: 'model',
            created: 1729555200,
            owned_by: 'anthropic',
          },
          {
            id: 'claude-3.5-haiku',
            object: 'model',
            created: 1729555200,
            owned_by: 'anthropic',
          },
        ],
      });
    });

    test('should handle empty models list', () => {
      const anthropicResponse: AnthropicModelsResponse = {
        data: [],
        has_more: false,
      };

      const result = convertAnthropicModelsToOpenAI(anthropicResponse);

      expect(result).toEqual({
        object: 'list',
        data: [],
      });
    });
  });

  describe('convertOpenAIModelsToAnthropic', () => {
    test('should convert OpenAI models list to Anthropic format', () => {
      const openaiResponse: OpenAIModelsResponse = {
        object: 'list',
        data: [
          {
            id: 'claude-3.5-sonnet',
            object: 'model',
            created: 1729555200,
            owned_by: 'anthropic',
          },
          {
            id: 'claude-3.5-haiku',
            object: 'model',
            created: 1729555200,
            owned_by: 'anthropic',
          },
        ],
      };

      const result = convertOpenAIModelsToAnthropic(openaiResponse);

      expect(result).toEqual({
        data: [
          {
            id: 'claude-3-5-sonnet-20241022',
            type: 'model',
            display_name: 'claude-3.5-sonnet',
            created_at: '2024-10-22T00:00:00.000Z',
          },
          {
            id: 'claude-3-5-haiku-20241022',
            type: 'model',
            display_name: 'claude-3.5-haiku',
            created_at: '2024-10-22T00:00:00.000Z',
          },
        ],
        has_more: false,
      });
    });

    test('should handle empty models list', () => {
      const openaiResponse: OpenAIModelsResponse = {
        object: 'list',
        data: [],
      };

      const result = convertOpenAIModelsToAnthropic(openaiResponse);

      expect(result).toEqual({
        data: [],
        has_more: false,
      });
    });
  });

  describe('createMockAnthropicModelsResponse', () => {
    test('should create valid mock Anthropic models response', () => {
      const result = createMockAnthropicModelsResponse();

      expect(result.data).toHaveLength(5);
      expect(result.has_more).toBe(false);
      
      // Check that all models have required fields
      for (const model of result.data) {
        expect(model.id).toBeDefined();
        expect(model.type).toBe('model');
        expect(model.display_name).toBeDefined();
        expect(model.created_at).toBeDefined();
        expect(() => new Date(model.created_at)).not.toThrow();
      }

      // Check specific models are included
      const modelIds = result.data.map(m => m.id);
      expect(modelIds).toContain('claude-3-5-sonnet-20241022');
      expect(modelIds).toContain('claude-3-5-haiku-20241022');
      expect(modelIds).toContain('claude-3-opus-20240229');
    });
  });

  describe('createMockOpenAIModelsResponse', () => {
    test('should create valid mock OpenAI models response', () => {
      const result = createMockOpenAIModelsResponse();

      expect(result.object).toBe('list');
      expect(result.data).toHaveLength(5);
      
      // Check that all models have required fields
      for (const model of result.data) {
        expect(model.id).toBeDefined();
        expect(model.object).toBe('model');
        expect(model.created).toBeDefined();
        expect(model.owned_by).toBe('anthropic');
        expect(typeof model.created).toBe('number');
      }

      // Check specific models are included
      const modelIds = result.data.map(m => m.id);
      expect(modelIds).toContain('claude-3.5-sonnet');
      expect(modelIds).toContain('claude-3.5-haiku');
      expect(modelIds).toContain('claude-3-opus');
    });
  });

  describe('bidirectional conversion', () => {
    test('should maintain consistency in bidirectional conversion', () => {
      const originalAnthropic = createMockAnthropicModelsResponse();
      const convertedToOpenAI = convertAnthropicModelsToOpenAI(originalAnthropic);
      const convertedBackToAnthropic = convertOpenAIModelsToAnthropic(convertedToOpenAI);

      // Check that we get the same number of models
      expect(convertedBackToAnthropic.data).toHaveLength(originalAnthropic.data.length);
      
      // Check that known model names are preserved through conversion
      const originalIds = originalAnthropic.data.map(m => m.id).sort();
      const convertedIds = convertedBackToAnthropic.data.map(m => m.id).sort();
      
      for (let i = 0; i < originalIds.length; i++) {
        const originalId = originalIds[i];
        const convertedId = convertedIds[i];
        
        // For known models, they should convert back to the same ID
        if (getOpenAIModelName(originalId) !== originalId) {
          expect(convertedId).toBe(originalId);
        }
      }
    });
  });
});
