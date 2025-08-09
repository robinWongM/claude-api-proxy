import type {
  AnthropicStreamEvent,
} from '../schemas/index.ts';
import type { OpenAIStreamChunk } from '../types.ts';

/**
 * Converts an Anthropic streaming event to OpenAI streaming format
 */
export function convertAnthropicStreamToOpenAI(
  event: AnthropicStreamEvent,
  requestId: string,
  model: string
): OpenAIStreamChunk | null {
  const timestamp = Math.floor(Date.now() / 1000);

  switch (event.type) {
    case 'message_start': {
      // Initial chunk with role
      return {
        id: requestId,
        object: 'chat.completion.chunk',
        created: timestamp,
        model,
        choices: [{
          index: 0,
          delta: {
            role: 'assistant',
          },
          finish_reason: null,
        }],
      };
    }

    case 'content_block_start': {
      // Start of content block - no content to send yet
      return null;
    }

    case 'content_block_delta': {
      // Text content delta
      if (event.delta?.type === 'text_delta' && event.delta.text !== undefined) {
        return {
          id: requestId,
          object: 'chat.completion.chunk',
          created: timestamp,
          model,
          choices: [{
            index: 0,
            delta: {
              content: event.delta.text,
            },
            finish_reason: null,
          }],
        };
      }
      return null;
    }

    case 'content_block_stop': {
      // End of content block - no content to send
      return null;
    }

    case 'message_delta': {
      // Message-level delta - usually contains usage info, we skip for now
      return null;
    }

    case 'message_stop': {
      // Final chunk with finish reason
      return {
        id: requestId,
        object: 'chat.completion.chunk',
        created: timestamp,
        model,
        choices: [{
          index: 0,
          delta: {},
          finish_reason: 'stop',
        }],
      };
    }

    default: {
      return null;
    }
  }
}

/**
 * Converts OpenAI streaming chunk to Anthropic streaming format
 * Note: This is more complex as Anthropic has a richer streaming protocol
 */
export function convertOpenAIStreamToAnthropic(
  chunk: OpenAIStreamChunk,
  isFirst: boolean = false,
  isLast: boolean = false
): AnthropicStreamEvent[] {
  const events: AnthropicStreamEvent[] = [];
  const choice = chunk.choices[0];

  if (isFirst) {
    // Start of message (some providers may omit role in the first delta)
    events.push({
      type: 'message_start',
      message: {
        id: chunk.id,
        type: 'message',
        role: 'assistant',
        content: [],
        model: chunk.model,
        stop_sequence: null,
        stop_reason: null,
        // stop_reason intentionally omitted at start per protocol; include as undefined
        usage: {
          input_tokens: 0,
          output_tokens: 0,
        },
      },
    });

    // Start of content block
    events.push({
      type: 'content_block_start',
      index: 0,
      content_block: {
        type: 'text',
        text: '',
      },
    });
  }

  if (choice.delta.content) {
    // Content delta
    events.push({
      type: 'content_block_delta',
      index: 0,
      delta: {
        type: 'text_delta',
        text: choice.delta.content,
      },
    });
  }

  if (isLast || choice.finish_reason) {
    // End of content block
    events.push({
      type: 'content_block_stop',
      index: 0,
    });

    // Message delta with final stop reason mapping
    let stop_reason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use' | undefined;
    if (choice.finish_reason === 'stop') stop_reason = 'end_turn';
    else if (choice.finish_reason === 'length') stop_reason = 'max_tokens';
    events.push({
      type: 'message_delta',
      delta: {
        stop_reason,
        stop_sequence: null,
      },
      usage: {
        // We don't have token counts from OpenAI streaming; provide minimal shape to satisfy clients
        output_tokens: 0,
      },
    });

    // End of message
    events.push({
      type: 'message_stop',
    });
  }

  return events;
}

/**
 * Parses Server-Sent Events (SSE) data
 */
export function parseSSEData(data: string): any | null {
  try {
    if (data === '[DONE]') {
      return null;
    }
    return JSON.parse(data);
  } catch {
    return null;
  }
}

/**
 * Formats data as Server-Sent Events (SSE)
 */
export function formatSSE(data: any): string {
  if (data === null) {
    return 'data: [DONE]\n\n';
  }
  return `data: ${JSON.stringify(data)}\n\n`;
}

// Anthropic-style SSE: include event header
export function formatSSEWithEvent(eventType: string, data: any): string {
  return `event: ${eventType}\n` + formatSSE(data);
}

/**
 * Creates a streaming response transformer from Anthropic to OpenAI format
 */
export function createAnthropicToOpenAIStreamTransformer(requestId: string, model: string) {
  let buffer = ''; // Buffer to accumulate partial lines

  return new TransformStream({
    transform(chunk: Uint8Array, controller) {
      const text = new TextDecoder().decode(chunk);
      // Add new chunk to buffer
      buffer += text;
      
      // Split by lines but keep the last potentially incomplete line
      const lines = buffer.split('\n');
      // Keep the last line in buffer (might be incomplete)
      buffer = lines.pop() || '';

      // Process complete lines
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            controller.enqueue(new TextEncoder().encode(formatSSE(null)));
            continue;
          }

          if (data) { // Only process non-empty data
            try {
              const event: AnthropicStreamEvent = JSON.parse(data);
              const openaiChunk = convertAnthropicStreamToOpenAI(event, requestId, model);
              
              if (openaiChunk) {
                controller.enqueue(new TextEncoder().encode(formatSSE(openaiChunk)));
              }
            } catch (error) {
              console.error('Error parsing Anthropic stream event:', error, 'Data:', data);
            }
          }
        }
      }
    },
    
    flush(controller) {
      // Process any remaining data in buffer
      if (buffer.trim()) {
        const line = buffer.trim();
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            controller.enqueue(new TextEncoder().encode(formatSSE(null)));
          } else if (data) {
            try {
              const event: AnthropicStreamEvent = JSON.parse(data);
              const openaiChunk = convertAnthropicStreamToOpenAI(event, requestId, model);
              
              if (openaiChunk) {
                controller.enqueue(new TextEncoder().encode(formatSSE(openaiChunk)));
              }
            } catch (error) {
              console.error('Error parsing final Anthropic stream event:', error);
            }
          }
        }
      }
    },
  });
}

/**
 * Creates a streaming response transformer from OpenAI to Anthropic format
 */
export function createOpenAIToAnthropicStreamTransformer() {
  let started = false;
  let sentStop = false;
  let chunkCount = 0;
  let buffer = ''; // Buffer to accumulate partial lines

  return new TransformStream({
    transform(chunk: Uint8Array, controller) {
      const text = new TextDecoder().decode(chunk);
      // Add new chunk to buffer
      buffer += text;
      
      // Split by lines but keep the last potentially incomplete line
      const lines = buffer.split('\n');
      // Keep the last line in buffer (might be incomplete)
      buffer = lines.pop() || '';
      
      // Process complete lines
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            // Send final stop events if not already sent
            if (started && !sentStop) {
              const stopContent = { type: 'content_block_stop', index: 0 } as const;
              const stopMessage = { type: 'message_stop' } as const;
              controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('content_block_stop', stopContent)));
              const delta = { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null } } as const;
              controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('message_delta', delta)));
              controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('message_stop', stopMessage)));
              sentStop = true;
            }
            continue;
          }

          if (data) { // Only process non-empty data
            try {
              const openaiChunk: OpenAIStreamChunk = JSON.parse(data);
              chunkCount++;
              
              const events = convertOpenAIStreamToAnthropic(
                openaiChunk,
                !started,
                false
              );
              
              for (const event of events) {
                controller.enqueue(new TextEncoder().encode(formatSSEWithEvent(event.type, event)));
                if (event.type === 'message_start') started = true;
                if (event.type === 'message_stop') sentStop = true;
              }
            } catch (error) {
              console.error('Error parsing OpenAI stream chunk:', error, 'Data:', data);
            }
          }
        }
      }
    },
    
    flush(controller) {
      // Process any remaining data in buffer
      if (buffer.trim()) {
        const line = buffer.trim();
        if (line.startsWith('data: ')) {
          const data = line.slice(6).trim();
          
          if (data === '[DONE]') {
            if (started && !sentStop) {
              const stopContent = { type: 'content_block_stop', index: 0 } as const;
              const stopMessage = { type: 'message_stop' } as const;
              controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('content_block_stop', stopContent)));
              const delta = { type: 'message_delta', delta: { stop_reason: 'end_turn', stop_sequence: null } } as const;
              controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('message_delta', delta)));
              controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('message_stop', stopMessage)));
              sentStop = true;
            }
          } else if (data) {
            try {
              const openaiChunk: OpenAIStreamChunk = JSON.parse(data);
              const events = convertOpenAIStreamToAnthropic(
                openaiChunk,
                !started && chunkCount === 0,
                true
              );
              
              for (const event of events) {
                controller.enqueue(new TextEncoder().encode(formatSSEWithEvent(event.type, event)));
                if (event.type === 'message_start') started = true;
                if (event.type === 'message_stop') sentStop = true;
              }
            } catch (error) {
              console.error('Error parsing final OpenAI stream chunk:', error);
            }
          }
        }
      }
    },
  });
}
