import type {
  AnthropicStreamEvent,
} from '../../schemas/index.ts';
import type { OpenAIStreamChunk } from '../../types.ts';

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

