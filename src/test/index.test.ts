import { expect, test, describe } from 'bun:test';
import {
  anthropicMessagesToOpenAI,
  openAIToAnthropicMessages,
  anthropicResponseToOpenAI,
  openAIResponseToAnthropic,
  anthropicModelsToOpenAI,
  openAIModelsToAnthropic,
  getMockOpenAIModels,
  getMockAnthropicModels,
  modelNameConverter,
  streaming,
  utils,
} from '../index.ts';

import type {
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
  AnthropicModelsResponse,
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
  OpenAIModelsResponse,
} from '../types.ts';

describe('Index Module', () => {
  describe('Message conversion functions', () => {
    test('anthropicMessagesToOpenAI should work', () => {
      const anthropicRequest: AnthropicMessagesRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1000,
      };

      const result = anthropicMessagesToOpenAI(anthropicRequest);

      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.messages).toHaveLength(1);
      expect(result.max_tokens).toBe(1000);
    });

    test('openAIToAnthropicMessages should work', () => {
      const openaiRequest: OpenAIChatCompletionRequest = {
        model: 'gpt-4',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1000,
      };

      const result = openAIToAnthropicMessages(openaiRequest);

      expect(result.model).toBe('gpt-4');
      expect(result.messages).toHaveLength(1);
      expect(result.max_tokens).toBe(1000);
    });

    test('anthropicResponseToOpenAI should work', () => {
      const anthropicResponse: AnthropicMessagesResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello!' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 10, output_tokens: 5 },
      };

      const result = anthropicResponseToOpenAI(anthropicResponse);

      expect(result.id).toBe('msg_123');
      expect(result.object).toBe('chat.completion');
      expect(result.choices[0].message.content).toBe('Hello!');
    });

    test('openAIResponseToAnthropic should work', () => {
      const openaiResponse: OpenAIChatCompletionResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [{
          index: 0,
          message: { role: 'assistant', content: 'Hello!' },
          finish_reason: 'stop',
        }],
        usage: { prompt_tokens: 10, completion_tokens: 5, total_tokens: 15 },
      };

      const result = openAIResponseToAnthropic(openaiResponse);

      expect(result.id).toBe('chatcmpl-123');
      expect(result.type).toBe('message');
      expect(result.content[0].text).toBe('Hello!');
    });
  });

  describe('Models conversion functions', () => {
    test('anthropicModelsToOpenAI should work', () => {
      const anthropicModels: AnthropicModelsResponse = {
        data: [{
          id: 'claude-3-5-sonnet-20241022',
          type: 'model',
          display_name: 'Claude 3.5 Sonnet',
          created_at: '2024-10-22T00:00:00Z',
        }],
        has_more: false,
      };

      const result = anthropicModelsToOpenAI(anthropicModels);

      expect(result.object).toBe('list');
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('claude-3.5-sonnet');
      expect(result.data[0].owned_by).toBe('anthropic');
    });

    test('openAIModelsToAnthropic should work', () => {
      const openaiModels: OpenAIModelsResponse = {
        object: 'list',
        data: [{
          id: 'claude-3.5-sonnet',
          object: 'model',
          created: 1729555200,
          owned_by: 'anthropic',
        }],
      };

      const result = openAIModelsToAnthropic(openaiModels);

      expect(result.has_more).toBe(false);
      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe('claude-3-5-sonnet-20241022');
      expect(result.data[0].type).toBe('model');
    });

    test('getMockOpenAIModels should return valid response', () => {
      const result = getMockOpenAIModels();

      expect(result.object).toBe('list');
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].object).toBe('model');
      expect(result.data[0].owned_by).toBe('anthropic');
    });

    test('getMockAnthropicModels should return valid response', () => {
      const result = getMockAnthropicModels();

      expect(result.has_more).toBe(false);
      expect(result.data.length).toBeGreaterThan(0);
      expect(result.data[0].type).toBe('model');
    });
  });

  describe('Model name converter', () => {
    test('should convert model names correctly', () => {
      expect(modelNameConverter.anthropicToOpenAI('claude-3-5-sonnet-20241022')).toBe('claude-3.5-sonnet');
      expect(modelNameConverter.openAIToAnthropic('claude-3.5-sonnet')).toBe('claude-3-5-sonnet-20241022');
    });

    test('should handle unknown models', () => {
      expect(modelNameConverter.anthropicToOpenAI('unknown-model')).toBe('unknown-model');
      expect(modelNameConverter.openAIToAnthropic('unknown-model')).toBe('unknown-model');
    });
  });

  describe('Streaming utilities', () => {
    test('should have streaming functions', () => {
      expect(typeof streaming.anthropicToOpenAI).toBe('function');
      expect(typeof streaming.openAIToAnthropic).toBe('function');
      expect(typeof streaming.formatSSE).toBe('function');
      expect(typeof streaming.parseSSEData).toBe('function');
    });

    test('formatSSE should work', () => {
      const data = { test: 'value' };
      const result = streaming.formatSSE(data);
      expect(result).toBe('data: {"test":"value"}\n\n');
    });

    test('parseSSEData should work', () => {
      const result = streaming.parseSSEData('{"test":"value"}');
      expect(result).toEqual({ test: 'value' });
    });

    test('parseSSEData should handle [DONE]', () => {
      const result = streaming.parseSSEData('[DONE]');
      expect(result).toBeNull();
    });
  });

  describe('Utility functions', () => {
    test('generateRequestId should create unique IDs', () => {
      const id1 = utils.generateRequestId();
      const id2 = utils.generateRequestId();

      expect(id1).toMatch(/^chatcmpl-\d+-[a-z0-9]+$/);
      expect(id2).toMatch(/^chatcmpl-\d+-[a-z0-9]+$/);
      expect(id1).not.toBe(id2);
    });

    test('generateRequestId should have consistent format', () => {
      const id = utils.generateRequestId();
      const parts = id.split('-');

      expect(parts[0]).toBe('chatcmpl');
      expect(parts[1]).toMatch(/^\d+$/); // timestamp
      expect(parts[2]).toMatch(/^[a-z0-9]+$/); // random string
    });
  });

  describe('Integration tests', () => {
    test('should handle complete request/response cycle', () => {
      // Start with OpenAI request
      const openaiRequest: OpenAIChatCompletionRequest = {
        model: 'claude-3.5-sonnet',
        messages: [
          { role: 'system', content: 'You are helpful' },
          { role: 'user', content: 'Hello' },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      };

      // Convert to Anthropic
      const anthropicRequest = openAIToAnthropicMessages(openaiRequest);
      expect(anthropicRequest.system).toBe('You are helpful');
      expect(anthropicRequest.messages).toHaveLength(1);
      expect(anthropicRequest.model).toBe('claude-3.5-sonnet');

      // Simulate Anthropic response
      const anthropicResponse: AnthropicMessagesResponse = {
        id: 'msg_test',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hi there!' }],
        model: 'claude-3.5-sonnet',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: { input_tokens: 15, output_tokens: 8 },
      };

      // Convert back to OpenAI
      const openaiResponse = anthropicResponseToOpenAI(anthropicResponse);
      expect(openaiResponse.choices[0].message.content).toBe('Hi there!');
      expect(openaiResponse.usage.total_tokens).toBe(23);
    });

    test('should handle models conversion cycle', () => {
      // Start with mock Anthropic models
      const anthropicModels = getMockAnthropicModels();
      
      // Convert to OpenAI format
      const openaiModels = anthropicModelsToOpenAI(anthropicModels);
      expect(openaiModels.object).toBe('list');
      expect(openaiModels.data.length).toBe(anthropicModels.data.length);

      // Convert back to Anthropic
      const backToAnthropic = openAIModelsToAnthropic(openaiModels);
      expect(backToAnthropic.data.length).toBe(anthropicModels.data.length);
      
      // Check that known models maintain their IDs through conversion
      const originalIds = anthropicModels.data.map(m => m.id);
      const convertedIds = backToAnthropic.data.map(m => m.id);
      
      for (let i = 0; i < originalIds.length; i++) {
        const originalId = originalIds[i];
        const convertedId = convertedIds[i];
        
        // For known models with mappings, they should convert back correctly
        if (modelNameConverter.anthropicToOpenAI(originalId) !== originalId) {
          expect(convertedId).toBe(originalId);
        }
      }
    });
  });
});
