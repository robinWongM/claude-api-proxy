# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Key Commands
- `bun run dev`: Start development server with hot reload
- `bun run build`: Build production bundle
- `bun run start`: Run production server
- `bun test`: Run all tests
- `bun test --watch`: Run tests in watch mode
- `bun run convert`: CLI tools for request/response conversion

## Architecture Overview
- **src/server.ts**: Main HTTP server setup
- **src/proxy.ts**: Handles request/response conversion between Anthropic and OpenAI formats
- **src/converters/**: Contains logic for message, model, and streaming conversions
- **src/schemas.ts**: Zod schemas for request/response validation
- **src/types.ts**: Shared TypeScript types
- **src/test/**: Comprehensive test suite covering all conversion logic

## Key Features
- Real-time conversion between Anthropic and OpenAI API formats
- Full streaming support with SSE formatting
- Zod-based request validation
- Cache control support for Anthropic prompts
- CLI tools for offline conversion