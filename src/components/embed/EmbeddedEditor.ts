import {
	App,
	Component,
	debounce,
	Editor,
	ExtraButtonComponent,
	Keymap,
	TFile,
} from "obsidian";
import { CalculateRangeForZooming } from "../../cm/CalculateRangeForZooming";
import {
	hideFrontMatterEffect,
	zoomInEffect,
	zoomWithHideIndentEffect,
} from "../../cm/VisibleRangeController";
import { KeepRangeVisible } from "../../cm/KeepRangeVisible";
import OutlinerViewPlugin from "../../OutlinerViewIndex";
import {
	EditorFactory,
	EditorType,
} from "../../editor-components/EditorFactory";
import { editorRangeUtils } from "../../utils/editorRangeUtils";

export class EmbeddedEditor extends Component {
	plugin: OutlinerViewPlugin;
	app: App;
	editor: Editor | undefined;

	file: TFile | undefined;
	subpath: string | undefined;
	data: string | undefined;

	sourcePath: string;
	sourceFile: TFile | undefined;

	containerEl: HTMLElement;

	range:
		| { from: number; to: number }
		| { from: number; to: number }[]
		| undefined;

	calculateRangeForZooming = new CalculateRangeForZooming();
	KeepOnlyZoomedContentVisible = new KeepRangeVisible();

	constructor(
		plugin: OutlinerViewPlugin,
		e: {
			sourcePath: string;
			app: App;
			containerEl: HTMLElement;
		},
		file: TFile,
		subpath: string,
		readonly targetRange?: { from: number; to: number },
		readonly initData?: string
	) {
		super();
		this.plugin = plugin;
		this.app = e.app;
		this.containerEl = e.containerEl;

		this.sourcePath = e.sourcePath;
		this.file = file;
		this.subpath = subpath;
	}

	async onload() {
		super.onload();

		const targetFile = this.file;
		if (!targetFile) return;

		// If we have initial data, create editor directly
		if (this.initData && this.targetRange) {
			this.data = this.initData;
			this.createEditor();
		} else {
			// Otherwise read the file then create editor
			const data = await this.app.vault.read(targetFile);
			this.data = data;
			this.createEditor();
		}

		// Register for file changes
		this.registerEvent(
			this.app.metadataCache.on("changed", (file) => {
				this.updateFile(file);
			})
		);
	}

	updateFile = debounce(async (file: TFile) => {
		if (file.path === this.file?.path) {
			const data = await this.app.vault.read(file);
			if (this.data === data) return;

			this.data = data;

			// Update editor content if it exists
			if (this.editor) {
				this.editor.replaceRange(
					data,
					{
						line: 0,
						ch: 0,
					},
					this.editor.offsetToPos(this.editor.cm.state.doc.length)
				);

				const targetRange = this.getRange(file);
				this.range = {
					from: targetRange.from,
					to: targetRange.to,
				};

				if (targetRange.type !== "whole") {
					editorRangeUtils.updateVisibleRange(
						this.editor,
						this.range,
						targetRange.type as "part" | "block" | "heading"
					);
				}

				if (
					targetRange.type === "whole" &&
					this.plugin.settings.hideFrontmatter
				) {
					editorRangeUtils.updateFrontMatterVisible(
						this.editor,
						this.app,
						this.file
					);
				}
			}
		}
	}, 800);

	async onunload() {
		super.onunload();
	}

	onFileChanged(file: TFile) {
		console.log(file);
	}

	loadFile(file: TFile, subpath: string) {}

	debounceHover = debounce(
		(extraButton: ExtraButtonComponent, e: MouseEvent) => {
			if (!this.file) return;

			this.app.workspace.trigger("hover-link", {
				event: e,
				source: "outliner-md",
				hoverParent: this.containerEl,
				targetEl: extraButton.extraSettingsEl,
				linktext: this.file.path,
			});
		},
		200
	);

	requestSave = debounce(async (file: TFile, data: string) => {
		if (file) {
			this.data = data;
			await this.app.vault.modify(file, data);
		}
	}, 400);

	longWaitUpdate = debounce((data: string) => {
		this.data = data;
	});

	createEditor() {
		if (!this.file) return;

		const targetRange = this.getRange(this.file);
		this.range = {
			from: targetRange.from,
			to: targetRange.to,
		};

		// Use our new factory to create the editor
		const { editor, updateRange } = EditorFactory.createEditor(
			EditorType.EMBEDDED,
			{
				app: this.app,
				containerEl: this.containerEl,
				file: this.file,
				subpath: this.subpath,
				targetRange: this.targetRange,
				data: this.data,
				plugin: this.plugin,
				disableTimeFormat: !this.plugin.settings.timeFormatWidget,
				onSave: (file, data) => this.requestSave(file, data),
			}
		);

		this.editor = editor;

		// Add the ability to update ranges if needed
		if (updateRange) {
			this.updateRange = updateRange;
		}

		// Add UI elements for specific cases
		this.addUIElements(targetRange.type);

		return this.editor;
	}

	addUIElements(rangeType: string) {
		if (this.targetRange && this.containerEl) {
			this.addBacklinkButton();
		}

		if (rangeType !== "part") {
			this.addSourceButton();
		}

		// Check for readonly flag
		const title = this.containerEl.getAttr("alt");
		if (title) {
			if (title === "readonly" || title.contains("readonly")) {
				this.addReadonlyButton();
			}
		}
	}

	addBacklinkButton() {
		const backLinkBtn = this.containerEl.createEl("div", {
			cls: "backlink-btn",
		});

		const extraButton = new ExtraButtonComponent(backLinkBtn).setIcon(
			"file-symlink"
		);

		this.registerDomEvent(extraButton.extraSettingsEl, "mouseover", (e) => {
			if (!this.file || !this.targetRange || !this.editor) return;

			const line = this.editor.cm.state.doc.lineAt(
				this.targetRange.from + 1
			);

			if (!line) return;
			const state = {
				scroll: line.number,
			};

			this.app.workspace.trigger("hover-link", {
				event: e,
				source: "outliner-md",
				hoverParent: this.containerEl,
				targetEl: extraButton.extraSettingsEl,
				linktext: this.file.path,
				state: state,
			});
		});
	}

	addSourceButton() {
		const button = this.containerEl.createEl("div", {
			cls: "source-btn embedded-editor-btn",
		});

		const extraButton = new ExtraButtonComponent(button).setIcon("link");

		this.registerDomEvent(
			extraButton.extraSettingsEl,
			"click",
			async (e) => {
				if (Keymap.isModEvent(e)) {
					const leaf = this.app.workspace.getLeaf();
					await leaf.setViewState({
						type: "markdown",
					});
					this.file && (await leaf.openFile(this.file));
				}
			}
		);

		this.registerDomEvent(extraButton.extraSettingsEl, "mouseover", (e) =>
			this.debounceHover(extraButton, e)
		);
	}

	addReadonlyButton() {
		this.containerEl.toggleClass("readonly", true);

		const button = this.containerEl.createEl("div", {
			cls: "lock-btn",
		});

		let locked = true;

		const component = new ExtraButtonComponent(button)
			.setIcon("lock")
			.onClick(() => {
				if (!this.editor) return;

				// For simplicity, recreate the editor with the opposite readonly state
				if (this.file && this.data) {
					EditorFactory.createEditor(EditorType.EMBEDDED, {
						app: this.app,
						containerEl: this.containerEl,
						file: this.file,
						subpath: this.subpath,
						targetRange: this.targetRange,
						data: this.data,
						plugin: this.plugin,
						disableTimeFormat:
							!this.plugin.settings.timeFormatWidget,
						readOnly: !locked,
						onSave: (file, data) => this.requestSave(file, data),
					});
				}

				locked = !locked;
				component.setIcon(locked ? "lock" : "unlock");
				this.containerEl.toggleClass("readonly", locked);
			});
	}

	public updateRange(range: { from: number; to: number }) {
		this.range = {
			from: range.from,
			to: range.to,
		};

		if (this.editor) {
			editorRangeUtils.updateVisibleRange(this.editor, range, "part");
		}
	}

	getRange(targetFile: TFile) {
		return editorRangeUtils.getRange(
			this.app,
			targetFile,
			this.subpath,
			this.targetRange,
			this.data
		);
	}

	updateVisibleRange(
		editor: Editor,
		range:
			| { from: number; to: number }
			| {
					from: number;
					to: number;
			  }[],
		type: "part" | "block" | "heading"
	) {
		if (Array.isArray(range)) {
			const wholeRanges = range.map((r) => {
				return (
					this.calculateRangeForZooming.calculateRangeForZooming(
						editor.cm.state,
						r.from
					) || {
						from: r.from,
						to: r.to,
					}
				);
			});
			this.KeepOnlyZoomedContentVisible.keepRangesVisible(
				editor.cm,
				wholeRanges
			);

			for (const r of wholeRanges) {
				const firstLine = editor.cm.state.doc.lineAt(r.from);
				const firstLineIndent = firstLine.text.match(/^\s*/)?.[0];

				if (firstLineIndent) {
					editor.cm.dispatch({
						effects: zoomWithHideIndentEffect.of({
							range: {
								from: r.from,
								to: r.to,
							},
							indent: firstLineIndent,
						}),
					});
				}
			}
			// for(const r of range) {
			// 	editor.cm.dispatch({
			// 		effects: [zoomInEffect.of(r)]
			// 	});
			// }
		} else {
			// if(range.from === 0 && range.to === this.editor?.cm.state.doc.length) return;
			if (type === "part") {
				const cache = this.app.metadataCache.getFileCache(
					this.file as TFile
				);

				const blockCache = cache?.sections?.find((key) => {
					return (
						key.type === "table" &&
						key.position.start.offset < range.from &&
						key.position.end.offset > range.to
					);
				});

				if (blockCache) {
					this.editor?.editorComponent.toggleSource();
				}

				editor.cm.dispatch({
					effects: [
						zoomInEffect.of({
							from: range.from,
							to: range.to,
							type: "part",
							container: this.targetRange
								? undefined
								: this.containerEl,
						}),
					],
				});

				// this.editor?.editorComponent.toggleSource();
				// this.updateIndentVisible(
				// 	editor,
				// 	range
				// );
				this.containerEl.toggleClass("embedded-part", true);
				return;
			}

			const newRange =
				this.calculateRangeForZooming.calculateRangeForZooming(
					editor.cm.state,
					range.from
				);

			// console.log('newRange', newRange, range);

			if (newRange) {
				editor.cm.dispatch({
					effects: [zoomInEffect.of(newRange)],
				});
				const firstLine = editor.cm.state.doc.lineAt(newRange.from);
				const firstLineIndent = firstLine.text.match(/^\s*/)?.[0];
				if (firstLineIndent) {
					editor.cm.dispatch({
						effects: zoomWithHideIndentEffect.of({
							range: {
								from: newRange.from,
								to: newRange.to,
							},
							indent: firstLineIndent,
						}),
					});
				}
			} else {
				editor.cm.dispatch({
					effects: [zoomInEffect.of(range)],
				});
			}

			// editor.cm.dispatch(
			// {
			// 	effects: [zoomInEffect.of(range)]
			// });
		}
	}

	updateIndentVisible(editor: Editor, range: { from: number; to: number }) {
		const firstLine = editor.cm.state.doc.lineAt(range.from);
		const firstLineIndent = firstLine.text.match(/^\s*/)?.[0];
		if (firstLineIndent) {
			editor.cm.dispatch({
				effects: zoomWithHideIndentEffect.of({
					range: {
						from: range.from,
						to: range.to,
					},
					indent: firstLineIndent,
				}),
			});
		}
	}

	updateFrontMatterVisible(editor: Editor, file: TFile) {
		const cache = this.app.metadataCache.getFileCache(file);
		const frontMatter = cache?.frontmatterPosition;

		if (frontMatter) {
			editor.cm.dispatch({
				effects: hideFrontMatterEffect.of({
					range: {
						from: frontMatter.start.offset,
						to: frontMatter.end.offset,
					},
				}),
			});
		}
	}
}
