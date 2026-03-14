// default open-next.config.ts file created by @opennextjs/cloudflare
import { defineCloudflareConfig, type OpenNextConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

const config: OpenNextConfig = {
	...defineCloudflareConfig({
	incrementalCache: r2IncrementalCache,
	}),
	buildCommand: "npm run build:next",
};

export default config;
