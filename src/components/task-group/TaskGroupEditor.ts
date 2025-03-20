import { App, Component, debounce, Editor, setIcon, TFile } from "obsidian";
import { getAPI } from "obsidian-dataview";
import OutlinerViewPlugin from "../../OutlinerViewIndex";
import { OutlinerViewSettings } from "../../OutlinerViewSettings";
import {
	EditorFactory,
	EditorType,
} from "../../editor-components/EditorFactory";
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
			console.error(e);
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

	getDisplayText() {
		return this.file?.basename || "Untitled";
	}

	getViewType() {
		return "outliner";
	}

	async onunload() {
		super.onunload();
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

		// Use our factory to create the editor
		const { editor, component } = EditorFactory.createEditor(
			EditorType.TASK_GROUP,
			{
				app: this.app,
				containerEl: container,
				file: file,
				data: data,
				foldByDefault: true,
				disableTimeFormat: !this.settings.timeFormatWidget,
				onSave: (file, data) => {
					if (this.changedBySelf) {
						this.changedBySelf = false;
						return;
					}
					this.editing = true;
					this.requestSave(file.path, data);
				},
			}
		);

		// Store the editor and component for later updates
		this.editorMap.set(path, editor);
		this.editorComponentMap.set(path, component);
		this.contentMap.set(path, data);

		// Update the visibility range
		editorRangeUtils.updateVisibleRange(editor, range);

		return editor;
	}

	updateResultEl(length: number) {
		this.containerEl.toggleClass(
			"cm-task-group-result-empty",
			length === 0
		);
		this.containerEl
			.find(".cm-task-group-result")
			.setText(length.toString() + " results");
	}

	async initEditor() {
		const api = getAPI(this.app);
		if (!api) return;

		const result = await api.query(`TASK  
FROM ""  
WHERE contains(text, "${this.settings.taskGroupQuery}")
GROUP BY file.path`);

		if (!result.successful) return;
		const values = result.value.values;

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
				this.app.workspace.openLinkText(v.key, "", true, {
					active: true,
				});
			};

			this.settings.foldTaskGroup && taskGroupContainer.hide();
			collapseButton.toggleClass(
				"cm-task-container-collapsed",
				!taskGroupContainer.isShown()
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
					this.createEditor(taskGroupContainer, v.key, data, ranges);
				}
			}
		}

		this.updateResultEl(count);
	}

	debounceUpdateEditor = debounce((file: TFile, oldPath?: string) => {
		this.updateEditor(file, oldPath);
	}, 1000);

	async updateEditor(file: TFile, oldPath?: string) {
		if (this.editing) return;

		const api = getAPI(this.app);
		if (!api) return;

		const result = await api.query(`TASK  
FROM ""  
WHERE contains(text, "${this.settings.taskGroupQuery}")
GROUP BY file.path`);

		if (!result.successful) return;
		const values = result.value.values;

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
				const targetFile = this.app.vault.getFileByPath(v.key);
				if (!targetFile) continue;

				const editor = this.editorMap.get(targetFile?.path);
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

						// Update visibility range
						editorRangeUtils.updateVisibleRange(editor, ranges);
					}
				}
			} else {
				// Create new editor for this file
				const myfile = this.app.vault.getFileByPath(v.key);
				if (!myfile) continue;

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
					this.app.workspace.openLinkText(v.key, "", true, {
						active: true,
					});
				};

				this.settings.foldTaskGroup && taskGroupContainer.hide();
				collapseButton.toggleClass(
					"cm-task-container-collapsed",
					!taskGroupContainer.isShown()
				);

				const data = await this.app.vault.read(myfile);
				this.createEditor(taskGroupContainer, v.key, data, ranges);
				this.contentMap.set(myfile.path, data);
			}
		}

		this.updateResultEl(count);
	}
}
