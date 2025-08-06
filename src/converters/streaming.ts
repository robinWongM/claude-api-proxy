import type {
  AnthropicStreamEvent,
  OpenAIStreamChunk,
  OpenAIStreamChoice,
} from '../types.ts';

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

  if (isFirst && choice.delta.role) {
    // Start of message
    events.push({
      type: 'message_start',
      message: {
        id: chunk.id,
        type: 'message',
        role: 'assistant',
        content: [],
        model: chunk.model,
        stop_reason: 'end_turn',
        stop_sequence: null,
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

/**
 * Creates a streaming response transformer from Anthropic to OpenAI format
 */
export function createAnthropicToOpenAIStreamTransformer(requestId: string, model: string) {
  return new TransformStream({
    transform(chunk: Uint8Array, controller) {
      const text = new TextDecoder().decode(chunk);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            controller.enqueue(new TextEncoder().encode(formatSSE(null)));
            continue;
          }

          try {
            const event: AnthropicStreamEvent = JSON.parse(data);
            const openaiChunk = convertAnthropicStreamToOpenAI(event, requestId, model);
            
            if (openaiChunk) {
              controller.enqueue(new TextEncoder().encode(formatSSE(openaiChunk)));
            }
          } catch (error) {
            console.error('Error parsing Anthropic stream event:', error);
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
  let isFirst = true;
  let chunkCount = 0;

  return new TransformStream({
    transform(chunk: Uint8Array, controller) {
      const text = new TextDecoder().decode(chunk);
      const lines = text.split('\n');

      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = line.slice(6);
          
          if (data === '[DONE]') {
            // Send final events
            const events = convertOpenAIStreamToAnthropic(
              {} as OpenAIStreamChunk, // Empty chunk for final events
              false,
              true
            );
            
            for (const event of events) {
              controller.enqueue(new TextEncoder().encode(formatSSE(event)));
            }
            
            controller.enqueue(new TextEncoder().encode(formatSSE(null)));
            continue;
          }

          try {
            const openaiChunk: OpenAIStreamChunk = JSON.parse(data);
            chunkCount++;
            
            const events = convertOpenAIStreamToAnthropic(
              openaiChunk,
              isFirst,
              false
            );
            
            for (const event of events) {
              controller.enqueue(new TextEncoder().encode(formatSSE(event)));
            }
            
            isFirst = false;
          } catch (error) {
            console.error('Error parsing OpenAI stream chunk:', error);
          }
        }
      }
    },
  });
}
