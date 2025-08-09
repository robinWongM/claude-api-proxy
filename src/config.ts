export interface ProxyConfig {
  /** Port for the proxy server to listen on */
  port: number;
  /** Host for the proxy server to bind to */
  host: string;
  /** Target OpenAI-compatible API base URL */
  targetBaseUrl: string;
  /** API key for the target OpenAI-compatible API */
  targetApiKey?: string;
  /** Target model for the target OpenAI-compatible API */
  targetModel: string;
  /** Enable request/response logging */
  enableLogging: boolean;
  /** Enable CORS */
  enableCors: boolean;
  /** Custom headers to add to target requests */
  customHeaders?: Record<string, string>;
  /** Enable debug mode to dump requests to files */
  enableDebug: boolean;
  /** Directory to save debug files */
  debugDir: string;
}

/**
 * Default configuration for the proxy server
 */
export const defaultConfig: ProxyConfig = {
  port: parseInt(process.env.PORT || '3000'),
  host: process.env.HOST || '0.0.0.0',
  targetBaseUrl: process.env.OPENAI_BASE_URL || 'https://api.openai.com',
  targetApiKey: process.env.OPENAI_API_KEY,
  targetModel: process.env.OPENAI_MODEL || 'moonshotai/kimi-k2:free',
  enableLogging: process.env.ENABLE_LOGGING === 'true',
  enableCors: process.env.ENABLE_CORS !== 'false', // Default to true
  customHeaders: process.env.CUSTOM_HEADERS ? JSON.parse(process.env.CUSTOM_HEADERS) : undefined,
  enableDebug: process.env.ENABLE_DEBUG === 'true',
  debugDir: process.env.DEBUG_DIR || './debug',
};

/**
 * Load configuration from environment variables
 */
export function loadConfig(): ProxyConfig {
  return {
    ...defaultConfig,
    // Override with any custom logic if needed
  };
}
