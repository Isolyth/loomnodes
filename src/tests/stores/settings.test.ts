import { describe, it, expect, beforeEach, vi } from 'vitest';
import { DEFAULT_SETTINGS } from '$lib/types/settings.js';

// Mock localStorage
const storage = new Map<string, string>();
vi.stubGlobal('localStorage', {
	getItem: (key: string) => storage.get(key) ?? null,
	setItem: (key: string, value: string) => storage.set(key, value),
	removeItem: (key: string) => storage.delete(key),
	clear: () => storage.clear()
});

const { settingsStore } = await import('$lib/stores/settings.svelte.js');

describe('settingsStore', () => {
	beforeEach(() => {
		storage.clear();
		settingsStore.reset();
	});

	it('initializes with defaults', () => {
		expect(settingsStore.current.temperature).toBe(DEFAULT_SETTINGS.temperature);
		expect(settingsStore.current.model).toBe(DEFAULT_SETTINGS.model);
		expect(settingsStore.current.apiKey).toBe('');
	});

	it('updates settings', () => {
		settingsStore.update({ temperature: 1.5, model: 'custom-model' });
		expect(settingsStore.current.temperature).toBe(1.5);
		expect(settingsStore.current.model).toBe('custom-model');
		// Others unchanged
		expect(settingsStore.current.maxTokens).toBe(DEFAULT_SETTINGS.maxTokens);
	});

	it('persists to localStorage', () => {
		settingsStore.update({ apiKey: 'sk-test' });
		const saved = JSON.parse(storage.get('loomnodes:settings')!);
		expect(saved.apiKey).toBe('sk-test');
	});

	it('loads from localStorage', () => {
		storage.set(
			'loomnodes:settings',
			JSON.stringify({ ...DEFAULT_SETTINGS, apiKey: 'sk-saved', temperature: 0.3 })
		);
		settingsStore.init();
		expect(settingsStore.current.apiKey).toBe('sk-saved');
		expect(settingsStore.current.temperature).toBe(0.3);
	});

	it('reset restores defaults', () => {
		settingsStore.update({ temperature: 2.0, apiKey: 'sk-test' });
		settingsStore.reset();
		expect(settingsStore.current.temperature).toBe(DEFAULT_SETTINGS.temperature);
		expect(settingsStore.current.apiKey).toBe('');
	});
});
