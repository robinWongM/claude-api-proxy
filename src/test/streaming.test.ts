import { expect, test, describe } from 'bun:test';
import {
  convertOpenAIStreamToAnthropic,
  parseSSEData,
  formatSSE,
  createOpenAIToAnthropicStreamTransformer,
} from '../converters/streaming.ts';

import type {
  OpenAIStreamChunk,
} from '../types.ts';

describe('Streaming Converter', () => {
  const requestId = 'chatcmpl-test-123';
  const model = 'claude-3-5-sonnet-20241022';

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

  describe('Stream Transformers - Line Buffering', () => {
    test('createOpenAIToAnthropicStreamTransformer should handle fragmented data correctly', async () => {
      const transformer = createOpenAIToAnthropicStreamTransformer();
      const writer = transformer.writable.getWriter();
      const reader = transformer.readable.getReader();
      
      // Simulate fragmented streaming data that spans multiple chunks
      const openaiChunk = {
        id: 'chatcmpl-test-123',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-3.5-turbo',
        choices: [{
          index: 0,
          delta: { role: 'assistant' },
          finish_reason: null,
        }],
      };

      const fullLine = `data: ${JSON.stringify(openaiChunk)}\n\n`;
      
      // Fragment the data into multiple chunks (simulating real streaming behavior)
      const fragment1 = fullLine.substring(0, 15); // "data: {"id":"ch"
      const fragment2 = fullLine.substring(15, 45); // "atcmpl-test-123","object"...
      const fragment3 = fullLine.substring(45);     // Rest of the data

      // Write fragments
      await writer.write(new TextEncoder().encode(fragment1));
      await writer.write(new TextEncoder().encode(fragment2));
      await writer.write(new TextEncoder().encode(fragment3));

      // Add final [DONE] marker
      await writer.write(new TextEncoder().encode('data: [DONE]\n\n'));
      await writer.close();

      // Read and verify the results
      const results = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          const text = new TextDecoder().decode(value);
          results.push(text);
        }
      }

      // Should have received transformed Anthropic events
      expect(results.length).toBeGreaterThan(0);
      
      // First result should be a message_start event
      const firstResult = results[0];
      expect(firstResult).toContain('message_start');
      
      // Last result should be the [DONE] marker
      const lastResult = results[results.length - 1];
      expect(lastResult).toContain('[DONE]');
    });

    test('should handle multiple complete lines in a single chunk', async () => {
      const transformer = createOpenAIToAnthropicStreamTransformer();
      const writer = transformer.writable.getWriter();
      const reader = transformer.readable.getReader();
      
      // Create multiple complete lines in one chunk
      const chunk1 = {
        id: 'chatcmpl-test-1',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-3.5-turbo',
        choices: [{ index: 0, delta: { role: 'assistant' }, finish_reason: null }],
      };
      
      const chunk2 = {
        id: 'chatcmpl-test-2', 
        object: 'chat.completion.chunk',
        created: 1234567891,
        model: 'gpt-3.5-turbo',
        choices: [{ index: 0, delta: { content: 'Hello' }, finish_reason: null }],
      };

      const multiLineChunk = `data: ${JSON.stringify(chunk1)}\n\ndata: ${JSON.stringify(chunk2)}\n\n`;
      
      await writer.write(new TextEncoder().encode(multiLineChunk));
      await writer.write(new TextEncoder().encode('data: [DONE]\n\n'));
      await writer.close();

      const results = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          results.push(new TextDecoder().decode(value));
        }
      }

      // Should process both chunks correctly
      const allResults = results.join('');
      expect(allResults).toContain('message_start');
      expect(allResults).toContain('content_block_delta');
      expect(allResults).toContain('Hello');
      expect(allResults).toContain('[DONE]');
    });

    test('should handle empty lines and malformed data gracefully', async () => {
      const transformer = createOpenAIToAnthropicStreamTransformer();
      const writer = transformer.writable.getWriter();
      const reader = transformer.readable.getReader();
      
      // Mix of valid data, empty lines, and malformed JSON
      const mixedData = `data: {"invalid": json}\n\ndata: \n\n\ndata: ${JSON.stringify({
        id: 'chatcmpl-test',
        object: 'chat.completion.chunk',
        created: 1234567890,
        model: 'gpt-3.5-turbo',
        choices: [{ index: 0, delta: { content: 'Valid' }, finish_reason: null }],
      })}\n\ndata: [DONE]\n\n`;
      
      await writer.write(new TextEncoder().encode(mixedData));
      await writer.close();

      const results = [];
      let done = false;
      
      while (!done) {
        const { value, done: readerDone } = await reader.read();
        done = readerDone;
        
        if (value) {
          results.push(new TextDecoder().decode(value));
        }
      }

      // Should only process the valid data and ignore malformed parts
      const allResults = results.join('');
      expect(allResults).toContain('Valid');
      expect(allResults).toContain('[DONE]');
    });
  });
});
