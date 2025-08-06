#!/usr/bin/env bun

import {
  anthropicMessagesToOpenAI,
  openAIToAnthropicMessages,
  anthropicResponseToOpenAI,
  openAIResponseToAnthropic,
  getMockOpenAIModels,
  getMockAnthropicModels,
} from './index.ts';

import type {
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
  OpenAIChatCompletionRequest,
  OpenAIChatCompletionResponse,
} from './types.ts';

// CLI interface for conversion utilities
if (import.meta.main) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log(`
Claude API Proxy - Anthropic ↔ OpenAI Converter CLI

Usage:
  bun run src/cli.ts <command> [options]

Commands:
  convert-request <format> <file>    Convert a request file between formats
  convert-response <format> <file>   Convert a response file between formats
  models <format>                    Get mock models list in specified format
  help                              Show this help message

Formats:
  anthropic-to-openai               Convert from Anthropic to OpenAI format
  openai-to-anthropic               Convert from OpenAI to Anthropic format

Examples:
  bun run src/cli.ts convert-request anthropic-to-openai examples/anthropic-request.json
  bun run src/cli.ts models openai
  bun run src/cli.ts convert-response openai-to-anthropic examples/openai-response.json

For the HTTP proxy server, use:
  bun run dev        # Start development server
  bun run start      # Start production server
`);
    process.exit(0);
  }

  const command = args[0];

  try {
    switch (command) {
      case 'convert-request': {
        const format = args[1];
        const filePath = args[2];
        
        if (!format || !filePath) {
          console.error('Usage: convert-request <format> <file>');
          process.exit(1);
        }

        const fileContent = await Bun.file(filePath).text();
        const requestData = JSON.parse(fileContent);

        let result;
        if (format === 'anthropic-to-openai') {
          result = anthropicMessagesToOpenAI(requestData as AnthropicMessagesRequest);
        } else if (format === 'openai-to-anthropic') {
          result = openAIToAnthropicMessages(requestData as OpenAIChatCompletionRequest);
        } else {
          console.error('Invalid format. Use "anthropic-to-openai" or "openai-to-anthropic"');
          process.exit(1);
        }

        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'convert-response': {
        const format = args[1];
        const filePath = args[2];
        
        if (!format || !filePath) {
          console.error('Usage: convert-response <format> <file>');
          process.exit(1);
        }

        const fileContent = await Bun.file(filePath).text();
        const responseData = JSON.parse(fileContent);

        let result;
        if (format === 'anthropic-to-openai') {
          result = anthropicResponseToOpenAI(responseData as AnthropicMessagesResponse);
        } else if (format === 'openai-to-anthropic') {
          result = openAIResponseToAnthropic(responseData as OpenAIChatCompletionResponse);
        } else {
          console.error('Invalid format. Use "anthropic-to-openai" or "openai-to-anthropic"');
          process.exit(1);
        }

        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'models': {
        const format = args[1];
        
        if (!format) {
          console.error('Usage: models <format>');
          process.exit(1);
        }

        let result;
        if (format === 'openai') {
          result = getMockOpenAIModels();
        } else if (format === 'anthropic') {
          result = getMockAnthropicModels();
        } else {
          console.error('Invalid format. Use "openai" or "anthropic"');
          process.exit(1);
        }

        console.log(JSON.stringify(result, null, 2));
        break;
      }

      case 'help': {
        // Help already shown above
        break;
      }

      default: {
        console.error(`Unknown command: ${command}`);
        console.error('Run with no arguments to see help');
        process.exit(1);
      }
    }
  } catch (error) {
    console.error('Error:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
