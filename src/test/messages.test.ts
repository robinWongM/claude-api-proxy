import { expect, test, describe } from 'bun:test';
import {
  convertAnthropicToOpenAI,
  convertOpenAIToAnthropic,
  convertAnthropicResponseToOpenAI,
  convertOpenAIResponseToAnthropic,
} from '../converters/messages.ts';

import type {
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
} from '../types.ts';

describe('Messages Converter', () => {
  describe('convertAnthropicToOpenAI', () => {
    test('should convert basic Anthropic request to OpenAI format', () => {
      const anthropicRequest: AnthropicMessagesRequest = {
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

      const result = convertAnthropicToOpenAI(anthropicRequest);

      expect(result).toEqual({
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });
    });

    test('should handle system messages', () => {
      const anthropicRequest: AnthropicMessagesRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        max_tokens: 1000,
        system: 'You are a helpful assistant.',
      };

      const result = convertAnthropicToOpenAI(anthropicRequest);

      expect(result.messages).toHaveLength(2);
      expect(result.messages[0]).toEqual({
        role: 'system',
        content: 'You are a helpful assistant.',
      });
      expect(result.messages[1]).toEqual({
        role: 'user',
        content: 'Hello',
      });
    });

    test('should handle multimodal content', () => {
      const anthropicRequest: AnthropicMessagesRequest = {
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

      const result = convertAnthropicToOpenAI(anthropicRequest);

      expect(result.messages[0].content).toEqual([
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
      ]);
    });

    test('should handle stop sequences', () => {
      const anthropicRequest: AnthropicMessagesRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1000,
        stop_sequences: ['STOP', 'END'],
      };

      const result = convertAnthropicToOpenAI(anthropicRequest);

      expect(result.stop).toEqual(['STOP', 'END']);
    });

    test('should handle single stop sequence', () => {
      const anthropicRequest: AnthropicMessagesRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1000,
        stop_sequences: ['STOP'],
      };

      const result = convertAnthropicToOpenAI(anthropicRequest);

      expect(result.stop).toEqual('STOP');
    });

    test('should handle metadata user_id', () => {
      const anthropicRequest: AnthropicMessagesRequest = {
        model: 'claude-3-5-sonnet-20241022',
        messages: [{ role: 'user', content: 'Hello' }],
        max_tokens: 1000,
        metadata: {
          user_id: 'user-123',
        },
      };

      const result = convertAnthropicToOpenAI(anthropicRequest);

      expect(result.user).toBe('user-123');
    });
  });

  describe('convertOpenAIToAnthropic', () => {
    test('should convert basic OpenAI request to Anthropic format', () => {
      const openaiRequest: OpenAIChatCompletionRequest = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      };

      const result = convertOpenAIToAnthropic(openaiRequest);

      expect(result).toEqual({
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: 'Hello, how are you?',
          },
        ],
        max_tokens: 1000,
        temperature: 0.7,
      });
    });

    test('should handle system messages', () => {
      const openaiRequest: OpenAIChatCompletionRequest = {
        model: 'gpt-4',
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant.',
          },
          {
            role: 'user',
            content: 'Hello',
          },
        ],
        max_tokens: 1000,
      };

      const result = convertOpenAIToAnthropic(openaiRequest);

      expect(result.system).toBe('You are a helpful assistant.');
      expect(result.messages).toHaveLength(1);
      expect(result.messages[0]).toEqual({
        role: 'user',
        content: 'Hello',
      });
    });

    test('should handle multimodal content', () => {
      const openaiRequest: OpenAIChatCompletionRequest = {
        model: 'gpt-4',
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
        max_tokens: 1000,
      };

      const result = convertOpenAIToAnthropic(openaiRequest);

      expect(result.messages[0].content).toEqual([
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
      ]);
    });

    test('should throw error for remote image URLs', () => {
      const openaiRequest: OpenAIChatCompletionRequest = {
        model: 'gpt-4',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image_url',
                image_url: {
                  url: 'https://example.com/image.jpg',
                },
              },
            ],
          },
        ],
        max_tokens: 1000,
      };

      expect(() => convertOpenAIToAnthropic(openaiRequest)).toThrow(
        'Remote image URLs are not supported for Anthropic conversion'
      );
    });
  });

  describe('convertAnthropicResponseToOpenAI', () => {
    test('should convert Anthropic response to OpenAI format', () => {
      const anthropicResponse: AnthropicMessagesResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          {
            type: 'text',
            text: 'Hello! I am doing well, thank you for asking.',
          },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      const result = convertAnthropicResponseToOpenAI(anthropicResponse);

      expect(result.id).toBe('msg_123');
      expect(result.object).toBe('chat.completion');
      expect(result.model).toBe('claude-3-5-sonnet-20241022');
      expect(result.choices).toHaveLength(1);
      expect(result.choices[0].message.content).toBe('Hello! I am doing well, thank you for asking.');
      expect(result.choices[0].finish_reason).toBe('stop');
      expect(result.usage).toEqual({
        prompt_tokens: 10,
        completion_tokens: 20,
        total_tokens: 30,
      });
    });

    test('should handle max_tokens stop reason', () => {
      const anthropicResponse: AnthropicMessagesResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [{ type: 'text', text: 'Hello' }],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'max_tokens',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      const result = convertAnthropicResponseToOpenAI(anthropicResponse);

      expect(result.choices[0].finish_reason).toBe('length');
    });

    test('should handle multiple content blocks', () => {
      const anthropicResponse: AnthropicMessagesResponse = {
        id: 'msg_123',
        type: 'message',
        role: 'assistant',
        content: [
          { type: 'text', text: 'Hello ' },
          { type: 'text', text: 'world!' },
        ],
        model: 'claude-3-5-sonnet-20241022',
        stop_reason: 'end_turn',
        stop_sequence: null,
        usage: {
          input_tokens: 10,
          output_tokens: 20,
        },
      };

      const result = convertAnthropicResponseToOpenAI(anthropicResponse);

      expect(result.choices[0].message.content).toBe('Hello world!');
    });
  });

  describe('convertOpenAIResponseToAnthropic', () => {
    test('should convert OpenAI response to Anthropic format', () => {
      const openaiResponse: OpenAIChatCompletionResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello! I am doing well, thank you for asking.',
            },
            finish_reason: 'stop',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      const result = convertOpenAIResponseToAnthropic(openaiResponse);

      expect(result.id).toBe('chatcmpl-123');
      expect(result.type).toBe('message');
      expect(result.role).toBe('assistant');
      expect(result.model).toBe('gpt-4');
      expect(result.content).toEqual([
        {
          type: 'text',
          text: 'Hello! I am doing well, thank you for asking.',
        },
      ]);
      expect(result.stop_reason).toBe('end_turn');
      expect(result.usage).toEqual({
        input_tokens: 10,
        output_tokens: 20,
      });
    });

    test('should handle length finish reason', () => {
      const openaiResponse: OpenAIChatCompletionResponse = {
        id: 'chatcmpl-123',
        object: 'chat.completion',
        created: 1234567890,
        model: 'gpt-4',
        choices: [
          {
            index: 0,
            message: {
              role: 'assistant',
              content: 'Hello',
            },
            finish_reason: 'length',
          },
        ],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 20,
          total_tokens: 30,
        },
      };

      const result = convertOpenAIResponseToAnthropic(openaiResponse);

      expect(result.stop_reason).toBe('max_tokens');
    });
  });
});
