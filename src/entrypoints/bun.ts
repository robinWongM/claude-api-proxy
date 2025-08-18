#!/usr/bin/env bun

import { createApp } from "../app.ts";
import { loadConfig } from "../config.ts";

async function main() {
	const config = loadConfig();
	const app = createApp(config);

	console.log("🚀 Claude API Proxy (Bun)");
	console.log(`📡 Target API: ${config.targetBaseUrl}`);
	console.log(`🔗 Listening on: http://${config.host}:${config.port}`);

	const server = Bun.serve({
		hostname: config.host,
		port: config.port,
		fetch: (req) => app.fetch(req),
		idleTimeout: 0,
	});

	process.on("SIGINT", () => {
		server.stop();
		process.exit(0);
	});
	process.on("SIGTERM", () => {
		server.stop();
		process.exit(0);
	});
}

if (import.meta.main) {
	main().catch((err) => {
		console.error("Failed to start Bun entrypoint:", err);
		process.exit(1);
	});
}
