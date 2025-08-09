import { formatSSEWithEvent } from './events.ts';
import type { OpenAIStreamChunk } from '../../types.ts';

export enum StreamState {
  IDLE = 'idle',
  TEXT_CONTENT = 'text_content',
  TOOL_CALLS = 'tool_calls'
}

interface ToolCallState {
  id?: string | null;
  name?: string | null;
  args: string;
}

export class StreamStateMachine {
  private currentState = StreamState.IDLE;
  private currentBlockIndex = 0;
  private toolCallState = new Map<number, ToolCallState>();
  private emittedToolStarts = new Set<number>();
  private finalized = false;

  getCurrentState(): StreamState {
    return this.currentState;
  }

  hasSawToolCalls(): boolean {
    return this.toolCallState.size > 0;
  }

  processChunk(chunk: OpenAIStreamChunk, controller: TransformStreamDefaultController<Uint8Array>): void {
    const delta = chunk.choices[0]?.delta;
    if (!delta) return;

    // Determine new state based on chunk content
    let newState = this.currentState;
    if (delta.content) {
      newState = StreamState.TEXT_CONTENT;
    } else if (delta.tool_calls) {
      newState = StreamState.TOOL_CALLS;
    }

    // Handle state transitions
    if (newState !== this.currentState) {
      this.transition(newState, controller, chunk);
    }

    // Emit content based on current state
    this.emitContent(delta, controller);

    // Check for completion
    if (chunk.choices[0]?.finish_reason === 'tool_calls') {
      this.completeToolCalls(controller);
    }
  }

  private transition(newState: StreamState, controller: TransformStreamDefaultController<Uint8Array>, _chunk: OpenAIStreamChunk): void {
    // Close current block
    if (this.currentState !== StreamState.IDLE) {
      controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('content_block_stop', {
        type: 'content_block_stop',
        index: this.currentBlockIndex
      })));
    }

    // Update state and block index
    this.currentState = newState;
    if (newState === StreamState.TOOL_CALLS) {
      this.currentBlockIndex += 1; // Tool blocks start from index 1+
    }

    // Open new block
    if (newState === StreamState.TEXT_CONTENT) {
      controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('content_block_start', {
        type: 'content_block_start',
        index: 0,
        content_block: { type: 'text', text: '' }
      })));
    } else if (newState === StreamState.TOOL_CALLS) {
      // Tool block start will be handled in emitContent when we have the tool info
    }
  }

  private emitContent(delta: any, controller: TransformStreamDefaultController<Uint8Array>): void {
    if (this.currentState === StreamState.TEXT_CONTENT && delta.content) {
      // Emit text delta
      controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('content_block_delta', {
        type: 'content_block_delta',
        index: 0,
        delta: { type: 'text_delta', text: delta.content }
      })));
    } else if (this.currentState === StreamState.TOOL_CALLS && delta.tool_calls) {
      // Handle tool call deltas
      this.processToolCallDeltas(delta.tool_calls, controller);
    }
  }

  private processToolCallDeltas(toolCalls: any[], controller: TransformStreamDefaultController<Uint8Array>): void {
    for (const tc of toolCalls) {
      const idx = typeof tc.index === 'number' ? tc.index : 0;
      const blockIndex = idx + 1; // Tool blocks use index starting from 1
      const prev = this.toolCallState.get(idx) || { id: null, name: null, args: '' };
      
      const id = tc.id ?? prev.id ?? null;
      const name = (tc.function?.name ?? prev.name) ?? null;
      const args = prev.args + (tc.function?.arguments ?? '');

      // Emit tool_use content_block_start when we first see a name
      if (name && !this.emittedToolStarts.has(idx)) {
        controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('content_block_start', {
          type: 'content_block_start',
          index: blockIndex,
          content_block: { 
            type: 'tool_use', 
            id: id || `toolu_${idx}`, 
            name, 
            input: {} 
          }
        })));
        this.emittedToolStarts.add(idx);
      }
      
      // Emit input_json_delta for new argument content
      if (tc.function?.arguments && this.emittedToolStarts.has(idx)) {
        controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('content_block_delta', {
          type: 'content_block_delta',
          index: blockIndex,
          delta: { 
            type: 'input_json_delta', 
            partial_json: tc.function.arguments 
          }
        })));
      }

      this.toolCallState.set(idx, { id, name, args });
    }
  }

  private completeToolCalls(controller: TransformStreamDefaultController<Uint8Array>): void {
    // Complete any active tool calls that haven't been completed yet
    const sorted = Array.from(this.toolCallState.entries()).sort((a, b) => a[0] - b[0]);
    for (const [toolIndex] of sorted) {
      if (this.emittedToolStarts.has(toolIndex)) {
        const blockIndex = toolIndex + 1;
        controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('content_block_stop', {
          type: 'content_block_stop',
          index: blockIndex
        })));
        // Mark as completed to prevent duplicate closes
        this.emittedToolStarts.delete(toolIndex);
      }
    }
  }

  finalize(controller: TransformStreamDefaultController<Uint8Array>): void {
    // Prevent multiple finalizations
    if (this.finalized) return;
    this.finalized = true;
    
    // Complete any remaining tool calls that haven't been closed yet
    this.completeToolCalls(controller);
    
    // Close text block if we're in text mode and haven't had tool calls
    if (this.currentState === StreamState.TEXT_CONTENT) {
      controller.enqueue(new TextEncoder().encode(formatSSEWithEvent('content_block_stop', {
        type: 'content_block_stop',
        index: 0
      })));
    }
  }

  getStopReason(): 'tool_use' | 'end_turn' {
    return this.hasSawToolCalls() ? 'tool_use' : 'end_turn';
  }
}
