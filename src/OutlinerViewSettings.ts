import OutlinerViewPlugin from "./OutlinerViewIndex";
import { App, debounce, PluginSettingTab, Setting } from "obsidian";

export interface OutlinerViewSettings {
	editableBacklinks: boolean;
	livePreviewForBacklinks: boolean;
	editableBlockEmbeds: boolean;
	hideFrontmatter: boolean;
}

export const DEFAULT_SETTINGS: OutlinerViewSettings = {
	editableBacklinks: true,
	livePreviewForBacklinks: false,
	editableBlockEmbeds: true,
	hideFrontmatter: false,
};


export class OutlinerViewSettingTab extends PluginSettingTab {
	plugin: OutlinerViewPlugin;

	constructor(app: App, plugin: OutlinerViewPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	debounceApplySettingsUpdate = debounce(
		async () => {
			await this.plugin.saveSettings();
		},
		200,
		true,
	);

	debounceDisplay = debounce(
		async () => {
			await this.display();
		},
		400,
		true,
	);

	applySettingsUpdate() {
		this.debounceApplySettingsUpdate();
	}

	async display() {
		await this.plugin.loadSettings();

		const {containerEl} = this;
		const settings = this.plugin.settings;

		containerEl.toggleClass('outliner-view-setting-container', true);

		containerEl.empty();

		this.initBacklinkSettings(containerEl, settings);
		this.initBlockEmbedSettings(containerEl, settings);
	}


	initBacklinkSettings(containerEl: HTMLElement, settings: OutlinerViewSettings) {
		const backlinkSetting = new Setting(containerEl)
			.setName('Editable backlinks')
			.addButton(button => button.setButtonText('Reload').onClick(() => {
				window.location.reload();
			}))
			.addToggle(toggle => toggle.setValue(settings.editableBacklinks).onChange(async (value) => {
				settings.editableBacklinks = value;
				this.applySettingsUpdate();

				backlinkSetting.settingEl.toggleClass('show-reload-button', true);
			}));

		if (settings.editableBacklinks) {
			const livePreviewSetting = new Setting(containerEl)
				.setName('Live preview for backlinks')
				.addButton(button => button.setButtonText('Reload').onClick(() => {
					window.location.reload();
				}))
				.addToggle(toggle => toggle.setValue(settings.livePreviewForBacklinks).onChange(async (value) => {
					settings.livePreviewForBacklinks = value;
					this.applySettingsUpdate();

					livePreviewSetting.settingEl.toggleClass('show-reload-button', true);
				}));
		}
	}

	initBlockEmbedSettings(containerEl: HTMLElement, settings: OutlinerViewSettings) {
		const blockEmbedSetting = new Setting(containerEl)
			.setName('Editable block embeds')
			.addButton(button => button.setButtonText('Reload').onClick(() => {
				window.location.reload();
			}))
			.addToggle(toggle => toggle.setValue(settings.editableBlockEmbeds).onChange(async (value) => {
				settings.editableBlockEmbeds = value;
				this.applySettingsUpdate();

				blockEmbedSetting.settingEl.toggleClass('show-reload-button', true);
			}));

		if (settings.editableBlockEmbeds) {
			const hideFrontMatterSetting = new Setting(containerEl)
				.setName('Hide frontmatter')
				.addButton(button => button.setButtonText('Reload').onClick(() => {
					window.location.reload();
				}))
				.addToggle(toggle => toggle.setValue(settings.hideFrontmatter).onChange(async (value) => {
					settings.hideFrontmatter = value;
					this.applySettingsUpdate();

					hideFrontMatterSetting.settingEl.toggleClass('show-reload-button', true);
				}));
		}
	}
}
