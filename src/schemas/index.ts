export * from './anthropic.ts';
export * from './openai.ts';
export * from './streaming.ts';

import { z } from 'zod';
import { AnthropicMessagesRequestSchema } from './anthropic.ts';
import { OpenAIChatCompletionRequestSchema } from './openai.ts';
import type { AnthropicError } from './anthropic.ts';

export function validateAnthropicMessagesRequest(data: unknown) {
  return AnthropicMessagesRequestSchema.parse(data);
}

export function validateOpenAIChatCompletionRequest(data: unknown) {
  return OpenAIChatCompletionRequestSchema.parse(data);
}

export function createValidationError(error: z.ZodError): AnthropicError {
  const firstError = error.errors[0];
  return {
    type: 'error',
    error: {
      type: 'invalid_request_error',
      message: `Invalid request: ${firstError.message} at ${firstError.path.join('.')}`,
      param: firstError.path.join('.'),
    },
  };
}


