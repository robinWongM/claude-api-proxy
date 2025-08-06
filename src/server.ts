#!/usr/bin/env bun

import { loadConfig } from './config.ts';
import { handleMessagesProxy, handleModelsProxy, handleOptions } from './proxy.ts';

/**
 * Main proxy server
 */
async function startServer() {
  const config = loadConfig();

  console.log('🚀 Claude API Proxy Server Starting...');
  console.log(`📡 Target API: ${config.targetBaseUrl}`);
  console.log(`🔗 Listening on: http://${config.host}:${config.port}`);
  console.log(`📝 Logging: ${config.enableLogging ? 'enabled' : 'disabled'}`);
  console.log(`🌐 CORS: ${config.enableCors ? 'enabled' : 'disabled'}`);

  const server = Bun.serve({
    port: config.port,
    hostname: config.host,
    
    async fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      const path = url.pathname;
      
      // Handle CORS preflight requests
      if (request.method === 'OPTIONS' && config.enableCors) {
        return handleOptions();
      }

      // Health check endpoint
      if (path === '/health' || path === '/') {
        return new Response(JSON.stringify({
          status: 'ok',
          service: 'claude-api-proxy',
          version: '1.0.0',
          target: config.targetBaseUrl,
          timestamp: new Date().toISOString(),
        }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        });
      }

      // Anthropic Messages API -> OpenAI Chat Completions
      if (path === '/v1/messages' && request.method === 'POST') {
        return handleMessagesProxy(request, config);
      }

      // Anthropic Models API -> OpenAI Models
      if (path === '/v1/models' && request.method === 'GET') {
        return handleModelsProxy(request, config);
      }

      // Handle unknown endpoints
      const errorResponse = {
        type: 'error',
        error: {
          type: 'not_found_error',
          message: `Unknown endpoint: ${path}`,
        },
      };

      const response = new Response(JSON.stringify(errorResponse), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });

      return config.enableCors ? addCorsHeaders(response) : response;
    },

    error(error: Error): Response {
      console.error('Server error:', error);
      
      const errorResponse = {
        type: 'error',
        error: {
          type: 'api_error',
          message: 'Internal server error',
        },
      };

      return new Response(JSON.stringify(errorResponse), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    },
  });

  // Graceful shutdown
  process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down proxy server...');
    server.stop();
    process.exit(0);
  });

  process.on('SIGTERM', () => {
    console.log('\n🛑 Shutting down proxy server...');
    server.stop();
    process.exit(0);
  });

  console.log('✅ Claude API Proxy Server is running!');
  console.log('');
  console.log('Usage:');
  console.log(`  Set your Anthropic client base URL to: http://${config.host}:${config.port}`);
  console.log('');
  console.log('Endpoints:');
  console.log(`  GET  http://${config.host}:${config.port}/health - Health check`);
  console.log(`  POST http://${config.host}:${config.port}/v1/messages - Messages API (Anthropic -> OpenAI)`);
  console.log(`  GET  http://${config.host}:${config.port}/v1/models - Models API (Anthropic -> OpenAI)`);
  console.log('');
  
  return server;
}

/**
 * Helper function to add CORS headers (used in error handling)
 */
function addCorsHeaders(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, anthropic-version, x-api-key');
  headers.set('Access-Control-Max-Age', '86400');
  
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

// Start the server if this file is run directly
if (import.meta.main) {
  try {
    await startServer();
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

export { startServer };
