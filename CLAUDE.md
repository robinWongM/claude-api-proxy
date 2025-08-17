# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a TypeScript-based API proxy that converts Anthropic API requests to OpenAI-compatible format. It acts as a bridge between Anthropic's API and any OpenAI-compatible endpoint, enabling tools and applications designed for Anthropic to work with alternative AI providers. The proxy supports both non-streaming and streaming responses, with comprehensive debugging capabilities.

## Development Commands

### Core Development
- `bun run dev` - Start development server with hot reload
- `bun run build` - Build the application for production
- `bun run start` - Start the built production server
- `bun run test` - Run all tests
- `bun run test:watch` - Run tests in watch mode

### Code Quality
- `bun run lint` - Run Biome linter to check code quality
- `bun run lint:fix` - Fix linting issues automatically
- `bun run format` - Format code using Biome formatter

## Architecture Overview

### Core Components

1. **Application Layer** (`src/app.ts`)
   - Main Hono application setup with middleware configuration
   - CORS, request ID generation, and debug middleware
   - Route registration and configuration management

2. **Configuration** (`src/config.ts`)
   - Environment-based configuration management with comprehensive defaults
   - Proxy settings including target API endpoint, model selection, and debug options

3. **Request Processing Pipeline**
   - **Routes** (`src/routes/`) - HTTP endpoint definitions with Zod validation
   - **Handlers** (`src/handlers/`) - Business logic for request processing
   - **Converters** (`src/converters/`) - Format transformation between Anthropic and OpenAI schemas
   - **Schemas** (`src/schemas/`) - Comprehensive TypeScript types and Zod validation schemas
   - **Utilities** (`src/utils/`) - Debug middleware, logging, and helper functions

### Request Flow

1. Anthropic API request received at `/v1/messages`
2. Request validated against Anthropic schema using Zod
3. Request converted to OpenAI-compatible format using `anthropicRequestToCallOptions`
4. Forwarded to target OpenAI-compatible API via AI SDK
5. Response converted back to Anthropic format using `transformToAnthropicResponse`
6. Returned to client with proper headers and structure

### Streaming Implementation

Streaming responses are handled through `src/handlers/messages/stream.ts`:
- Converts AI SDK V2 stream parts to Anthropic-compatible SSE events
- Handles multiple content block types: text, tool_use, reasoning
- Manages complex event sequencing: message_start → content_block_start → content_block_delta → content_block_stop → message_delta → message_stop
- Supports tool calls with proper input JSON delta handling
- Maps reasoning blocks to text content for compatibility

### Debug System

Comprehensive debugging infrastructure in `src/utils/`:
- **Debug Middleware** (`debug-middleware.ts`) - Intercepts requests and responses for debugging
- **Debug Fetch** (`debug-fetch.ts`) - Wraps fetch calls to log provider interactions
- **Debug Utilities** (`debug.ts`) - Core functions for dumping request/response data to filesystem
- Debug files are organized by request ID timestamp in `debug/` directory
- Dumps: original request, AI SDK call options, provider request/response, AI SDK stream parts

### Key Conversion Logic

The core conversion happens in `src/converters/anthropic/`:
- `request.ts` - Converts Anthropic request format to OpenAI SDK call options
  - Handles system messages, conversation history, tool definitions
  - Maps Anthropic parameters to AI SDK V2 format
  - Supports various content types and tool configurations
- `response.ts` - Converts OpenAI SDK response back to Anthropic format
  - Transforms AI SDK response structure to Anthropic message format
  - Handles content blocks, usage statistics, and metadata

### Configuration Management

The proxy uses environment variables for configuration:
- `OPENAI_BASE_URL` - Target OpenAI-compatible API endpoint
- `OPENAI_API_KEY` - API key for target service
- `OPENAI_MODEL` - Target model to use
- `PORT`/`HOST` - Server binding configuration
- `ENABLE_DEBUG` - Enable comprehensive request/response debugging
- `DEBUG_DIR` - Directory for debug output (default: `./debug`)
- `ENABLE_LOGGING` - Enable request/response logging
- `ENABLE_CORS` - Enable CORS support
- `CUSTOM_HEADERS` - Additional headers to forward to target API

## Testing

The project uses Bun's built-in test runner. Tests are located in `src/test/` with E2E tests in `src/test/e2e/`. The test suite includes:
- **E2E Tests** (`anthropic-client.test.ts`) - End-to-end validation using actual Anthropic SDK
- Test requirements: Ollama running locally with `qwen3:8b` model
- Validates both streaming and non-streaming message responses
- Tests proper response structure and content handling

## Development Notes

- **Runtime**: Uses Bun as the runtime and package manager
- **HTTP Framework**: Built on Hono for lightweight, performant HTTP server functionality
- **AI Integration**: Integrates with Vercel AI SDK for OpenAI compatibility and streaming support
- **Validation**: Zod for request validation and type safety throughout the application
- **Code Quality**: Biome for linting and formatting (configured for tabs, double quotes)
- **Streaming**: Implements complete Anthropic streaming protocol with proper event types
- **Debugging**: Comprehensive debug system that captures all stages of request processing