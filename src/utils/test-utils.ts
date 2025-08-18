/**
 * Test utilities for creating streams from async iterables
 */

export function readableFromAsyncIterable<T>(iterable: AsyncIterable<T> | Array<T>): ReadableStream<T> {
	const asyncIterable: AsyncIterable<T> = Array.isArray(iterable)
		? async function* () {
				for (const item of iterable) {
					yield item;
				}
		  }()
		: iterable;

	return new ReadableStream({
		async start(controller) {
			try {
				for await (const chunk of asyncIterable) {
					controller.enqueue(chunk);
				}
				controller.close();
			} catch (error) {
				controller.error(error);
			}
		},
	});
}

export function convertReadableStreamToArray<T>(stream: ReadableStream<T>): Promise<T[]> {
	const reader = stream.getReader();
	const chunks: T[] = [];

	return new Promise((resolve, reject) => {
		function pump(): Promise<void> {
			return reader.read().then(({ done, value }) => {
				if (done) {
					resolve(chunks);
					return;
				}
				chunks.push(value);
				return pump();
			});
		}

		pump().catch(reject);
	});
}

export function createMockLanguageModelV2StreamPart(type: string, data: any = {}) {
	return {
		type,
		...data,
	};
}

export function createMockAnthropicEvent(type: string, data: any = {}) {
	return {
		type,
		...data,
	};
}