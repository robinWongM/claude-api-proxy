import { z } from "zod";
import { CacheControlEphemeralSchema, CacheControlSchema } from "./common.ts";

// Citations (request)
export const RequestCharLocationCitationSchema = z.object({
	type: z.literal("char_location"),
	cited_text: z.string(),
	document_index: z.number().int().min(0),
	document_title: z.string().min(1).max(255).nullable().optional(),
	end_char_index: z.number().int(),
	start_char_index: z.number().int().min(0),
});

export const RequestPageLocationCitationSchema = z.object({
	type: z.literal("page_location"),
	cited_text: z.string(),
	document_index: z.number().int().min(0),
	document_title: z.string().min(1).max(255).nullable().optional(),
	end_page_number: z.number().int(),
	start_page_number: z.number().int().min(1),
});

export const RequestContentBlockLocationCitationSchema = z.object({
	type: z.literal("content_block_location"),
	cited_text: z.string(),
	document_index: z.number().int().min(0),
	document_title: z.string().min(1).max(255).nullable().optional(),
	end_block_index: z.number().int(),
	start_block_index: z.number().int().min(0),
});

export const RequestSearchResultLocationCitationSchema = z.object({
	type: z.literal("search_result_location"),
	cited_text: z.string(),
	end_block_index: z.number().int(),
	search_result_index: z.number().int().min(0),
	source: z.string(),
	start_block_index: z.number().int().min(0),
	title: z.string().nullable().optional(),
});

export const RequestWebSearchResultLocationCitationSchema = z.object({
	type: z.literal("web_search_result_location"),
	cited_text: z.string(),
	encrypted_index: z.string(),
	title: z.string().min(1).max(512).nullable().optional(),
	url: z.string().min(1).max(2048),
});

export const RequestCitationsConfigSchema = z.object({
	enabled: z.boolean(),
});

// Text block (request)
export const RequestTextBlockSchema = z.object({
	type: z.literal("text"),
	text: z.string().min(1),
	citations: z
		.array(
			z.discriminatedUnion("type", [
				RequestCharLocationCitationSchema,
				RequestPageLocationCitationSchema,
				RequestContentBlockLocationCitationSchema,
				RequestWebSearchResultLocationCitationSchema,
				RequestSearchResultLocationCitationSchema,
			]),
		)
		.nullable()
		.optional(),
	cache_control: CacheControlSchema.nullable().optional(),
});

// Image sources
export const Base64ImageSourceSchema = z.object({
	type: z.literal("base64"),
	media_type: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]),
	data: z.string(),
});
export const URLImageSourceSchema = z.object({
	type: z.literal("url"),
	url: z.string(),
});
export const FileImageSourceSchema = z.object({
	type: z.literal("file"),
	file_id: z.string(),
});

// Image block (request)
export const RequestImageBlockSchema = z.object({
	type: z.literal("image"),
	source: z.discriminatedUnion("type", [
		Base64ImageSourceSchema,
		URLImageSourceSchema,
		FileImageSourceSchema,
	]),
	cache_control: CacheControlSchema.nullable().optional(),
});

// Document sources
export const PlainTextSourceSchema = z.object({
	type: z.literal("text"),
	media_type: z.literal("text/plain"),
	data: z.string(),
});
export const Base64PDFSourceSchema = z.object({
	type: z.literal("base64"),
	media_type: z.literal("application/pdf"),
	data: z.string(),
});
export const URLPDFSourceSchema = z.object({
	type: z.literal("url"),
	url: z.string(),
});
export const FileDocumentSourceSchema = z.object({
	type: z.literal("file"),
	file_id: z.string(),
});

// Content block as a document source
export const ContentBlockSourceSchema = z.object({
	type: z.literal("content"),
	content: z.union([
		z.string(),
		z.array(
			z.discriminatedUnion("type", [
				RequestTextBlockSchema,
				RequestImageBlockSchema,
			]),
		),
	]),
});

// Document block (request)
export const RequestDocumentBlockSchema = z.object({
	type: z.literal("document"),
	source: z.discriminatedUnion("type", [
		Base64PDFSourceSchema,
		PlainTextSourceSchema,
		ContentBlockSourceSchema,
		URLPDFSourceSchema,
		FileDocumentSourceSchema,
	]),
	citations: RequestCitationsConfigSchema.optional(),
	context: z.string().min(1).nullable().optional(),
	title: z.string().min(1).max(500).nullable().optional(),
	cache_control: CacheControlSchema.nullable().optional(),
});

// Search result block (request)
export const RequestSearchResultBlockSchema = z.object({
	type: z.literal("search_result"),
	content: z.array(RequestTextBlockSchema),
	source: z.string(),
	title: z.string(),
	citations: RequestCitationsConfigSchema.optional(),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

// Thinking blocks (request)
export const RequestThinkingBlockSchema = z.object({
	type: z.literal("thinking"),
	signature: z.string(),
	thinking: z.string(),
});
export const RequestRedactedThinkingBlockSchema = z.object({
	type: z.literal("redacted_thinking"),
	data: z.string(),
});

// Tool use/result blocks (request)
export const RequestToolUseBlockSchema = z.object({
	type: z.literal("tool_use"),
	id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
	name: z.string().min(1).max(200),
	input: z.record(z.any()),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

export const RequestToolResultBlockSchema = z.object({
	type: z.literal("tool_result"),
	tool_use_id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
	content: z.union([
		z.string(),
		z.array(
			z.discriminatedUnion("type", [
				RequestTextBlockSchema,
				RequestImageBlockSchema,
				RequestSearchResultBlockSchema,
			]),
		),
	]),
	is_error: z.boolean().optional(),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

// Server tool use (request)
export const RequestServerToolUseBlockSchema = z.object({
	type: z.literal("server_tool_use"),
	id: z.string().regex(/^srvtoolu_[a-zA-Z0-9_]+$/),
	input: z.record(z.any()),
	name: z.enum(["web_search", "code_execution"]),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

// Web search tool result (request)
export const WebSearchToolResultErrorCodeSchema = z.enum([
	"invalid_tool_input",
	"unavailable",
	"max_uses_exceeded",
	"too_many_requests",
	"query_too_long",
]);

export const RequestWebSearchResultBlockSchema = z.object({
	type: z.literal("web_search_result"),
	encrypted_content: z.string(),
	page_age: z.string().nullable().optional(),
	title: z.string(),
	url: z.string(),
});

export const RequestWebSearchToolResultErrorSchema = z.object({
	type: z.literal("web_search_tool_result_error"),
	error_code: WebSearchToolResultErrorCodeSchema,
});

export const RequestWebSearchToolResultBlockSchema = z.object({
	type: z.literal("web_search_tool_result"),
	tool_use_id: z.string().regex(/^srvtoolu_[a-zA-Z0-9_]+$/),
	content: z.union([
		z.array(RequestWebSearchResultBlockSchema),
		RequestWebSearchToolResultErrorSchema,
	]),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

// Code execution tool result (request)
export const CodeExecutionToolResultErrorCodeSchema = z.enum([
	"invalid_tool_input",
	"unavailable",
	"too_many_requests",
	"execution_time_exceeded",
]);

export const RequestCodeExecutionOutputBlockSchema = z.object({
	type: z.literal("code_execution_output"),
	file_id: z.string(),
});

export const RequestCodeExecutionResultBlockSchema = z.object({
	type: z.literal("code_execution_result"),
	content: z.array(RequestCodeExecutionOutputBlockSchema),
	return_code: z.number().int(),
	stderr: z.string(),
	stdout: z.string(),
});

export const RequestCodeExecutionToolResultErrorSchema = z.object({
	type: z.literal("code_execution_tool_result_error"),
	error_code: CodeExecutionToolResultErrorCodeSchema,
});

export const RequestCodeExecutionToolResultBlockSchema = z.object({
	type: z.literal("code_execution_tool_result"),
	tool_use_id: z.string().regex(/^srvtoolu_[a-zA-Z0-9_]+$/),
	content: z.union([
		RequestCodeExecutionToolResultErrorSchema,
		RequestCodeExecutionResultBlockSchema,
	]),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

// MCP blocks (request)
export const RequestMCPToolUseBlockSchema = z.object({
	type: z.literal("mcp_tool_use"),
	id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
	input: z.record(z.any()),
	name: z.string(),
	server_name: z.string(),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

export const RequestMCPToolResultBlockSchema = z.object({
	type: z.literal("mcp_tool_result"),
	tool_use_id: z.string().regex(/^[a-zA-Z0-9_-]+$/),
	content: z.union([z.string(), z.array(RequestTextBlockSchema)]),
	is_error: z.boolean().optional(),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

// Container upload (request)
export const RequestContainerUploadBlockSchema = z.object({
	type: z.literal("container_upload"),
	file_id: z.string(),
	cache_control: z
		.union([
			z.discriminatedUnion("type", [CacheControlEphemeralSchema]),
			z.null(),
		])
		.optional(),
});

// Input message content union
export const RequestContentBlockSchema = z.discriminatedUnion("type", [
	RequestTextBlockSchema,
	RequestImageBlockSchema,
	RequestDocumentBlockSchema,
	RequestSearchResultBlockSchema,
	RequestThinkingBlockSchema,
	RequestRedactedThinkingBlockSchema,
	RequestToolUseBlockSchema,
	RequestToolResultBlockSchema,
	RequestServerToolUseBlockSchema,
	RequestWebSearchToolResultBlockSchema,
	RequestCodeExecutionToolResultBlockSchema,
	RequestMCPToolUseBlockSchema,
	RequestMCPToolResultBlockSchema,
	RequestContainerUploadBlockSchema,
]);

// Types
export type RequestTextBlock = z.infer<typeof RequestTextBlockSchema>;
export type RequestImageBlock = z.infer<typeof RequestImageBlockSchema>;
export type RequestDocumentBlock = z.infer<typeof RequestDocumentBlockSchema>;
export type RequestToolUseBlock = z.infer<typeof RequestToolUseBlockSchema>;
export type RequestToolResultBlock = z.infer<
	typeof RequestToolResultBlockSchema
>;
export type RequestThinkingBlock = z.infer<typeof RequestThinkingBlockSchema>;
export type AnthropicContentBlock = z.infer<typeof RequestContentBlockSchema>;
