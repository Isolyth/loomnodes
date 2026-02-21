const GRAPH_KEY = 'loomnodes:graph';
const SETTINGS_KEY = 'loomnodes:settings';

export function saveGraph(data: unknown): void {
	try {
		localStorage.setItem(GRAPH_KEY, JSON.stringify(data));
	} catch {
		// localStorage full or unavailable
	}
}

export function loadGraph<T>(): T | null {
	try {
		const raw = localStorage.getItem(GRAPH_KEY);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

export function saveSettings(data: unknown): void {
	try {
		localStorage.setItem(SETTINGS_KEY, JSON.stringify(data));
	} catch {
		// localStorage full or unavailable
	}
}

export function loadSettings<T>(): T | null {
	try {
		const raw = localStorage.getItem(SETTINGS_KEY);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}

const EMBEDDINGS_KEY = 'loomnodes:embeddings';

export function saveEmbeddings(data: unknown): void {
	try {
		localStorage.setItem(EMBEDDINGS_KEY, JSON.stringify(data));
	} catch {
		// localStorage full or unavailable
	}
}

export function loadEmbeddings<T>(): T | null {
	try {
		const raw = localStorage.getItem(EMBEDDINGS_KEY);
		return raw ? (JSON.parse(raw) as T) : null;
	} catch {
		return null;
	}
}
