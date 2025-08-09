import type { AnthropicMessagesResponse, AnthropicContentBlock } from '../../schemas/index.ts';
import type { OpenAIChatCompletionResponse } from '../../types.ts';

export function anthropicToOpenAI(
  anthropicResponse: AnthropicMessagesResponse,
  requestId?: string
): OpenAIChatCompletionResponse {
  const content = anthropicResponse.content.filter(b => b.type === 'text').map(b => b.text).join('');
  let finishReason: 'stop' | 'length' | 'content_filter' | 'tool_calls';
  switch (anthropicResponse.stop_reason) {
    case 'max_tokens': finishReason = 'length'; break;
    default: finishReason = 'stop';
  }
  return {
    id: requestId || anthropicResponse.id,
    object: 'chat.completion',
    created: Math.floor(Date.now() / 1000),
    model: anthropicResponse.model,
    choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: finishReason }],
    usage: { prompt_tokens: anthropicResponse.usage.input_tokens, completion_tokens: anthropicResponse.usage.output_tokens, total_tokens: anthropicResponse.usage.input_tokens + anthropicResponse.usage.output_tokens },
  };
}

export function openAIToAnthropic(openaiResponse: OpenAIChatCompletionResponse): AnthropicMessagesResponse {
  const choice = openaiResponse.choices[0];
  const content: AnthropicContentBlock[] = [];
  if (choice.message.content && choice.message.content.trim()) {
    content.push({ type: 'text', text: choice.message.content });
  }
  if (choice.message.tool_calls) {
    for (const toolCall of choice.message.tool_calls) {
      content.push({ type: 'tool_use', id: toolCall.id, name: toolCall.function.name, input: JSON.parse(toolCall.function.arguments) });
    }
  }
  if (content.length === 0) content.push({ type: 'text', text: '' });
  let stopReason: 'end_turn' | 'max_tokens' | 'stop_sequence' | 'tool_use';
  switch (choice.finish_reason) {
    case 'length': stopReason = 'max_tokens'; break;
    case 'tool_calls': stopReason = 'tool_use'; break;
    default: stopReason = 'end_turn';
  }
  return { id: openaiResponse.id, type: 'message', role: 'assistant', content, model: openaiResponse.model, stop_reason: stopReason, stop_sequence: null, usage: { input_tokens: openaiResponse.usage.prompt_tokens, output_tokens: openaiResponse.usage.completion_tokens } };
}


