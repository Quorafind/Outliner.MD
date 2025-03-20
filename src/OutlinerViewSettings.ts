import OutlinerViewPlugin from "./OutlinerViewIndex";
import { App, debounce, PluginSettingTab, setIcon, Setting } from "obsidian";

export interface OutlinerViewSettings {
	editableBacklinks: boolean;
	livePreviewForBacklinks: boolean;
	editableBlockEmbeds: boolean;
	hideFrontmatter: boolean;
	timeFormatWidget: boolean;
	dragAndDrop: boolean;

	noteAsNotebook: boolean;
	markForSplitSections: string;

	showFullBtnAtLeftSide: boolean;

	alwaysShowSectionHeader: boolean;
	autoHideEmptySectionHeader: boolean;
	showSectionTitle: boolean;

	markForSplitPages: string;

	foldTaskGroup: boolean;
	taskGroupQuery: string;
	paperLayout: boolean;
	// boldText: boolean;
}

export const DEFAULT_SETTINGS: OutlinerViewSettings = {
	editableBacklinks: true,
	livePreviewForBacklinks: false,
	editableBlockEmbeds: true,
	hideFrontmatter: false,
	timeFormatWidget: true,
	dragAndDrop: true,

	noteAsNotebook: false,
	markForSplitSections: "%%SECTION{NAME}%%",

	showFullBtnAtLeftSide: false,
	alwaysShowSectionHeader: true,
	showSectionTitle: true,

	autoHideEmptySectionHeader: false,

	markForSplitPages: "++PAGE{NAME}++",

	foldTaskGroup: true,
	taskGroupQuery: "#now",
	paperLayout: true,
	// boldText: true,
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
		true
	);

	debounceDisplay = debounce(
		async () => {
			await this.display();
		},
		400,
		true
	);

	applySettingsUpdate() {
		this.debounceApplySettingsUpdate();
	}

	async display() {
		await this.plugin.loadSettings();

		const { containerEl } = this;
		const settings = this.plugin.settings;

		containerEl.toggleClass("outliner-view-setting-container", true);

		containerEl.empty();

		this.initGlobalSettings(containerEl, settings);
		this.initBacklinkSettings(containerEl, settings);
		this.initBlockEmbedSettings(containerEl, settings);
		this.initPageBookSettings(containerEl, settings);
		this.initTaskGroupSettings(containerEl, settings);
		this.styleSettings(containerEl, settings);
	}

	initGlobalSettings(
		containerEl: HTMLElement,
		settings: OutlinerViewSettings
	) {
		const editorSettingDesc = document.createDocumentFragment();

		editorSettingDesc.createEl("div", {
			text: "You can disable some internal editor plugins from Outliner.md.",
		});

		const editorSettingName = document.createDocumentFragment();
		editorSettingName.createEl("span", "", (el) => {
			setIcon(el, "pencil");
		});
		editorSettingName.createEl("span", { text: " Editor" });

		new Setting(containerEl)
			.setHeading()
			.setName(editorSettingName)
			.setDesc(editorSettingDesc);

		const disableTimeFormatSetting = new Setting(containerEl)
			.setName("Time picker")
			.addButton((button) =>
				button.setButtonText("Reload").onClick(() => {
					window.location.reload();
				})
			)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.timeFormatWidget)
					.onChange(async (value) => {
						settings.timeFormatWidget = value;
						this.applySettingsUpdate();

						disableTimeFormatSetting.settingEl.toggleClass(
							"show-reload-button",
							true
						);
					})
			);

		const dragNdrop = new Setting(containerEl)
			.setName("Drag and drop [Experimental]")
			.addButton((button) =>
				button.setButtonText("Reload").onClick(() => {
					window.location.reload();
				})
			)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.dragAndDrop)
					.onChange(async (value) => {
						settings.dragAndDrop = value;
						this.applySettingsUpdate();

						dragNdrop.settingEl.toggleClass(
							"show-reload-button",
							true
						);
					})
			);
	}

	initBacklinkSettings(
		containerEl: HTMLElement,
		settings: OutlinerViewSettings
	) {
		const backlinkSettingDesc = document.createDocumentFragment();
		// Backlink docs related to https://docs.outliner.md/pages/20240514151617
		backlinkSettingDesc
			.createEl("div", {
				text: "Backlinks are the links that point to the current note. You can make backlinks editable and enable live preview for backlinks.",
			})
			.createEl("span", { text: " Note: " })
			.createEl("a", {
				text: "Live preview for backlinks",
				attr: { href: "https://docs.outliner.md/pages/20240514151617" },
			});
		backlinkSettingDesc.createEl(
			"span",
			{
				text: "After ",
			},
			(el) => {
				el.createEl("a", {
					text: "0.1.9",
					attr: {
						href: "https://github.com/quorafind/outliner.md/releases/tag/0.1.9",
					},
				});
				el.createEl("span", {
					text: ", you can edit search result and also query in page.",
				});
			}
		);

		const backlinkSettingName = document.createDocumentFragment();
		backlinkSettingName.createEl("span", "", (el) => {
			setIcon(el, "link");
		});
		backlinkSettingName.createEl("span", {
			text: " Backlink & Search result",
		});

		new Setting(containerEl)
			.setHeading()
			.setName(backlinkSettingName)
			.setDesc(backlinkSettingDesc);

		const backlinkSetting = new Setting(containerEl)
			.setName("Editable backlinks/search result")
			.addButton((button) =>
				button.setButtonText("Reload").onClick(() => {
					window.location.reload();
				})
			)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.editableBacklinks)
					.onChange(async (value) => {
						settings.editableBacklinks = value;
						this.applySettingsUpdate();

						backlinkSetting.settingEl.toggleClass(
							"show-reload-button",
							true
						);
					})
			);

		if (settings.editableBacklinks) {
			const livePreviewSetting = new Setting(containerEl)
				.setName("Live preview for backlinks")
				.addButton((button) =>
					button.setButtonText("Reload").onClick(() => {
						window.location.reload();
					})
				)
				.addToggle((toggle) =>
					toggle
						.setValue(settings.livePreviewForBacklinks)
						.onChange(async (value) => {
							settings.livePreviewForBacklinks = value;
							this.applySettingsUpdate();

							livePreviewSetting.settingEl.toggleClass(
								"show-reload-button",
								true
							);
						})
				);
		}
	}

	initBlockEmbedSettings(
		containerEl: HTMLElement,
		settings: OutlinerViewSettings
	) {
		const blockEmbedSettingDesc = document.createDocumentFragment();
		// Block embed docs related to https://docs.outliner.md/pages/20240517162521
		blockEmbedSettingDesc
			.createEl("div", {
				text: "Block embeds are the blocks that are embedded in the current note. You can make block embeds editable.",
			})
			.createEl("span", { text: " Note: " })
			.createEl("a", {
				text: "Block embeds",
				attr: { href: "https://docs.outliner.md/pages/20240517162521" },
			});

		const blockEmbedSettingName = document.createDocumentFragment();
		blockEmbedSettingName.createEl("span", "", (el) => {
			setIcon(el, "toy-brick");
		});
		blockEmbedSettingName.createEl("span", { text: " Block embed" });

		new Setting(containerEl)
			.setHeading()
			.setName(blockEmbedSettingName)
			.setDesc(blockEmbedSettingDesc);

		const blockEmbedSetting = new Setting(containerEl)
			.setName("Editable block embeds")
			.setDesc(blockEmbedSettingDesc)
			.addButton((button) =>
				button.setButtonText("Reload").onClick(() => {
					window.location.reload();
				})
			)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.editableBlockEmbeds)
					.onChange(async (value) => {
						settings.editableBlockEmbeds = value;
						this.applySettingsUpdate();

						blockEmbedSetting.settingEl.toggleClass(
							"show-reload-button",
							true
						);
					})
			);

		if (settings.editableBlockEmbeds) {
			const hideFrontMatterSetting = new Setting(containerEl)
				.setName("Hide frontmatter")
				.addButton((button) =>
					button.setButtonText("Reload").onClick(() => {
						window.location.reload();
					})
				)
				.addToggle((toggle) =>
					toggle
						.setValue(settings.hideFrontmatter)
						.onChange(async (value) => {
							settings.hideFrontmatter = value;
							this.applySettingsUpdate();

							hideFrontMatterSetting.settingEl.toggleClass(
								"show-reload-button",
								true
							);
						})
				);
		}
	}

	initPageBookSettings(
		containerEl: HTMLElement,
		settings: OutlinerViewSettings
	) {
		const nameFragment = document.createDocumentFragment();
		nameFragment.createEl("span", "", (el) => {
			setIcon(el, "book-open-text");
		});
		nameFragment.createEl(
			"span",
			{
				text: "Note as notebook",
			},
			(el) => {
				el.createEl("span", { text: "  " });
				el.createEl("mark", {
					text: " new!",
				});
			}
		);
		const descriptionFragment = document.createDocumentFragment();
		descriptionFragment
			.createEl("div", {
				text: "Turn the note into a notebook, you can split the note into sections. You need to reload the Obsidian after changing this setting.",
			})
			.createEl("span", { text: " Note: " })
			.createEl("a", {
				text: "Note as book",
				attr: { href: "https://docs.outliner.md/pages/20240517162521" },
			});

		new Setting(containerEl)
			.setHeading()
			.setName(nameFragment)
			.setDesc(descriptionFragment);

		new Setting(containerEl)
			.setName("Turn the note into a notebook")
			.addToggle((toggle) =>
				toggle
					.setValue(settings.noteAsNotebook)
					.onChange(async (value) => {
						settings.noteAsNotebook = value;
						this.applySettingsUpdate();

						this.debounceDisplay();
					})
			);

		if (settings.noteAsNotebook) {
			const sectionFragment = document.createDocumentFragment();
			sectionFragment.createEl("p", {
				text: "The mark to split the note into sections. Currently, it is not configurable.",
			});
			sectionFragment.createEl("strong", {
				text: "By default, it is ",
			});
			sectionFragment.createEl("code", {
				text: "%%SECTION{NAME}%%",
			});
			sectionFragment.createEl("strong", {
				text: ". Or section mark from lineage: ",
			});
			sectionFragment.createEl("code", {
				text: "<!--section: DIGIT-->",
			});
			sectionFragment
				.createEl("span", { text: " Note: " })
				.createEl("a", {
					text: "Lineage",
					attr: {
						href: "https://github.com/ycnmhd/obsidian-lineage",
					},
				});

			new Setting(containerEl)
				.setName("Mark to split the note into sections")
				.setDesc(sectionFragment);

			new Setting(containerEl)
				.setName("Always show section tabs header")
				.addToggle((toggle) =>
					toggle
						.setValue(settings.alwaysShowSectionHeader)
						.onChange(async (value) => {
							settings.alwaysShowSectionHeader = value;
							this.applySettingsUpdate();
						})
				);

			new Setting(containerEl)
				.setName("Move show full document button to the left")
				.addToggle((toggle) =>
					toggle
						.setValue(settings.showFullBtnAtLeftSide)
						.onChange(async (value) => {
							settings.showFullBtnAtLeftSide = value;
							this.applySettingsUpdate();

							document.body.toggleClass(
								"omd-change-section-btns-order",
								value
							);
						})
				);

			new Setting(containerEl)
				.setName("Hide empty section header automatically")
				.addToggle((toggle) =>
					toggle
						.setValue(settings.autoHideEmptySectionHeader)
						.onChange(async (value) => {
							settings.autoHideEmptySectionHeader = value;
							this.applySettingsUpdate();

							document.body.toggleClass(
								"omd-hide-empty-section-header",
								value
							);
						})
				);

			new Setting(containerEl)
				.setName("Show section title")
				.addToggle((toggle) =>
					toggle
						.setValue(settings.showSectionTitle)
						.onChange(async (value) => {
							settings.showSectionTitle = value;
							this.applySettingsUpdate();

							document.body.toggleClass(
								"omd-show-section-title",
								value
							);
						})
				);
		}
	}

	initTaskGroupSettings(
		containerEl: HTMLElement,
		settings: OutlinerViewSettings
	) {
		const taskGroupSettingDesc = document.createDocumentFragment();
		// Task group docs related to https://docs.outliner.md/pages/20240605162521
		taskGroupSettingDesc
			.createEl("div", {
				text: "Task group is a group of tasks that you can fold and unfold. You can set a custom query string for task group.",
			})
			.createEl("span", { text: " Note: " })
			.createEl("a", {
				text: "Task group",
				attr: { href: "https://docs.outliner.md/pages/20240516203128" },
			});

		const taskGroupSettingName = document.createDocumentFragment();
		taskGroupSettingName.createEl("span", "", (el) => {
			setIcon(el, "check-square");
		});
		taskGroupSettingName.createEl("span", { text: " Task group" });

		new Setting(containerEl)
			.setHeading()
			.setName(taskGroupSettingName)
			.setDesc(taskGroupSettingDesc);

		const taskGroupSetting = new Setting(containerEl)
			.setName("Fold task group when loading page")
			.addButton((button) =>
				button.setButtonText("Reload").onClick(() => {
					window.location.reload();
				})
			)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.foldTaskGroup)
					.onChange(async (value) => {
						settings.foldTaskGroup = value;
						this.applySettingsUpdate();

						taskGroupSetting.settingEl.toggleClass(
							"show-reload-button",
							true
						);
					})
			);

		new Setting(containerEl)
			.setName("Task group query string")
			.setDesc(
				"Custom query string for task group, you can set a tag or word for task querying. After changing this setting, you need to reload the page."
			)
			.addText((text) => {
				text.setPlaceholder("#now")
					.setValue(settings.taskGroupQuery)
					.onChange(async (value) => {
						settings.taskGroupQuery = value;
						this.applySettingsUpdate();
					});
			});
	}

	styleSettings(containerEl: HTMLElement, settings: OutlinerViewSettings) {
		const styleSettingDesc = document.createDocumentFragment();
		styleSettingDesc.createEl("div", {
			text: "You can change the style of Outliner.md.",
		});

		const styleSettingName = document.createDocumentFragment();
		styleSettingName.createEl("span", "", (el) => {
			setIcon(el, "palette");
		});
		styleSettingName.createEl("span", { text: " Style" });

		new Setting(containerEl)
			.setHeading()
			.setName(styleSettingName)
			.setDesc(styleSettingDesc);

		const paperLayoutSettingDesc = document.createDocumentFragment();
		paperLayoutSettingDesc
			.createEl("div", {
				text: "Paper layout is a layout that looks like a paper. You can enable or disable it.",
			})
			.createEl("span", { text: " Note: " })
			.createEl("a", {
				text: "Paper layout",
				attr: { href: "https://docs.outliner.md/pages/20240519131652" },
			});

		new Setting(containerEl)
			.setName("Paper layout")
			.setDesc(paperLayoutSettingDesc)
			.addToggle((toggle) =>
				toggle
					.setValue(settings.paperLayout)
					.onChange(async (value) => {
						settings.paperLayout = value;
						this.applySettingsUpdate();

						document.body.toggleClass(
							"outliner-paper-layout",
							value
						);
						// styleSetting.settingEl.toggleClass('show-reload-button', true);
					})
			);

		const moreStyleSettings = document.createDocumentFragment();
		moreStyleSettings
			.createEl("div", {
				text: "More style settings are in the Obsidian style settings plugin.",
			})
			.createEl("span", { text: " Note: " })
			.createEl("a", {
				text: "Obsidian style settings",
				attr: {
					href: "https://github.com/mgmeyers/obsidian-style-settings",
				},
			});

		new Setting(containerEl)
			.setName("More style settings")
			.setDesc(moreStyleSettings)
			.addButton((button) =>
				button.setButtonText("Open").onClick(() => {
					const existStyleSettingsPlugin = this.app.plugins.getPlugin(
						"obsidian-style-settings"
					);
					if (existStyleSettingsPlugin) {
						(
							this.app as App & {
								setting: any;
							}
						).setting.openTabById("obsidian-style-settings");
					} else {
						window.open(
							"obsidian://show-plugin?id=obsidian-style-settings"
						);
					}
				})
			);

		// new Setting(containerEl)
		// 	.setName('Bold text')
		// 	.addToggle(toggle => toggle.setValue(settings.boldText).onChange(async (value) => {
		// 		settings.boldText = value;
		// 		this.applySettingsUpdate();
		//
		// 		document.body.toggleClass('outliner-bold-text', value);
		// 		// styleSetting.settingEl.toggleClass('show-reload-button', true);
		// 	}));
	}
}
