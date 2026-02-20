import { DEFAULT_SETTINGS, type LoomSettings } from '$lib/types/settings.js';
import { loadSettings, saveSettings } from '$lib/utils/persistence.js';

function createSettingsStore() {
	let settings = $state<LoomSettings>({ ...DEFAULT_SETTINGS });

	function init() {
		const saved = loadSettings<LoomSettings>();
		if (saved) {
			settings = { ...DEFAULT_SETTINGS, ...saved };
		}
	}

	function update(partial: Partial<LoomSettings>) {
		settings = { ...settings, ...partial };
		saveSettings(settings);
	}

	function reset() {
		settings = { ...DEFAULT_SETTINGS };
		saveSettings(settings);
	}

	return {
		get current() {
			return settings;
		},
		init,
		update,
		reset
	};
}

export const settingsStore = createSettingsStore();
