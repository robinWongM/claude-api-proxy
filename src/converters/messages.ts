import type {
  AnthropicMessage,
  AnthropicMessagesRequest,
  AnthropicMessagesResponse,
  AnthropicContentBlock,
  OpenAIMessage,
  OpenAIChatCompletionRequest,
  CacheControl,
  AnthropicTool,
  OpenAITool,
} from '../schemas.ts';
import type {
  OpenAIChatCompletionResponse,
} from '../types.ts';

/**
 * Converts Anthropic tools to OpenAI tools format
 */
function convertAnthropicToolsToOpenAI(anthropicTools: AnthropicTool[]): OpenAITool[] {
  return anthropicTools.map(tool => ({
    type: 'function' as const,
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.input_schema,
    },
  }));
}

/**
 * Converts Anthropic content blocks to OpenAI content format
 */
function convertAnthropicContentToOpenAI(content: string | AnthropicContentBlock[]): string {
  if (typeof content === 'string') {
    return content;
  }

  return content.map((block) => {
    if (block.type === 'text') {
      return block.text;
    }

    // TODO: Handle image URLs
    
    // Fallback for unknown content types
    return JSON.stringify(block);
  }).join('\n');
}

/**
 * Converts OpenAI content format to Anthropic content blocks
 */
function convertOpenAIContentToAnthropic(content: string): string {
  return content;
}

/**
 * Converts an OpenAI chat completion request to Anthropic messages format
 */
export function convertOpenAIToAnthropic(openaiRequest: OpenAIChatCompletionRequest): AnthropicMessagesRequest {
  const messages: AnthropicMessage[] = [];
  let systemMessage: string | Array<{type: 'text', text: string, cache_control?: CacheControl}> = '';

  // Extract system message and convert other messages
  for (const message of openaiRequest.messages) {
    if (message.role === 'system') {
      // Anthropic uses a separate system parameter instead of system messages
      if (typeof message.content === 'string') {
        systemMessage = message.content;
      } else if (message.content) {
        systemMessage = message.content;
      } else {
        systemMessage = '';
      }
    } else {
      messages.push({
        role: message.role as 'user' | 'assistant',
        content: convertOpenAIContentToAnthropic(message.content || ''),
      });
    }
  }

  const anthropicRequest: AnthropicMessagesRequest = {
    model: openaiRequest.model,
    messages,
    max_tokens: openaiRequest.max_tokens || 1024,
  };

  // Add optional parameters
  if (systemMessage) {
    anthropicRequest.system = systemMessage;
  }
  
  if (openaiRequest.temperature !== undefined) {
    anthropicRequest.temperature = openaiRequest.temperature;
  }
  
  if (openaiRequest.top_p !== undefined) {
    anthropicRequest.top_p = openaiRequest.top_p;
  }
  
  if (openaiRequest.stop) {
    anthropicRequest.stop_sequences = Array.isArray(openaiRequest.stop) 
      ? openaiRequest.stop 
      : [openaiRequest.stop];
  }
  
  if (openaiRequest.stream !== undefined) {
    anthropicRequest.stream = openaiRequest.stream;
  }

  if (openaiRequest.user) {
    anthropicRequest.metadata = {
      user_id: openaiRequest.user,
    };
  }

  return anthropicRequest;
}

/**
 * Converts an Anthropic messages request to OpenAI chat completion format
 * Note: Cache control information is lost in this conversion as OpenAI doesn't support it
 */
export function convertAnthropicToOpenAI(anthropicRequest: AnthropicMessagesRequest): OpenAIChatCompletionRequest {
  const messages: OpenAIMessage[] = [];

  // Add system message if present
  if (anthropicRequest.system) {
    const systemContent = typeof anthropicRequest.system === 'string' 
      ? anthropicRequest.system
      : anthropicRequest.system.map(block => block.text).join('');
    
    messages.push({
      role: 'system',
      content: systemContent,
    });
  }

  // Convert Anthropic messages to OpenAI format
  for (const message of anthropicRequest.messages) {
    if (typeof message.content === 'string') {
      messages.push({
        role: message.role,
        content: message.content,
      });
    } else {
      // Handle content blocks
      const textBlocks = message.content.filter((block): block is AnthropicContentBlock & { type: 'text' } => block.type === 'text');
      const toolUseBlocks = message.content.filter((block): block is AnthropicContentBlock & { type: 'tool_use' } => block.type === 'tool_use');
      const toolResultBlocks = message.content.filter((block): block is AnthropicContentBlock & { type: 'tool_result' } => block.type === 'tool_result');
      
      // Create content from text blocks
      let content: string = '';     
      if (textBlocks.length > 0) {
        content = textBlocks.map(block => block.text).join('\n').trim();
      }
      
      // Handle regular content (text/image)
      const regularBlocks = message.content.filter(block => 
        block.type === 'text' || block.type === 'image'
      );
      if (regularBlocks.length > 0) {
        content = convertAnthropicContentToOpenAI(regularBlocks);
      }
      
      const openaiMessage: OpenAIMessage = {
        role: message.role,
        content: content,
      };
      
      // Convert tool_use blocks to tool_calls
      if (toolUseBlocks.length > 0) {
        openaiMessage.tool_calls = toolUseBlocks.map(block => {
          if (block.type === 'tool_use') {
            return {
              id: block.id,
              type: 'function' as const,
              function: {
                name: block.name,
                arguments: JSON.stringify(block.input),
              },
            };
          }
          throw new Error('Invalid tool_use block');
        });
      }
      
      // Convert tool_result blocks to tool role messages
      if (toolResultBlocks.length > 0) {
        for (const toolResult of toolResultBlocks) {
          if (toolResult.type === 'tool_result') {
            messages.push({
              role: 'tool',
              content: typeof toolResult.content === 'string' 
                ? toolResult.content 
                : JSON.stringify(toolResult.content),
              tool_call_id: toolResult.tool_use_id,
            });
          }
        }
      }
      
      // Only add the message if it has content or tool calls
      if (openaiMessage.content || openaiMessage.tool_calls) {
        messages.push(openaiMessage);
      }
    }
  }

  const openaiRequest: OpenAIChatCompletionRequest = {
    model: 'deepseek-chat',
    messages,
  };

  console.log('max_tokens', anthropicRequest.max_tokens, Math.min(anthropicRequest.max_tokens, 8192));
  // Add optional parameters
  if (anthropicRequest.max_tokens) {
    openaiRequest.max_tokens = Math.min(anthropicRequest.max_tokens, 8192);
  }
  
  if (anthropicRequest.temperature !== undefined) {
    openaiRequest.temperature = anthropicRequest.temperature;
  }
  
  if (anthropicRequest.top_p !== undefined) {
    openaiRequest.top_p = anthropicRequest.top_p;
  }
  
  if (anthropicRequest.stop_sequences) {
    openaiRequest.stop = anthropicRequest.stop_sequences.length === 1 
      ? anthropicRequest.stop_sequences[0] 
      : anthropicRequest.stop_sequences;
  }
  
  if (anthropicRequest.stream !== undefined) {
    openaiRequest.stream = anthropicRequest.stream;
  }

  if (anthropicRequest.metadata?.user_id) {
    openaiRequest.user = anthropicRequest.metadata.user_id;
  }

  // Convert tools if present
  if (anthropicRequest.tools && anthropicRequest.tools.length > 0) {
    openaiRequest.tools = convertAnthropicToolsToOpenAI(anthropicRequest.tools);
    // Set tool_choice to auto by default when tools are present
    openaiRequest.tool_choice = 'auto';
  }

  return openaiRequest;
}

/**
 * Converts an Anthropic messages response to OpenAI chat completion format
 */
export function convertAnthropicResponseToOpenAI(
  anthropicResponse: AnthropicMessagesResponse,
  requestId?: string
): OpenAIChatCompletionResponse {
  // Extract text content from Anthropic response
  const content = anthropicResponse.content
    .filter(block => block.type === 'text')
    .map(block => block.text)
    .join('');

  // Map stop reasons
  let finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls';
  switch (anthropicResponse.stop_reason) {
    case 'end_turn':
      finishReason = 'stop';
      break;
    case 'max_tokens':
      finishReason = 'length';
      break;
    case 'stop_sequence':
      finishReason = 'stop';
      break;
    default:
      finishReason = 'stop';
  }

  return {
    id: requestId || anthropicResponse.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: anthropicResponse.model,
    choices: [{
      index: 0,
      message: {
        role: 'assistant',
        content,
      },
      finish_reason: finishReason,
    }],
    usage: {
      prompt_tokens: anthropicResponse.usage.input_tokens,
      completion_tokens: anthropicResponse.usage.output_tokens,
      total_tokens: anthropicResponse.usage.input_tokens + anthropicResponse.usage.output_tokens,
    },
  };
}

/**
 * Converts an OpenAI chat completion response to Anthropic messages format
 */
export function convertOpenAIResponseToAnthropic(
  openaiResponse: OpenAIChatCompletionResponse
): AnthropicMessagesResponse {
  const choice = openaiResponse.choices[0];
  const content: AnthropicContentBlock[] = [];

  // Add text content if present
  if (choice.message.content && choice.message.content.trim()) {
    content.push({
      type: 'text',
      text: choice.message.content,
    });
  }

  // Add tool calls if present
  if (choice.message.tool_calls) {
    for (const toolCall of choice.message.tool_calls) {
      content.push({
        type: 'tool_use',
        id: toolCall.id,
        name: toolCall.function.name,
        input: JSON.parse(toolCall.function.arguments),
      });
    }
  }

  // If no content was added, add empty text content
  if (content.length === 0) {
    content.push({
      type: 'text',
      text: '',
    });
  }

  // Map finish reasons
  let stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  switch (choice.finish_reason) {
    case 'stop':
      stopReason = 'end_turn';
      break;
    case 'length':
      stopReason = 'max_tokens';
      break;
    case 'content_filter':
      stopReason = 'end_turn';
      break;
    case 'tool_calls':
      stopReason = 'tool_use';
      break;
    default:
      stopReason = 'end_turn';
  }

  return {
    id: openaiResponse.id,
    type: 'message',
    role: 'assistant',
    content,
    model: openaiResponse.model,
    stop_reason: stopReason,
    stop_sequence: null,
    usage: {
      input_tokens: openaiResponse.usage.prompt_tokens,
      output_tokens: openaiResponse.usage.completion_tokens,
    },
  };
}
