import { expect, test, describe } from 'bun:test';
import {
  convertAnthropicStreamToOpenAI,
  convertOpenAIStreamToAnthropic,
  parseSSEData,
  formatSSE,
} from '../converters/streaming.ts';

import type {
  AnthropicStreamEvent,
  OpenAIStreamChunk,
} from '../types.ts';

describe('Streaming Converter', () => {
  const requestId = 'chatcmpl-test-123';
  const model = 'claude-3-5-sonnet-20241022';

  describe('convertAnthropicStreamToOpenAI', () => {
    test('should convert message_start event', () => {
      const event: AnthropicStreamEvent = {
        type: 'message_start',
        message: {
          id: 'msg_123',
          type: 'message',
          role: 'assistant',
          content: [],
          model: 'claude-3-5-sonnet-20241022',
          stop_reason: 'end_turn',
          stop_sequence: null,
          usage: {
            input_tokens: 10,
            output_tokens: 0,
          },
        },
      };

      const result = convertAnthropicStreamToOpenAI(event, requestId, model);

      expect(result).toEqual({
        id: requestId,
        object: 'chat.completion.chunk',
        created: expect.any(Number),
        model,
        choices: [{
          index: 0,
          delta: {
            role: 'assistant',
          },
          finish_reason: null,
        }],
      });
    });

    test('should convert content_block_delta event', () => {
      const event: AnthropicStreamEvent = {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: 'Hello',
        },
      };

      const result = convertAnthropicStreamToOpenAI(event, requestId, model);

      expect(result).toEqual({
        id: requestId,
        object: 'chat.completion.chunk',
        created: expect.any(Number),
        model,
        choices: [{
          index: 0,
          delta: {
            content: 'Hello',
          },
          finish_reason: null,
        }],
      });
    });

    test('should convert message_stop event', () => {
      const event: AnthropicStreamEvent = {
        type: 'message_stop',
      };

      const result = convertAnthropicStreamToOpenAI(event, requestId, model);

      expect(result).toEqual({
        id: requestId,
        object: 'chat.completion.chunk',
        created: expect.any(Number),
        model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      });
    });

    test('should return null for content_block_start event', () => {
      const event: AnthropicStreamEvent = {
        type: 'content_block_start',
        index: 0,
        content_block: {
          type: 'text',
          text: '',
        },
      };

      const result = convertAnthropicStreamToOpenAI(event, requestId, model);

      expect(result).toBeNull();
    });

    test('should return null for content_block_stop event', () => {
      const event: AnthropicStreamEvent = {
        type: 'content_block_stop',
        index: 0,
      };

      const result = convertAnthropicStreamToOpenAI(event, requestId, model);

      expect(result).toBeNull();
    });

    test('should return null for message_delta event', () => {
      const event: AnthropicStreamEvent = {
        type: 'message_delta',
      };

      const result = convertAnthropicStreamToOpenAI(event, requestId, model);

      expect(result).toBeNull();
    });

    test('should handle content_block_delta without text', () => {
      const event: AnthropicStreamEvent = {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: '',
        },
      };

      const result = convertAnthropicStreamToOpenAI(event, requestId, model);

      expect(result).toEqual({
        id: requestId,
        object: 'chat.completion.chunk',
        created: expect.any(Number),
        model,
        choices: [{
          index: 0,
          delta: {
            content: '',
          },
          finish_reason: null,
        }],
      });
    });
  });

  describe('convertOpenAIStreamToAnthropic', () => {
    test('should convert first chunk with role', () => {
      const chunk: OpenAIStreamChunk = {
        id: requestId,
        object: 'chat.completion.chunk',
        created: 1234567890,
        model,
        choices: [{
          index: 0,
          delta: {
            role: 'assistant',
          },
          finish_reason: null,
        }],
      };

      const result = convertOpenAIStreamToAnthropic(chunk, true, false);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('message_start');
      expect(result[1].type).toBe('content_block_start');
    });

    test('should convert content delta', () => {
      const chunk: OpenAIStreamChunk = {
        id: requestId,
        object: 'chat.completion.chunk',
        created: 1234567890,
        model,
        choices: [{
          index: 0,
          delta: {
            content: 'Hello',
          },
          finish_reason: null,
        }],
      };

      const result = convertOpenAIStreamToAnthropic(chunk, false, false);

      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: 'Hello',
        },
      });
    });

    test('should convert final chunk', () => {
      const chunk: OpenAIStreamChunk = {
        id: requestId,
        object: 'chat.completion.chunk',
        created: 1234567890,
        model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      };

      const result = convertOpenAIStreamToAnthropic(chunk, false, true);

      expect(result).toHaveLength(2);
      expect(result[0].type).toBe('content_block_stop');
      expect(result[1].type).toBe('message_stop');
    });

    test('should handle chunk with both content and finish_reason', () => {
      const chunk: OpenAIStreamChunk = {
        id: requestId,
        object: 'chat.completion.chunk',
        created: 1234567890,
        model,
        choices: [{
          index: 0,
          delta: {
            content: 'Final text',
          },
          finish_reason: 'stop',
        }],
      };

      const result = convertOpenAIStreamToAnthropic(chunk, false, false);

      expect(result).toHaveLength(3);
      expect(result[0].type).toBe('content_block_delta');
      expect(result[1].type).toBe('content_block_stop');
      expect(result[2].type).toBe('message_stop');
    });

    test('should return empty array for chunk with no meaningful data', () => {
      const chunk: OpenAIStreamChunk = {
        id: requestId,
        object: 'chat.completion.chunk',
        created: 1234567890,
        model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: null,
        }],
      };

      const result = convertOpenAIStreamToAnthropic(chunk, false, false);

      expect(result).toHaveLength(0);
    });
  });

  describe('parseSSEData', () => {
    test('should parse valid JSON data', () => {
      const data = '{"type": "test", "value": 123}';
      const result = parseSSEData(data);

      expect(result).toEqual({
        type: 'test',
        value: 123,
      });
    });

    test('should return null for [DONE] marker', () => {
      const result = parseSSEData('[DONE]');

      expect(result).toBeNull();
    });

    test('should return null for invalid JSON', () => {
      const data = 'invalid json {';
      const result = parseSSEData(data);

      expect(result).toBeNull();
    });

    test('should handle empty string', () => {
      const result = parseSSEData('');

      expect(result).toBeNull();
    });
  });

  describe('formatSSE', () => {
    test('should format object as SSE data', () => {
      const data = { type: 'test', value: 123 };
      const result = formatSSE(data);

      expect(result).toBe('data: {"type":"test","value":123}\n\n');
    });

    test('should format null as [DONE] marker', () => {
      const result = formatSSE(null);

      expect(result).toBe('data: [DONE]\n\n');
    });

    test('should handle arrays', () => {
      const data = [1, 2, 3];
      const result = formatSSE(data);

      expect(result).toBe('data: [1,2,3]\n\n');
    });

    test('should handle strings', () => {
      const data = 'test string';
      const result = formatSSE(data);

      expect(result).toBe('data: "test string"\n\n');
    });

    test('should handle numbers', () => {
      const data = 42;
      const result = formatSSE(data);

      expect(result).toBe('data: 42\n\n');
    });

    test('should handle booleans', () => {
      const data = true;
      const result = formatSSE(data);

      expect(result).toBe('data: true\n\n');
    });
  });

  describe('SSE round-trip', () => {
    test('should maintain data integrity through format and parse cycle', () => {
      const originalData = {
        type: 'content_block_delta',
        index: 0,
        delta: {
          type: 'text_delta',
          text: 'Hello world!',
        },
      };

      const formatted = formatSSE(originalData);
      expect(formatted).toBe('data: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":"Hello world!"}}\n\n');

      // Extract the data part (remove "data: " prefix and "\n\n" suffix)
      const dataString = formatted.slice(6, -2);
      const parsed = parseSSEData(dataString);

      expect(parsed).toEqual(originalData);
    });

    test('should handle [DONE] marker correctly', () => {
      const formatted = formatSSE(null);
      expect(formatted).toBe('data: [DONE]\n\n');

      const dataString = formatted.slice(6, -2);
      const parsed = parseSSEData(dataString);

      expect(parsed).toBeNull();
    });
  });
});
