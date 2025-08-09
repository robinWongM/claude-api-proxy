/**
 * Server-Sent Events (SSE) utilities for streaming responses
 */

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
 * Formats data as Server-Sent Events with event type (Anthropic-style)
 */
export function formatSSEWithEvent(eventType: string, data: any): string {
  return `event: ${eventType}\n` + formatSSE(data);
}

