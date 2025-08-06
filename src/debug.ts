import { mkdir, writeFile } from 'fs/promises';
import { join } from 'path';
import type { ProxyConfig } from './config.ts';
import type { AnthropicMessagesRequest, OpenAIChatCompletionRequest } from './schemas.ts';
import type { OpenAIChatCompletionResponse, AnthropicMessagesResponse } from './types.ts';

/**
 * Debug utility for dumping requests and responses to files
 */
export class DebugLogger {
  private requestCounter = 0;
  
  constructor(private config: ProxyConfig) {}

  /**
   * Ensure debug directory exists
   */
  private async ensureDebugDir(): Promise<void> {
    if (this.config.enableDebug) {
      try {
        await mkdir(this.config.debugDir, { recursive: true });
      } catch (error) {
        console.error('Failed to create debug directory:', error);
      }
    }
  }

  /**
   * Generate a unique request ID for this session
   */
  private generateRequestId(): string {
    this.requestCounter++;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    return `${timestamp}-${this.requestCounter.toString().padStart(4, '0')}`;
  }

  /**
   * Dump original Anthropic request to file
   */
  async dumpAnthropicRequest(request: AnthropicMessagesRequest): Promise<string | null> {
    if (!this.config.enableDebug) return null;

    try {
      await this.ensureDebugDir();
      const requestId = this.generateRequestId();
      const filename = `anthropic-request-${requestId}.json`;
      const filepath = join(this.config.debugDir, filename);
      
      const debugData = request;    

      await writeFile(filepath, JSON.stringify(debugData));
      
      if (this.config.enableLogging) {
        console.log(`[DEBUG] Anthropic request saved to: ${filepath}`);
      }
      
      return requestId;
    } catch (error) {
      console.error('Failed to dump Anthropic request:', error);
      return null;
    }
  }

  /**
   * Dump converted OpenAI request to file
   */
  async dumpOpenAIRequest(request: OpenAIChatCompletionRequest, requestId: string): Promise<void> {
    if (!this.config.enableDebug) return;

    try {
      await this.ensureDebugDir();
      const filename = `openai-request-${requestId}.json`;
      const filepath = join(this.config.debugDir, filename);
      
      const debugData = request;

      await writeFile(filepath, JSON.stringify(debugData));
      
      if (this.config.enableLogging) {
        console.log(`[DEBUG] OpenAI request saved to: ${filepath}`);
      }
    } catch (error) {
      console.error('Failed to dump OpenAI request:', error);
    }
  }

  /**
   * Dump OpenAI response to file
   */
  async dumpOpenAIResponse(response: OpenAIChatCompletionResponse, requestId: string): Promise<void> {
    if (!this.config.enableDebug) return;

    try {
      await this.ensureDebugDir();
      const filename = `openai-response-${requestId}.json`;
      const filepath = join(this.config.debugDir, filename);
      
      const debugData = {
        timestamp: new Date().toISOString(),
        type: 'openai_response',
        requestId,
        data: response,
      };

      await writeFile(filepath, JSON.stringify(debugData, null, 2));
      
      if (this.config.enableLogging) {
        console.log(`[DEBUG] OpenAI response saved to: ${filepath}`);
      }
    } catch (error) {
      console.error('Failed to dump OpenAI response:', error);
    }
  }

  /**
   * Dump converted Anthropic response to file
   */
  async dumpAnthropicResponse(response: AnthropicMessagesResponse, requestId: string): Promise<void> {
    if (!this.config.enableDebug) return;

    try {
      await this.ensureDebugDir();
      const filename = `anthropic-response-${requestId}.json`;
      const filepath = join(this.config.debugDir, filename);
      
      const debugData = {
        timestamp: new Date().toISOString(),
        type: 'anthropic_response',
        requestId,
        data: response,
      };

      await writeFile(filepath, JSON.stringify(debugData, null, 2));
      
      if (this.config.enableLogging) {
        console.log(`[DEBUG] Anthropic response saved to: ${filepath}`);
      }
    } catch (error) {
      console.error('Failed to dump Anthropic response:', error);
    }
  }

  /**
   * Dump streaming data to file (for debugging streaming responses)
   */
  async dumpStreamingData(data: any, requestId: string, chunkIndex: number): Promise<void> {
    if (!this.config.enableDebug) return;

    try {
      await this.ensureDebugDir();
      const filename = `streaming-${requestId}-chunk-${chunkIndex.toString().padStart(4, '0')}.json`;
      const filepath = join(this.config.debugDir, filename);
      
      const debugData = {
        timestamp: new Date().toISOString(),
        type: 'streaming_chunk',
        requestId,
        chunkIndex,
        data,
      };

      await writeFile(filepath, JSON.stringify(debugData, null, 2));
    } catch (error) {
      console.error('Failed to dump streaming data:', error);
    }
  }

  /**
   * Dump error information to file
   */
  async dumpError(error: any, requestId: string, context: string): Promise<void> {
    if (!this.config.enableDebug) return;

    try {
      await this.ensureDebugDir();
      const filename = `error-${requestId}.json`;
      const filepath = join(this.config.debugDir, filename);
      
      const debugData = {
        timestamp: new Date().toISOString(),
        type: 'error',
        requestId,
        context,
        error: {
          name: error?.name,
          message: error?.message,
          stack: error?.stack,
          ...error,
        },
      };

      await writeFile(filepath, JSON.stringify(debugData, null, 2));
      
      if (this.config.enableLogging) {
        console.log(`[DEBUG] Error saved to: ${filepath}`);
      }
    } catch (dumpError) {
      console.error('Failed to dump error:', dumpError);
    }
  }
}
