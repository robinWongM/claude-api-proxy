# Claude API Proxy

A high-performance HTTP proxy server that allows any Anthropic Claude API client to seamlessly use OpenAI-compatible APIs by converting requests and responses in real-time. Built with Bun for maximum performance and TypeScript for type safety.

## 🚀 Features

- ✅ **HTTP Proxy Server**: Drop-in replacement for Anthropic API endpoints
- ✅ **Real-time Conversion**: Automatically converts between Anthropic and OpenAI formats
- ✅ **Request Validation**: Zod-based schema validation for robust error handling
- ✅ **Cache Control Support**: Full support for Anthropic's prompt caching with cache_control directives
- ✅ **Streaming Support**: Full support for streaming responses with proper SSE formatting
- ✅ **Multiple Providers**: Works with OpenAI, Azure OpenAI, LocalAI, vLLM, and other OpenAI-compatible APIs
- ✅ **CORS Support**: Built-in CORS handling for web applications
- ✅ **Configurable**: Environment-based configuration with sensible defaults
- ✅ **Type Safe**: Full TypeScript support with Zod schemas and comprehensive type definitions
- ✅ **High Performance**: Built with Bun for optimal performance
- ✅ **Comprehensive Tests**: Full test coverage including validation and proxy functionality
- ✅ **CLI Tools**: Additional command-line utilities for offline conversion

## Requirements

- [Bun](https://bun.sh/) runtime
- TypeScript 5.0+

## Installation

Clone the repository and install dependencies:

```bash
git clone <repository-url>
cd claude-api-proxy
bun install
```

## 🚀 Quick Start

### 1. Installation

```bash
git clone <repository-url>
cd claude-api-proxy
bun install
```

### 2. Configuration

Copy the example environment file and configure your target API:

```bash
cp env.example .env
```

Edit `.env` with your configuration:

```bash
# Target OpenAI-compatible API
OPENAI_BASE_URL=https://api.openai.com
OPENAI_API_KEY=sk-your-openai-key-here

# Server settings
PORT=3000
HOST=0.0.0.0
ENABLE_LOGGING=false
ENABLE_CORS=true
```

### 3. Start the Proxy Server

```bash
# Development mode (with hot reload)
bun run dev

# Production mode
bun run start
```

### 4. Use with Any Anthropic Client

Simply point your Anthropic API client to the proxy server:

```python
# Python example with anthropic library
import anthropic

client = anthropic.Anthropic(
    api_key="your-openai-api-key",  # Your OpenAI API key
    base_url="http://localhost:3000"  # Point to proxy server
)

# Use exactly like the Anthropic API
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)

# Example with cache control for prompt caching
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    system=[{
        "type": "text", 
        "text": "You are a helpful assistant with expertise in...",
        "cache_control": {"type": "ephemeral", "ttl_seconds": 300}
    }],
    messages=[{
        "role": "user", 
        "content": "Analyze this document...",
        "cache_control": {"type": "ephemeral", "ttl_seconds": 600}
    }]
)
```

```javascript
// JavaScript/Node.js example
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: 'your-openai-api-key',
  baseURL: 'http://localhost:3000'
});

const response = await client.messages.create({
  model: 'claude-3-5-sonnet-20241022',
  max_tokens: 1024,
  messages: [{ role: 'user', content: 'Hello!' }]
});
```

### CLI Tools

For offline conversion utilities:

```bash
# Convert request files
bun run convert convert-request anthropic-to-openai examples/anthropic-request.json

# Convert response files  
bun run convert convert-response openai-to-anthropic examples/openai-response.json

# Get mock models
bun run convert models openai
```

## 🔌 Supported Providers

The proxy works with any OpenAI-compatible API:

### OpenAI
```bash
OPENAI_BASE_URL=https://api.openai.com
OPENAI_API_KEY=sk-your-openai-key
```

### Azure OpenAI
```bash
OPENAI_BASE_URL=https://your-resource.openai.azure.com
OPENAI_API_KEY=your-azure-key
CUSTOM_HEADERS={"api-version": "2024-02-15-preview"}
```

### LocalAI
```bash
OPENAI_BASE_URL=http://localhost:8080
# OPENAI_API_KEY not needed for local deployments
```

### vLLM
```bash
OPENAI_BASE_URL=http://localhost:8000
# OPENAI_API_KEY not needed for local deployments
```

### Other OpenAI-compatible APIs
Any service that implements the OpenAI chat completions API will work.

## 📡 Proxy Endpoints

The proxy server exposes the following endpoints:

- `GET /health` - Health check endpoint
- `POST /v1/messages` - Anthropic Messages API → OpenAI Chat Completions
- `GET /v1/models` - Anthropic Models API → OpenAI Models

## ⚙️ Configuration

All configuration is done via environment variables:

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `3000` | Port for the proxy server |
| `HOST` | `0.0.0.0` | Host to bind the server to |
| `OPENAI_BASE_URL` | `https://api.openai.com` | Target OpenAI-compatible API base URL |
| `OPENAI_API_KEY` | - | API key for the target API (optional for local APIs) |
| `ENABLE_LOGGING` | `false` | Enable request/response logging |
| `ENABLE_CORS` | `true` | Enable CORS headers |
| `CUSTOM_HEADERS` | - | JSON object of custom headers to add to target requests |

## 🧪 Library Usage

You can also use the conversion functions directly as a library:

```typescript
import {
  anthropicMessagesToOpenAI,
  openAIToAnthropicMessages,
  startServer,
  type ProxyConfig
} from 'claude-api-proxy';

// Convert messages
const openaiRequest = anthropicMessagesToOpenAI(anthropicRequest);

// Start server programmatically
const config: ProxyConfig = {
  port: 3000,
  host: '0.0.0.0',
  targetBaseUrl: 'https://api.openai.com',
  enableLogging: true,
  enableCors: true,
};

const server = await startServer();
```

## Supported Features

### Request Validation
- ✅ **Zod Schema Validation**: All incoming requests are validated against strict schemas
- ✅ **Detailed Error Messages**: Clear validation errors with field-specific feedback
- ✅ **Type Safety**: Runtime validation ensures data integrity

### Cache Control Support
- ✅ **Prompt Caching**: Full support for Anthropic's `cache_control` directives
- ✅ **System Message Caching**: Cache system prompts with TTL control
- ✅ **Message Caching**: Cache individual messages for repeated use
- ✅ **Tool Caching**: Cache tool definitions for improved performance
- ✅ **Automatic Headers**: Automatically adds `anthropic-beta: prompt-caching-2024-07-31` when cache control is detected

### Message Conversion
- ✅ Text messages
- ✅ System messages (converted between `system` parameter and system role)
- ✅ Multimodal content (text + images)
- ✅ Base64 image support
- ✅ Temperature, top_p, max_tokens, top_k
- ✅ Stop sequences (up to 4)
- ✅ User metadata
- ✅ Tools and function calling
- ✅ Streaming support

## 🔄 Model Mapping

The proxy automatically maps model names between formats:

| Anthropic Model | OpenAI Format |
|----------------|---------------|
| `claude-3-5-sonnet-20241022` | `claude-3.5-sonnet` |
| `claude-3-5-haiku-20241022` | `claude-3.5-haiku` |
| `claude-3-opus-20240229` | `claude-3-opus` |
| `claude-3-sonnet-20240229` | `claude-3-sonnet` |
| `claude-3-haiku-20240307` | `claude-3-haiku` |

## ⚠️ Limitations

- **Remote Images**: Remote image URLs are not supported for OpenAI → Anthropic conversion (only base64 data URLs)
- **Advanced Parameters**: Some OpenAI-specific parameters (`logit_bias`, `presence_penalty`) are not mapped to Anthropic equivalents
- **Cache Control Loss**: Cache control information is lost when converting from Anthropic to OpenAI format (as OpenAI doesn't support prompt caching)
- **TTL Restrictions**: Cache control TTL must be between 60 seconds (1 minute) and 3600 seconds (1 hour)

## 🧪 Testing

Run the comprehensive test suite:

```bash
# Run all tests (including proxy tests)
bun test

# Run tests in watch mode
bun test --watch

# Run specific test file
bun test src/test/proxy.test.ts
```

## 📝 Examples

The `examples/` directory contains sample request and response files for testing:

- `anthropic-request.json` - Sample Anthropic messages request
- `openai-request.json` - Sample OpenAI chat completions request  
- `anthropic-response.json` - Sample Anthropic messages response
- `openai-response.json` - Sample OpenAI chat completions response

Test the CLI conversion tools:

```bash
# Convert basic requests
bun run convert convert-request anthropic-to-openai examples/anthropic-request.json

# Convert requests with cache control
bun run convert convert-request anthropic-to-openai examples/anthropic-request-with-cache.json

# Convert responses
bun run convert convert-response anthropic-to-openai examples/anthropic-response.json
```

### Real-world Usage Example

```python
# Before: Direct Anthropic API usage
import anthropic
client = anthropic.Anthropic(api_key="sk-ant-...")
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)

# After: Same code, but using OpenAI via proxy
import anthropic
client = anthropic.Anthropic(
    api_key="sk-openai-key...",  # OpenAI key instead
    base_url="http://localhost:3000"  # Point to proxy
)
# Everything else stays exactly the same!
response = client.messages.create(
    model="claude-3-5-sonnet-20241022",
    max_tokens=1024,
    messages=[{"role": "user", "content": "Hello!"}]
)
```

## Development

### Project Structure

```
claude-api-proxy/
├── src/
│   ├── converters/
│   │   ├── messages.ts      # Message format conversion
│   │   ├── models.ts        # Models list conversion  
│   │   └── streaming.ts     # Streaming support
│   ├── test/                # Comprehensive test suite
│   │   ├── messages.test.ts # Message converter tests
│   │   ├── models.test.ts   # Models converter tests
│   │   ├── streaming.test.ts# Streaming tests
│   │   ├── index.test.ts    # Integration tests
│   │   └── proxy.test.ts    # Proxy server tests
│   ├── config.ts            # Configuration management
│   ├── proxy.ts             # HTTP proxy handlers
│   ├── server.ts            # Main HTTP server
│   ├── cli.ts               # CLI conversion tools
│   ├── types.ts             # TypeScript type definitions
│   └── index.ts             # Library exports
├── examples/                # Example request/response files
├── env.example              # Environment configuration template
├── package.json
├── tsconfig.json
└── README.md
```

### Development Scripts

```bash
# Start proxy server in development mode (with hot reload)
bun run dev

# Start proxy server in production mode
bun run start

# Build the project
bun run build

# Run all tests
bun test

# Run tests in watch mode
bun test --watch

# Use CLI conversion tools
bun run convert --help
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Ensure all tests pass: `bun test`
6. Submit a pull request

## License

MIT License - see LICENSE file for details.

## 🔗 API Compatibility

This proxy is designed to work with:

- **Anthropic API**: [Messages API](https://docs.anthropic.com/en/api/messages) and [Models API](https://docs.anthropic.com/en/api/models-list)
- **OpenAI API**: [Chat Completions API](https://platform.openai.com/docs/api-reference/chat/create) and [Models API](https://platform.openai.com/docs/api-reference/models/list)
- **Any OpenAI-compatible API**: LocalAI, vLLM, Azure OpenAI, etc.

The proxy automatically handles the key differences between these APIs, including parameter naming, message structure, response formats, and streaming protocols.

## 🚀 Use Cases

- **Cost Optimization**: Use cheaper OpenAI-compatible models with Anthropic client libraries
- **Local Development**: Test with local LLM servers while keeping Anthropic API code
- **Provider Migration**: Gradually migrate from Anthropic to OpenAI without changing client code  
- **A/B Testing**: Compare responses between different providers using the same interface
- **Fallback Strategy**: Use OpenAI as a fallback when Anthropic API is unavailable