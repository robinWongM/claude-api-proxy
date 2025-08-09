import { z } from 'zod';

export const CacheControlSchema = z.object({
  type: z.enum(['ephemeral']),
  ttl_seconds: z.number().min(60).max(3600).optional(),
});

export const AnthropicTextContentSchema = z.object({ type: z.literal('text'), text: z.string() });
export const AnthropicImageContentSchema = z.object({
  type: z.literal('image'),
  source: z.object({ type: z.literal('base64'), media_type: z.string(), data: z.string() }),
});
export const AnthropicToolUseContentSchema = z.object({ type: z.literal('tool_use'), id: z.string(), name: z.string(), input: z.record(z.any()) });
export const AnthropicToolResultContentSchema = z.object({ type: z.literal('tool_result'), tool_use_id: z.string(), content: z.union([z.string(), z.array(z.any())]), is_error: z.boolean().optional() });

export const AnthropicContentBlockSchema = z.union([
  AnthropicTextContentSchema,
  AnthropicImageContentSchema,
  AnthropicToolUseContentSchema,
  AnthropicToolResultContentSchema,
]);

export const AnthropicMessageSchema = z.object({
  role: z.enum(['user', 'assistant']),
  content: z.union([z.string(), z.array(AnthropicContentBlockSchema)]),
  cache_control: CacheControlSchema.optional(),
});

export const AnthropicToolSchema = z.object({
  name: z.string(),
  description: z.string(),
  input_schema: z.object({ type: z.literal('object'), properties: z.record(z.any()), required: z.array(z.string()).optional() }),
  cache_control: CacheControlSchema.optional(),
});

export const AnthropicMessagesRequestSchema = z.object({
  model: z.string().min(1),
  messages: z.array(AnthropicMessageSchema).min(1),
  max_tokens: z.number().int().min(1),
  temperature: z.number().min(0).max(2).optional(),
  top_p: z.number().min(0).max(1).optional(),
  top_k: z.number().int().min(1).optional(),
  stop_sequences: z.array(z.string()).max(4).optional(),
  stream: z.boolean().optional(),
  system: z.union([
    z.string(),
    z.array(z.object({ type: z.literal('text'), text: z.string(), cache_control: CacheControlSchema.optional() })),
  ]).optional(),
  metadata: z.object({ user_id: z.string().optional() }).optional(),
  tools: z.array(AnthropicToolSchema).optional(),
});

export const AnthropicUsageSchema = z.object({
  input_tokens: z.number().int().min(0),
  output_tokens: z.number().int().min(0),
  cache_creation_input_tokens: z.number().int().min(0).optional(),
  cache_read_input_tokens: z.number().int().min(0).optional(),
});

export const AnthropicMessagesResponseSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  content: z.array(AnthropicContentBlockSchema),
  model: z.string(),
  stop_reason: z.enum(['end_turn', 'max_tokens', 'stop_sequence', 'tool_use']),
  stop_sequence: z.string().nullable(),
  usage: AnthropicUsageSchema,
});

export const AnthropicModelSchema = z.object({ id: z.string(), type: z.literal('model'), display_name: z.string(), created_at: z.string().datetime() });
export const AnthropicModelsResponseSchema = z.object({ data: z.array(AnthropicModelSchema), has_more: z.boolean(), first_id: z.string().optional(), last_id: z.string().optional() });

export const AnthropicErrorSchema = z.object({
  type: z.literal('error'),
  error: z.object({
    type: z.enum(['invalid_request_error', 'authentication_error', 'permission_error', 'not_found_error', 'rate_limit_error', 'api_error', 'overloaded_error']),
    message: z.string(),
    param: z.string().optional(),
    code: z.string().optional(),
  }),
});

export type AnthropicMessagesRequest = z.infer<typeof AnthropicMessagesRequestSchema>;
export type AnthropicMessagesResponse = z.infer<typeof AnthropicMessagesResponseSchema>;
export type AnthropicModelsResponse = z.infer<typeof AnthropicModelsResponseSchema>;
export type AnthropicMessage = z.infer<typeof AnthropicMessageSchema>;
export type AnthropicContentBlock = z.infer<typeof AnthropicContentBlockSchema>;
export type CacheControl = z.infer<typeof CacheControlSchema>;
export type AnthropicTool = z.infer<typeof AnthropicToolSchema>;
export type AnthropicError = z.infer<typeof AnthropicErrorSchema>;


