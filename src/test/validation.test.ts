import { expect, test, describe } from 'bun:test';
import { z } from 'zod';
import {
  validateAnthropicMessagesRequest,
  validateOpenAIChatCompletionRequest,
  createValidationError,
  AnthropicMessagesRequestSchema,
  OpenAIChatCompletionRequestSchema,
} from '../schemas.ts';

describe('Request Validation', () => {
  describe('validateAnthropicMessagesRequest', () => {
    test('should validate valid Anthropic request', () => {
      const validRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      };

      const result = validateAnthropicMessagesRequest(validRequest);
      expect(result).toEqual(validRequest);
    });

    test('should validate request with cache control', () => {
      const requestWithCache = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?',
            cache_control: {
              type: 'ephemeral',
              ttl_seconds: 300,
            },
          },
        ],
        max_tokens: 1000,
        system: [
          {
            type: 'text',
            text: 'You are a helpful assistant.',
            cache_control: {
              type: 'ephemeral',
              ttl_seconds: 600,
            },
          },
        ],
      };

      const result = validateAnthropicMessagesRequest(requestWithCache);
      expect(result).toEqual(requestWithCache);
    });

    test('should validate request with tools and cache control', () => {
      const requestWithTools = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'What is the weather like?',
          },
        ],
        max_tokens: 1000,
        tools: [
          {
            name: 'get_weather',
            description: 'Get the current weather',
            input_schema: {
              type: 'object',
              properties: {
                location: {
                  type: 'string',
                  description: 'The location to get weather for',
                },
              },
              required: ['location'],
            },
            cache_control: {
              type: 'ephemeral',
              ttl_seconds: 1800,
            },
          },
        ],
      };

      const result = validateAnthropicMessagesRequest(requestWithTools);
      expect(result).toEqual(requestWithTools);
    });

    test('should reject invalid cache control TTL', () => {
      const invalidRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'Hello',
            cache_control: {
              type: 'ephemeral',
              ttl_seconds: 30, // Too low (minimum is 60)
            },
          },
        ],
        max_tokens: 1000,
      };

      expect(() => validateAnthropicMessagesRequest(invalidRequest)).toThrow(z.ZodError);
    });

    test('should reject request with missing required fields', () => {
      const invalidRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        // Missing max_tokens
      };

      expect(() => validateAnthropicMessagesRequest(invalidRequest)).toThrow(z.ZodError);
    });

    test('should reject request with invalid temperature', () => {
      const invalidRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        max_tokens: 1000,
        temperature: 3.0, // Too high (max is 2.0)
      };

      expect(() => validateAnthropicMessagesRequest(invalidRequest)).toThrow(z.ZodError);
    });

    test('should reject request with too many stop sequences', () => {
      const invalidRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        max_tokens: 1000,
        stop_sequences: ['STOP1', 'STOP2', 'STOP3', 'STOP4', 'STOP5'], // Too many (max is 4)
      };

      expect(() => validateAnthropicMessagesRequest(invalidRequest)).toThrow(z.ZodError);
    });

    test('should reject request with empty messages array', () => {
      const invalidRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [], // Empty array not allowed
        max_tokens: 1000,
      };

      expect(() => validateAnthropicMessagesRequest(invalidRequest)).toThrow(z.ZodError);
    });

    test('should validate multimodal content', () => {
      const multimodalRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What is in this image?',
              },
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: 'image/jpeg',
                  data: 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      };

      const result = validateAnthropicMessagesRequest(multimodalRequest);
      expect(result).toEqual(multimodalRequest);
    });
  });

  describe('validateOpenAIChatCompletionRequest', () => {
    test('should validate valid OpenAI request', () => {
      const validRequest = {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
          },
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      };

      const result = validateOpenAIChatCompletionRequest(validRequest);
      expect(result).toEqual(validRequest);
    });

    test('should reject request with invalid temperature', () => {
      const invalidRequest = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        temperature: -1, // Invalid (min is 0)
      };

      expect(() => validateOpenAIChatCompletionRequest(invalidRequest)).toThrow(z.ZodError);
    });

    test('should validate multimodal OpenAI request', () => {
      const multimodalRequest = {
        model: 'gpt-4-vision-preview',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: 'What is in this image?',
              },
              {
                type: 'image_url',
                image_url: {
                  url: 'data:image/jpeg;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==',
                },
              },
            ],
          },
        ],
      };

      const result = validateOpenAIChatCompletionRequest(multimodalRequest);
      expect(result).toEqual(multimodalRequest);
    });
  });

  describe('createValidationError', () => {
    test('should create proper error response from Zod error', () => {
      try {
        AnthropicMessagesRequestSchema.parse({
          model: '', // Invalid empty model
          messages: [],
          max_tokens: 1000,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationError = createValidationError(error);
          
          expect(validationError.type).toBe('error');
          expect(validationError.error.type).toBe('invalid_request_error');
          expect(validationError.error.message).toContain('Invalid request');
          expect(validationError.error.param).toBeDefined();
        }
      }
    });

    test('should handle nested validation errors', () => {
      try {
        AnthropicMessagesRequestSchema.parse({
          model: 'claude-3-5-sonnet-20241022',
          messages: [
            {
              role: 'user',
              content: 'Hello',
              cache_control: {
                type: 'ephemeral',
                ttl_seconds: 30, // Invalid (too low)
              },
            },
          ],
          max_tokens: 1000,
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          const validationError = createValidationError(error);
          
          expect(validationError.error.param).toContain('cache_control');
        }
      }
    });
  });

  describe('Schema edge cases', () => {
    test('should handle max values correctly', () => {
      const maxRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        max_tokens: 8192, // Maximum allowed
        temperature: 2.0, // Maximum allowed
        top_p: 1.0, // Maximum allowed
        stop_sequences: ['STOP1', 'STOP2', 'STOP3', 'STOP4'], // Maximum allowed (4)
      };

      const result = validateAnthropicMessagesRequest(maxRequest);
      expect(result).toEqual(maxRequest);
    });

    test('should handle min values correctly', () => {
      const minRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        max_tokens: 1, // Minimum allowed
        temperature: 0, // Minimum allowed
        top_p: 0.001, // Just above minimum
        top_k: 1, // Minimum allowed
      };

      const result = validateAnthropicMessagesRequest(minRequest);
      expect(result).toEqual(minRequest);
    });
  });
});
