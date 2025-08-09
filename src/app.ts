import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Hono } from "hono";
import { cors } from "hono/cors";
import type { RequestIdVariables } from "hono/request-id";
import { requestId } from "hono/request-id";
import { loadConfig, type ProxyConfig } from "./config";
import { handleMessagesRoute } from "./routes/messages";

export function createApp(config?: ProxyConfig) {
	const app = new Hono<{
		Variables: RequestIdVariables & {
			config: ProxyConfig;
			anthropicRequest?: unknown;
		};
	}>();

	const resolved = config ?? loadConfig();
	app.use("*", async (c, next) => {
		c.set("config", resolved);
		await next();
	});

	// CORS
	app.use("*", cors());

	// Request ID (use timestamp-based generator to keep human-friendly folder names)
	app.use(
		"*",
		requestId({
			generator: () => new Date().toISOString().replace(/[:.]/g, "-"),
		}),
	);

	// Debug middleware: dump Anthropic requests and non-streaming responses
	app.use("/v1/messages/*", async (c, next) => {
		const config = c.get("config");
		if (!config.enableDebug) return next();

		const ensureDir = async () => {
			await mkdir(config.debugDir, { recursive: true }).catch(() => {});
		};

		const requestId = c.get("requestId");

		// Read and store the Anthropic request body once via clone to avoid consuming original
		try {
			const cloned = c.req.raw.clone();
			const bodyText = await cloned.text();
			await ensureDir();
			const dir = join(config.debugDir, requestId);
			await writeFile(join(dir, `anthropic-request.json`), bodyText).catch(
				async (_e) => {
					await mkdir(dir, { recursive: true });
					await writeFile(join(dir, `anthropic-request.json`), bodyText);
				},
			);
			try {
				const parsed = JSON.parse(bodyText);
				c.set("anthropicRequest", parsed);
			} catch {
				// Leave unset if not JSON
			}
		} catch {
			// Ignore read errors
		}

		await next();

		// For non-streaming JSON responses, dump the Anthropic response
		try {
			const contentType = c.res.headers.get("Content-Type") || "";
			const isStream = contentType.includes("text/event-stream");
			if (!isStream && contentType.includes("application/json")) {
				const cloned = c.res.clone();
				const text = await cloned.text();
				const dir = join(config.debugDir, requestId);
				await mkdir(dir, { recursive: true }).catch(() => {});
				await writeFile(join(dir, `anthropic-response.json`), text);
			}
		} catch {
			// Ignore dump errors
		}

		// For streaming SSE responses, tee and dump entire Anthropic SSE into a single file
		try {
			const contentType = c.res.headers.get("Content-Type") || "";
			const isStream = contentType.includes("text/event-stream");
			const body = c.res.body;
			if (isStream && body && requestId) {
				const [forClient, forDump] = body.tee();
				const newHeaders = new Headers(c.res.headers);
				c.res = new Response(forClient, {
					status: c.res.status,
					statusText: c.res.statusText,
					headers: newHeaders,
				});

				const decoder = new TextDecoder();
				let collected = "";
				(async () => {
					try {
						const reader = forDump.getReader();
						while (true) {
							const { done, value } = await reader.read();
							if (done) break;
							if (value) collected += decoder.decode(value);
						}
					} finally {
						const dir = join(config.debugDir, requestId);
						await mkdir(dir, { recursive: true }).catch(() => {});
						await writeFile(join(dir, `anthropic-stream.txt`), collected).catch(
							() => {},
						);
					}
				})();
			}
		} catch {
			// Ignore SSE dump errors
		}
	});

	// Health
	app.get("/health", (c) =>
		c.json({
			status: "ok",
			service: "claude-api-proxy",
			version: "1.0.0",
			target: c.get("config").targetBaseUrl,
			timestamp: new Date().toISOString(),
		}),
	);

	// Routes
	app.route("/v1/messages", handleMessagesRoute());

	// Root
	app.get("/", (c) => c.redirect("/health"));

	return app;
}
