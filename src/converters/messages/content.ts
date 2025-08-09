import type { AnthropicContentBlock } from "../../schemas/index.ts";
import type { OpenAIContentPart } from "../../types.ts";

export function convertAnthropicContentToOpenAI(
	content: string | AnthropicContentBlock[],
): string | OpenAIContentPart[] {
	if (typeof content === "string") {
		return content;
	}
	const parts: OpenAIContentPart[] = [];
	for (const block of content) {
		if (block.type === "text") {
			parts.push({ type: "text", text: block.text });
		} else if (block.type === "image") {
			const { media_type, data } = block.source;
			parts.push({
				type: "image_url",
				image_url: { url: `data:${media_type};base64,${data}` },
			});
		}
	}
	return parts.length === 1 && parts[0].type === "text" ? parts[0].text : parts;
}

export function convertOpenAIContentToAnthropic(
	content: string | OpenAIContentPart[],
): string | AnthropicContentBlock[] {
	if (typeof content === "string") {
		return content;
	}
	const blocks: AnthropicContentBlock[] = [];
	for (const part of content) {
		if (part.type === "text") {
			blocks.push({ type: "text", text: part.text });
		} else if (part.type === "image_url") {
			const url = part.image_url.url;
			if (!url.startsWith("data:")) {
				throw new Error(
					"Remote image URLs are not supported for Anthropic conversion",
				);
			}
			const match = url.match(/^data:([^;]+);base64,(.*)$/);
			if (!match) {
				throw new Error("Invalid data URL for image");
			}
			const mediaType = match[1];
			const data = match[2];
			blocks.push({
				type: "image",
				source: { type: "base64", media_type: mediaType, data },
			} as AnthropicContentBlock);
		}
	}
	return blocks;
}
