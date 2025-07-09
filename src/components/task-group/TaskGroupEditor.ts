import { App, Component, debounce, Editor, setIcon, TFile } from "obsidian";
import { getAPI } from "obsidian-dataview";
import OutlinerViewPlugin from "../../OutlinerViewIndex";
import { OutlinerViewSettings } from "../../OutlinerViewSettings";
import {
	EditorBuilder,
	EditorBuilderResult,
} from "../../editor-components/EditorBuilder";
import { EditorType } from "../../editor-components/EditorTypes";
import { EditorFactory } from "../../editor-components/EditorFactory";
import { editorRangeUtils } from "../../utils/editorRangeUtils";

export class TaskGroupEditor extends Component {
	app: App;
	editor: Editor | undefined;
	filePath: string | undefined;
	file: TFile | null | undefined;

	data: string | undefined;
	range: { from: number; to: number } | undefined;

	contentMap: Map<string, string> = new Map();
	editorMap: Map<string, Editor> = new Map();
	editorComponentMap: Map<string, Component> = new Map();
	// Track editor results for better management
	private editorResults: Map<string, EditorBuilderResult> = new Map();

	indexed: boolean = false;
	changedBySelf: boolean = false;
	editing: boolean = false;
	settings: OutlinerViewSettings;

	constructor(app: App, readonly containerEl: HTMLElement) {
		super();
		this.app = app;
	}

	async onload() {
		super.onload();

		try {
			this.settings = (
				(this.app.plugins.getPlugin("outliner-md") ||
					this.app.plugins.getPlugin(
						"outliner-md-beta"
					)) as OutlinerViewPlugin
			).settings;
		} catch (e) {
			console.error("Failed to load plugin settings:", e);
		}

		this.initEditor();

		this.registerEvent(
			this.app.metadataCache.on("dataview:index-ready", () => {
				this.initEditor();
				this.indexed = true;
			})
		);

		this.registerEvent(
			this.app.metadataCache.on(
				"dataview:metadata-change",
				(type: any, file: TFile, oldPath?: string | undefined) => {
					if (!this.indexed) return;
					this.debounceUpdateEditor(file, oldPath);
				}
			)
		);
	}

	async onunload() {
		// Clean up all editor instances
		for (const [path, result] of this.editorResults.entries()) {
			if (result.editorId) {
				try {
					await EditorFactory.destroyManagedEditor(result.editorId);
				} catch (error) {
					console.error(
						`Error destroying managed editor for ${path}:`,
						error
					);
				}
			}
		}
		this.editorResults.clear();
		this.editorMap.clear();
		this.editorComponentMap.clear();
		this.contentMap.clear();

		super.onunload();
	}

	getDisplayText() {
		return this.file?.basename || "Untitled";
	}

	getViewType() {
		return "outliner";
	}

	requestSave = debounce(async (path: string, data: string) => {
		const file = this.app.vault.getFileByPath(path);
		if (file) {
			this.editing = false;
			await this.app.vault.modify(file, data);
		}
	}, 3000);

	createEditor(
		container: HTMLElement,
		path: string,
		data: string,
		range: { from: number; to: number } | { from: number; to: number }[]
	) {
		const file = this.app.vault.getFileByPath(path);
		if (!file) return;

		// Use EditorBuilder for better configuration management
		const result = EditorBuilder.taskGroup()
			.withApp(this.app)
			.inContainer(container)
			.forFile(file)
			.withData(data)
			.disableTimeFormat(!this.settings.timeFormatWidget)
			.withLifecycleManagement(true) // Enable lifecycle management for better resource management
			.withEventHandlers({
				onSave: (file, data) => {
					if (this.changedBySelf) {
						this.changedBySelf = false;
						return;
					}
					this.editing = true;
					this.requestSave(file.path, data);
				},
			})
			.build();

		// Store all the editor information for later updates and cleanup
		this.editorMap.set(path, result.editor);
		this.editorComponentMap.set(path, result.component);
		this.editorResults.set(path, result);
		this.contentMap.set(path, data);

		// Update the visibility range using the new architecture
		if (result.updateRange && !Array.isArray(range)) {
			result.updateRange(range);
		} else {
			// Fallback to direct range utils for array ranges
			editorRangeUtils.updateVisibleRange(result.editor, range);
		}

		return result.editor;
	}

	updateResultEl(length: number) {
		this.containerEl.toggleClass(
			"cm-task-group-result-empty",
			length === 0
		);
		this.containerEl
			.find(".cm-task-group-result")
			.setText(`${length} results`);
	}

	async initEditor() {
		const api = getAPI(this.app);
		if (!api) return;

		try {
			const result = await api.query(`TASK  
FROM ""  
WHERE contains(text, "${this.settings.taskGroupQuery}")
GROUP BY file.path`);

			if (!result.successful) return;
			const { values } = result.value;

			let count = 0;

			for (const v of values) {
				if (!v.key || this.editorMap.has(v.key)) continue;

				const linkHeader = this.containerEl.createEl("div", {
					cls: "cm-task-group-header",
				});
				const taskGroupContainer = this.containerEl.createEl("div", {
					cls: "cm-task-container",
				});
				const collapseButton = linkHeader.createEl("span", {
					cls: "cm-group-collapse-button",
				});
				setIcon(collapseButton, "chevron-right");

				const titleEl = linkHeader.createEl("span", {
					cls: "cm-group-title",
					text: v.key,
				});

				this.setupTaskGroupUI(
					collapseButton,
					taskGroupContainer,
					titleEl,
					v.key
				);

				if (this.app.vault.getFileByPath(v.key)) {
					const file = this.app.vault.getFileByPath(v.key);

					const ranges = v.rows.map((r: { position: any }) => {
						count++;
						return {
							from: r.position.start.offset,
							to: r.position.end.offset,
						};
					});

					if (file) {
						const data = await this.app.vault.read(file);
						this.createEditor(
							taskGroupContainer,
							v.key,
							data,
							ranges
						);
					}
				}
			}

			this.updateResultEl(count);
		} catch (error) {
			console.error("Error initializing task group editor:", error);
		}
	}

	private setupTaskGroupUI = (
		collapseButton: HTMLElement,
		taskGroupContainer: HTMLElement,
		titleEl: HTMLElement,
		filePath: string
	) => {
		collapseButton.onclick = () => {
			taskGroupContainer.isShown()
				? taskGroupContainer.hide()
				: taskGroupContainer.show();
			collapseButton.toggleClass(
				"cm-task-container-collapsed",
				!taskGroupContainer.isShown()
			);
		};

		titleEl.onclick = () => {
			this.app.workspace.openLinkText(filePath, "", true, {
				active: true,
			});
		};

		this.settings.foldTaskGroup && taskGroupContainer.hide();
		collapseButton.toggleClass(
			"cm-task-container-collapsed",
			!taskGroupContainer.isShown()
		);
	};

	debounceUpdateEditor = debounce((file: TFile, oldPath?: string) => {
		this.updateEditor(file, oldPath);
	}, 1000);

	async updateEditor(file: TFile, oldPath?: string) {
		if (this.editing) return;

		const api = getAPI(this.app);
		if (!api) return;

		try {
			const result = await api.query(`TASK  
FROM ""  
WHERE contains(text, "${this.settings.taskGroupQuery}")
GROUP BY file.path`);

			if (!result.successful) return;
			const { values } = result.value;

			let count = 0;
			for (const v of values) {
				const ranges = v.rows.map((r: { position: any }) => {
					count++;
					return {
						from: r.position.start.offset,
						to: r.position.end.offset,
					};
				});

				if (this.editorMap.has(v.key)) {
					// Update existing editor
					await this.updateExistingEditor(v.key, ranges);
				} else {
					// Create new editor for this file
					await this.createNewEditor(v.key, ranges);
				}
			}

			this.updateResultEl(count);
		} catch (error) {
			console.error("Error updating task group editor:", error);
		}
	}

	private updateExistingEditor = async (
		filePath: string,
		ranges: { from: number; to: number }[]
	) => {
		const targetFile = this.app.vault.getFileByPath(filePath);
		if (!targetFile) return;

		const editor = this.editorMap.get(targetFile.path);
		const editorResult = this.editorResults.get(targetFile.path);

		if (editor) {
			const data = await this.app.vault.read(targetFile);
			const lastContent = this.contentMap.get(targetFile.path);

			if (lastContent !== data) {
				if (this.contentMap.has(targetFile.path)) {
					this.contentMap.set(targetFile.path, data);
				}

				this.changedBySelf = true;

				// Update the editor content
				const lastLine = editor.cm.state.doc.lineAt(
					editor.cm.state.doc.length - 1
				);
				editor.replaceRange(
					data,
					{ line: 0, ch: 0 },
					{ line: lastLine.number, ch: lastLine.length - 1 }
				);
				this.contentMap.set(targetFile.path, data);

				// Update visibility range using the new architecture
				if (editorResult?.updateRange && ranges.length === 1) {
					editorResult.updateRange(ranges[0]);
				} else {
					// Fallback to direct range utils for multiple ranges
					editorRangeUtils.updateVisibleRange(editor, ranges);
				}
			}
		}
	};

	private createNewEditor = async (
		filePath: string,
		ranges: { from: number; to: number }[]
	) => {
		const myfile = this.app.vault.getFileByPath(filePath);
		if (!myfile) return;

		const linkHeader = this.containerEl.createEl("div", {
			cls: "cm-task-group-header",
		});
		const taskGroupContainer = this.containerEl.createEl("div", {
			cls: "cm-task-container",
		});
		const collapseButton = linkHeader.createEl("span", {
			cls: "cm-group-collapse-button",
		});
		setIcon(collapseButton, "chevron-right");

		const titleEl = linkHeader.createEl("span", {
			cls: "cm-group-title",
			text: filePath,
		});

		this.setupTaskGroupUI(
			collapseButton,
			taskGroupContainer,
			titleEl,
			filePath
		);

		const data = await this.app.vault.read(myfile);
		this.createEditor(taskGroupContainer, filePath, data, ranges);
		this.contentMap.set(myfile.path, data);
	};
}
