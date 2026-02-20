import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ request }) => {
	const { apiBaseUrl, apiKey, ...body } = await request.json();

	const url = `${apiBaseUrl.replace(/\/+$/, '')}/completions`;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json'
	};
	if (apiKey) {
		headers['Authorization'] = `Bearer ${apiKey}`;
	}

	const response = await fetch(url, {
		method: 'POST',
		headers,
		body: JSON.stringify(body)
	});

	const data = await response.json();

	if (!response.ok) {
		return json(data, { status: response.status });
	}

	return json(data);
};
