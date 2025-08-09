import type { AnthropicStreamEvent } from '../../schemas/index.ts';
import type { OpenAIStreamChunk } from '../../types.ts';
import { formatSSEWithEvent } from './events.ts';
import { StreamStateMachine } from './state-machine.ts';

/**
 * Creates a streaming response transformer from OpenAI to Anthropic format
 */
export function createOpenAIToAnthropicStreamTransformer() {
  let started = false;
  let sentStop = false;
  let chunkCount = 0;
  let buffer = ''; // Buffer to accumulate partial lines
  const stateMachine = new StreamStateMachine();

  function buildFinalizationEvents(controller?: TransformStreamDefaultController<Uint8Array>): AnthropicStreamEvent[] {
    const finalEvents: AnthropicStreamEvent[] = [];
    
    // Use state machine to finalize any open blocks
    if (controller) {
      stateMachine.finalize(controller);
    }
    
    // message_delta with stop_reason
    const stop_reason = stateMachine.getStopReason();
    finalEvents.push({ 
      type: 'message_delta', 
      delta: { stop_reason, stop_sequence: null }, 
      usage: { output_tokens: 0 } as any 
    });
    // message_stop
    finalEvents.push({ type: 'message_stop' });
    return finalEvents;
  }

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
              for (const ev of buildFinalizationEvents(controller)) {
                controller.enqueue(new TextEncoder().encode(formatSSEWithEvent(ev.type, ev)));
              }
              sentStop = true;
            }
            continue;
          }

          if (data) { // Only process non-empty data
            try {
              const openaiChunk: OpenAIStreamChunk = JSON.parse(data);
              chunkCount++;
              
              // Emit message_start if this is the first chunk
              if (!started) {
                const startEvent = {
                  type: 'message_start',
                  message: {
                    id: openaiChunk.id,
                    type: 'message',
                    role: 'assistant',
                    content: [],
                    model: openaiChunk.model,
                    stop_sequence: null,
                    usage: { input_tokens: 0, output_tokens: 0 },
                  },
                } as const;
                controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('message_start', startEvent)));
                started = true;
              }
              
              // Use state machine to process the chunk
              stateMachine.processChunk(openaiChunk, controller);
              
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
              for (const ev of buildFinalizationEvents(controller)) {
                controller.enqueue(new TextEncoder().encode(formatSSEWithEvent(ev.type, ev)));
              }
              sentStop = true;
            }
          } else if (data) {
            try {
              const openaiChunk: OpenAIStreamChunk = JSON.parse(data);
              
              // Emit message_start if this is the first chunk
              if (!started && chunkCount === 0) {
                const startEvent = {
                  type: 'message_start',
                  message: {
                    id: openaiChunk.id,
                    type: 'message',
                    role: 'assistant',
                    content: [],
                    model: openaiChunk.model,
                    stop_sequence: null,
                    usage: { input_tokens: 0, output_tokens: 0 },
                  },
                } as const;
                controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('message_start', startEvent)));
                started = true;
              }
              
              // Use state machine to process the chunk
              stateMachine.processChunk(openaiChunk, controller);
              
            } catch (error) {
              console.error('Error parsing final OpenAI stream chunk:', error);
            }
          }
        }
      }
    },
  });
}
