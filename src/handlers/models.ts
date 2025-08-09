import type { ProxyConfig } from '../config.ts';
import { convertOpenAIModelsToAnthropic, createMockOpenAIModelsResponse } from '../converters/models.ts';
import type { OpenAIModelsResponse } from '../types.ts';

export async function handleModelsProxy(request: Request, config: ProxyConfig): Promise<Response> {
  try {
    const targetHeaders = new Headers();

    if (config.targetApiKey) {
      targetHeaders.set('Authorization', `Bearer ${config.targetApiKey}`);
    } else {
      const authHeader = request.headers.get('authorization') || request.headers.get('x-api-key');
      if (authHeader) {
        targetHeaders.set('Authorization', authHeader.startsWith('Bearer ') ? authHeader : `Bearer ${authHeader}`);
      }
    }

    if (config.customHeaders) {
      for (const [k, v] of Object.entries(config.customHeaders)) targetHeaders.set(k, v);
    }

    const targetUrl = `${config.targetBaseUrl}/v1/models`;
    const targetResponse = await fetch(targetUrl, { method: 'GET', headers: targetHeaders });

    let anthropicResponse;
    if (targetResponse.ok) {
      const openaiResponse = await targetResponse.json() as OpenAIModelsResponse;
      anthropicResponse = convertOpenAIModelsToAnthropic(openaiResponse);
    } else {
      const mockOpenAI = createMockOpenAIModelsResponse();
      anthropicResponse = convertOpenAIModelsToAnthropic(mockOpenAI);
    }

    return new Response(JSON.stringify(anthropicResponse), { status: 200, headers: { 'Content-Type': 'application/json' } });
  } catch (error) {
    const body = {
      type: 'error',
      error: { type: 'api_error', message: error instanceof Error ? error.message : 'Internal server error' },
    };
    return new Response(JSON.stringify(body), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
}


