import { z } from "zod";

export const AnthropicModelSchema = z.object({
	id: z.string(),
	type: z.literal("model"),
	display_name: z.string(),
	created_at: z.string().datetime(),
});

export const AnthropicModelsResponseSchema = z.object({
	data: z.array(AnthropicModelSchema),
	has_more: z.boolean(),
	first_id: z.string().optional(),
	last_id: z.string().optional(),
});

export const AnthropicErrorSchema = z.object({
	type: z.literal("error"),
	error: z.object({
		type: z.enum([
			"invalid_request_error",
			"authentication_error",
			"billing_error",
			"permission_error",
			"not_found_error",
			"rate_limit_error",
			"timeout_error",
			"api_error",
			"overloaded_error",
		]),
		message: z.string(),
	}),
});

export type AnthropicModelsResponse = z.infer<
	typeof AnthropicModelsResponseSchema
>;
export type AnthropicError = z.infer<typeof AnthropicErrorSchema>;
