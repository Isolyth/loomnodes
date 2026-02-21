import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { requests, apiBaseUrl, apiKey, maxParallel = 10, ...sharedBody } = await request.json();

	const url = `${apiBaseUrl.replace(/\/+$/, '')}/completions`;
	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};
	if (apiKey) {
		headers['Authorization'] = `Bearer ${apiKey}`;
	}

	const encoder = new TextEncoder();

	const stream = new ReadableStream({
		async start(controller) {
			function send(event: { id: string; type: string; text?: string }) {
				controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
			}

			async function processRequest(req: { id: string; prompt: string }) {
				try {
					const response = await fetch(url, {
						method: 'POST',
						headers,
						body: JSON.stringify({ ...sharedBody, prompt: req.prompt, stream: true })
					});

					if (!response.ok || !response.body) {
						let message = `API error: ${response.status}`;
						try {
							const err = await response.json();
							message = err.error?.message || message;
						} catch {
							// use default
						}
						send({ id: req.id, type: 'error', text: message });
						return;
					}

					const reader = response.body.getReader();
					const decoder = new TextDecoder();
					let buffer = '';

					while (true) {
						const { done, value } = await reader.read();
						if (done) break;

						buffer += decoder.decode(value, { stream: true });
						const lines = buffer.split('\n');
						buffer = lines.pop() ?? '';

						for (const line of lines) {
							const trimmed = line.trim();
							if (!trimmed || trimmed.startsWith(':')) continue;

							if (trimmed === 'data: [DONE]') {
								send({ id: req.id, type: 'done' });
								return;
							}

							if (trimmed.startsWith('data: ')) {
								try {
									const data = JSON.parse(trimmed.slice(6));
									const text =
										data.choices?.[0]?.text ??
										(typeof data.content === 'string' ? data.content : null);
									if (text != null) {
										send({ id: req.id, type: 'token', text });
									}
								} catch {
									// skip malformed JSON
								}
							}
						}
					}

					// Process remaining buffer
					if (buffer.trim()) {
						const trimmed = buffer.trim();
						if (trimmed.startsWith('data: ') && trimmed !== 'data: [DONE]') {
							try {
								const data = JSON.parse(trimmed.slice(6));
								const text =
									data.choices?.[0]?.text ??
									(typeof data.content === 'string' ? data.content : null);
								if (text != null) {
									send({ id: req.id, type: 'token', text });
								}
							} catch {
								// skip
							}
						}
					}

					send({ id: req.id, type: 'done' });
				} catch (err) {
					send({
						id: req.id,
						type: 'error',
						text: err instanceof Error ? err.message : 'Unknown error'
					});
				}
			}

			// Run with concurrency limit
			const tasks = requests.map(
				(req: { id: string; prompt: string }) => () => processRequest(req)
			);
			const executing = new Set<Promise<void>>();
			for (const task of tasks) {
				const p = task().then(() => {
					executing.delete(p);
				});
				executing.add(p);
				if (executing.size >= maxParallel) {
					await Promise.race(executing);
				}
			}
			await Promise.all(executing);

			controller.enqueue(encoder.encode('data: [DONE]\n\n'));
			controller.close();
		}
	});

	return new Response(stream, {
		headers: {
			'Content-Type': 'text/event-stream',
			'Cache-Control': 'no-cache',
			Connection: 'keep-alive'
		}
	});
};
