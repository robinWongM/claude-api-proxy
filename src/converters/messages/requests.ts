import type { AnthropicMessage, AnthropicMessagesRequest, CacheControl, AnthropicTool } from '../../schemas/index.ts';
import type { OpenAIMessage, OpenAIChatCompletionRequest, OpenAITool } from '../../schemas/openai.ts';
import type { OpenAIContentPart } from '../../types.ts';
import type { AnthropicContentBlock } from '../../schemas/index.ts';
import { convertAnthropicContentToOpenAI, convertOpenAIContentToAnthropic } from './content.ts';
import { loadConfig } from '../../config.ts';

function convertAnthropicToolsToOpenAI(anthropicTools: AnthropicTool[]): OpenAITool[] {
  return anthropicTools.map(tool => ({ type: 'function' as const, function: { name: tool.name, description: tool.description, parameters: tool.input_schema } }));
}

export function openAIToAnthropic(openaiRequest: OpenAIChatCompletionRequest): AnthropicMessagesRequest {
  const messages: AnthropicMessage[] = [];
  let systemMessage: string | Array<{ type: 'text'; text: string; cache_control?: CacheControl }> = '';

  for (const message of openaiRequest.messages) {
    if (message.role === 'system') {
      systemMessage = typeof message.content === 'string' ? message.content : '';
    } else {
      messages.push({ role: message.role as 'user' | 'assistant', content: convertOpenAIContentToAnthropic(message.content || '') });
    }
  }

  const anthropicRequest: AnthropicMessagesRequest = { model: openaiRequest.model, messages, max_tokens: openaiRequest.max_tokens || 1024 };
  if (systemMessage) anthropicRequest.system = systemMessage;
  if (openaiRequest.temperature !== undefined) anthropicRequest.temperature = openaiRequest.temperature;
  if (openaiRequest.top_p !== undefined) anthropicRequest.top_p = openaiRequest.top_p;
  if (openaiRequest.stop) anthropicRequest.stop_sequences = Array.isArray(openaiRequest.stop) ? openaiRequest.stop : [openaiRequest.stop];
  if (openaiRequest.stream !== undefined) anthropicRequest.stream = openaiRequest.stream;
  if (openaiRequest.user) anthropicRequest.metadata = { user_id: openaiRequest.user };
  return anthropicRequest;
}

export function anthropicToOpenAI(anthropicRequest: AnthropicMessagesRequest): OpenAIChatCompletionRequest {
  const messages: OpenAIMessage[] = [];

  if (anthropicRequest.system) {
    const systemContent = typeof anthropicRequest.system === 'string' ? anthropicRequest.system : anthropicRequest.system.map(block => block.text).join('');
    messages.push({ role: 'system', content: systemContent });
  }

  for (const message of anthropicRequest.messages) {
    if (typeof message.content === 'string') {
      messages.push({ role: message.role, content: message.content });
    } else {
      const textBlocks = message.content.filter((block): block is AnthropicContentBlock & { type: 'text' } => block.type === 'text');
      const toolUseBlocks = message.content.filter((block): block is AnthropicContentBlock & { type: 'tool_use' } => block.type === 'tool_use');
      const toolResultBlocks = message.content.filter((block): block is AnthropicContentBlock & { type: 'tool_result' } => block.type === 'tool_result');

      let content: string | OpenAIContentPart[] = '';
      if (textBlocks.length > 0) content = textBlocks.map(block => block.text).join('\n').trim();
      const regularBlocks = message.content.filter(block => block.type === 'text' || block.type === 'image');
      if (regularBlocks.length > 0) content = convertAnthropicContentToOpenAI(regularBlocks);

      const openaiMessage: OpenAIMessage = { role: message.role, content };

      if (toolUseBlocks.length > 0) {
        openaiMessage.tool_calls = toolUseBlocks.map(block => ({ id: block.id, type: 'function' as const, function: { name: block.name, arguments: JSON.stringify(block.input) } }));
      }

      if (toolResultBlocks.length > 0) {
        for (const toolResult of toolResultBlocks) {
          if (toolResult.type === 'tool_result') {
            messages.push({ role: 'tool', content: typeof toolResult.content === 'string' ? toolResult.content : JSON.stringify(toolResult.content), tool_call_id: toolResult.tool_use_id });
          }
        }
      }

      if (openaiMessage.content || openaiMessage.tool_calls) {
        messages.push(openaiMessage);
      }
    }
  }

  const openaiRequest: OpenAIChatCompletionRequest = { model: loadConfig().targetModel, messages };
  if (anthropicRequest.max_tokens) openaiRequest.max_tokens = Math.min(anthropicRequest.max_tokens, 8192);
  if (anthropicRequest.temperature !== undefined) openaiRequest.temperature = anthropicRequest.temperature;
  if (anthropicRequest.top_p !== undefined) openaiRequest.top_p = anthropicRequest.top_p;
  if (anthropicRequest.stop_sequences) openaiRequest.stop = anthropicRequest.stop_sequences.length === 1 ? anthropicRequest.stop_sequences[0] : anthropicRequest.stop_sequences;
  if (anthropicRequest.stream !== undefined) openaiRequest.stream = anthropicRequest.stream;
  if (anthropicRequest.metadata?.user_id) openaiRequest.user = anthropicRequest.metadata.user_id;
  if (anthropicRequest.tools && anthropicRequest.tools.length > 0) {
    openaiRequest.tools = convertAnthropicToolsToOpenAI(anthropicRequest.tools);
    openaiRequest.tool_choice = 'auto';
  }
  return openaiRequest;
}


