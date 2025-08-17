import { z } from "zod";
import { WebSearchToolResultErrorCodeSchema } from "./request-content.ts";

// Response citations
export const ResponseTextBlockSchema = z.object({
	type: z.literal("text"),
	text: z.string().min(0).max(5_000_000),
	citations: z
		.union([
			z.array(
				z.discriminatedUnion("type", [
					z.object({
						type: z.literal("char_location"),
						cited_text: z.string(),
						document_index: z.number().int().min(0),
						document_title: z.string().nullable().optional(),
						end_char_index: z.number().int(),
						file_id: z.string().nullable(),
						start_char_index: z.number().int().min(0),
					}),
					z.object({
						type: z.literal("page_location"),
						cited_text: z.string(),
						document_index: z.number().int().min(0),
						document_title: z.string().nullable().optional(),
						end_page_number: z.number().int(),
						file_id: z.string().nullable(),
						start_page_number: z.number().int().min(1),
					}),
					z.object({
						type: z.literal("content_block_location"),
						cited_text: z.string(),
						document_index: z.number().int().min(0),
						document_title: z.string().nullable().optional(),
						end_block_index: z.number().int(),
						file_id: z.string().nullable(),
						start_block_index: z.number().int().min(0),
					}),
					z.object({
						type: z.literal("web_search_result_location"),
						cited_text: z.string(),
						encrypted_index: z.string(),
						title: z.string().nullable().optional(),
						url: z.string(),
					}),
					z.object({
						type: z.literal("search_result_location"),
						cited_text: z.string(),
						end_block_index: z.number().int(),
						search_result_index: z.number().int().min(0),
						source: z.string(),
						start_block_index: z.number().int().min(0),
						title: z.string().nullable().optional(),
					}),
				]),
			),
			z.null(),
		])
		.default(null),
});

export const ResponseThinkingBlockSchema = z.object({
	type: z.literal("thinking"),
	signature: z.string(),
	thinking: z.string(),
});

export const ResponseRedactedThinkingBlockSchema = z.object({
	type: z.literal("redacted_thinking"),
	data: z.string(),
});

export const ResponseToolUseBlockSchema = z.object({
	type: z.literal("tool_use"),
	id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
	name: z.string().min(1),
	input: z.record(z.any()),
});

export const ResponseServerToolUseBlockSchema = z.object({
	type: z.literal("server_tool_use"),
	id: z.string().regex(/^srvtoolu_[a-zA-Z0-9_]+$/),
	name: z.enum(["web_search", "code_execution"]),
	input: z.record(z.any()),
});

export const ResponseWebSearchResultBlockSchema = z.object({
	type: z.literal("web_search_result"),
	encrypted_content: z.string(),
	page_age: z.string().nullable().optional(),
	title: z.string(),
	url: z.string(),
});

export const ResponseWebSearchToolResultErrorSchema = z.object({
	type: z.literal("web_search_tool_result_error"),
	error_code: WebSearchToolResultErrorCodeSchema,
});

export const ResponseWebSearchToolResultBlockSchema = z.object({
	type: z.literal("web_search_tool_result"),
	tool_use_id: z.string().regex(/^srvtoolu_[a-zA-Z0-9_]+$/),
	content: z.union([
		ResponseWebSearchToolResultErrorSchema,
		z.array(ResponseWebSearchResultBlockSchema),
	]),
});

export const ResponseCodeExecutionOutputBlockSchema = z.object({
	type: z.literal("code_execution_output"),
	file_id: z.string(),
});

export const ResponseCodeExecutionResultBlockSchema = z.object({
	type: z.literal("code_execution_result"),
	content: z.array(ResponseCodeExecutionOutputBlockSchema),
	return_code: z.number().int(),
	stderr: z.string(),
	stdout: z.string(),
});

export const ResponseCodeExecutionToolResultErrorSchema = z.object({
	type: z.literal("code_execution_tool_result_error"),
	error_code: z.enum([
		"invalid_tool_input",
		"unavailable",
		"too_many_requests",
		"execution_time_exceeded",
	]),
});

export const ResponseCodeExecutionToolResultBlockSchema = z.object({
	type: z.literal("code_execution_tool_result"),
	tool_use_id: z.string().regex(/^srvtoolu_[a-zA-Z0-9_]+$/),
	content: z.union([
		ResponseCodeExecutionToolResultErrorSchema,
		ResponseCodeExecutionResultBlockSchema,
	]),
});

export const ResponseMCPToolUseBlockSchema = z.object({
	type: z.literal("mcp_tool_use"),
	id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
	input: z.record(z.any()),
	name: z.string(),
	server_name: z.string(),
});

export const ResponseMCPToolResultBlockSchema = z.object({
	type: z.literal("mcp_tool_result"),
	content: z.union([z.string(), z.array(ResponseTextBlockSchema)]),
	is_error: z.boolean(),
	tool_use_id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
});

export const ResponseContainerUploadBlockSchema = z.object({
	type: z.literal("container_upload"),
	file_id: z.string(),
});

export const ResponseContentBlockSchema = z.discriminatedUnion("type", [
	ResponseTextBlockSchema,
	ResponseThinkingBlockSchema,
	ResponseRedactedThinkingBlockSchema,
	ResponseToolUseBlockSchema,
	ResponseServerToolUseBlockSchema,
	ResponseWebSearchToolResultBlockSchema,
	ResponseCodeExecutionToolResultBlockSchema,
	ResponseMCPToolUseBlockSchema,
	ResponseMCPToolResultBlockSchema,
	ResponseContainerUploadBlockSchema,
]);
