import { Hono } from "hono";
import { cors } from "hono/cors";
import type { RequestIdVariables } from "hono/request-id";
import { requestId } from "hono/request-id";
import { loadConfig, type ProxyConfig } from "./config";
import { handleMessagesRoute } from "./routes/messages";
import {
	debugRequestMiddleware,
	debugStreamResponseMiddleware,
} from "./utils/debug-middleware";

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

	// Debug middleware (only active when enableDebug is true)
	app.use("/v1/messages", debugRequestMiddleware);
	app.use("/v1/messages", debugStreamResponseMiddleware);

	// Routes
	app.route("/v1/messages", handleMessagesRoute());

	// Root
	app.get("/", (c) => c.redirect("/health"));

	return app;
}
