import { openAIToAnthropic as convertOpenAIRequest, anthropicToOpenAI as convertAnthropicRequest } from './messages/requests.ts';
import { anthropicToOpenAI as convertAnthropicResp, openAIToAnthropic as convertOpenAIResp } from './messages/responses.ts';

// moved to ./messages/{content,requests}.ts

/**
 * Converts an OpenAI chat completion request to Anthropic messages format
 */
export const convertOpenAIToAnthropic = convertOpenAIRequest;

/**
 * Converts an Anthropic messages request to OpenAI chat completion format
 * Note: Cache control information is lost in this conversion as OpenAI doesn't support it
 */
export const convertAnthropicToOpenAI = convertAnthropicRequest;

/**
 * Converts an Anthropic messages response to OpenAI chat completion format
 */
export const convertAnthropicResponseToOpenAI = convertAnthropicResp;

/**
 * Converts an OpenAI chat completion response to Anthropic messages format
 */
export const convertOpenAIResponseToAnthropic = convertOpenAIResp;
