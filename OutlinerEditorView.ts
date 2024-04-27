import {
	App,
	Component, Constructor,
	Editor,
	MarkdownFileInfo,
	Menu,
	TextFileView,
	TFile,
	ViewStateResult,
	WorkspaceLeaf
} from "obsidian";
import SamplePlugin from "./main";
import { EmbeddableMarkdownEditor } from "./embedEditor";
import { getIndent } from "./utils";
import { ScrollableMarkdownEditor } from "./obsidian-ex";

export function isEmebeddedLeaf(leaf: WorkspaceLeaf) {
	// Work around missing enhance.js API by checking match condition instead of looking up parent
	return leaf.containerEl.matches('.tv-block.tv-leaf-view .workspace-leaf');
}

export const OUTLINER_EDITOR_VIEW_ID = "outliner-editor-view";

// function resolveBacklinkPrototype(backlinkComponent: any) {
// 	const BacklinkComponent = Object.getPrototypeOf(backlinkComponent) as any;
//
// 	return BacklinkComponent.constructor as Constructor<any>;
// }

export class OutlinerEditorView extends TextFileView implements MarkdownFileInfo {
	editors: HTMLElement[] = [];
	app: App;
	editor: Editor;
	filePath: string;
	frontmatter: string;
	tempData: string;

	// backlinksEl: HTMLDivElement;
	// showBacklinks: boolean;

	currentMode: any;
	// backlink: Component;

	// editor: EmbeddableMarkdownEditor;

	constructor(leaf: WorkspaceLeaf, private plugin: SamplePlugin) {
		super(leaf);

		this.app = this.plugin.app;
	}

	hoverPopover: any;

	getViewType() {
		return OUTLINER_EDITOR_VIEW_ID;
	}

	getDisplayText() {
		return this.file?.basename || this.filePath;
	}

	requestSave: () => void;

	setViewData(data: string, clear: boolean) {
		this.data = data;
		this.editor.setValue(this.data.replace(this.frontmatter, '').trimStart());
		// if (clear) {
		// 	this.tempData = "";
		// 	this.frontmatter = "";
		// }
		//
		// this.tempData = data;
		// const finalData = this.frontmatter ? `${this.frontmatter}\n${data}` : data;
		//
		// this.data = finalData;
		// if (this.file) this.app.vault.modify(this.file, finalData);
	}

	getViewData(): string {
		return this.data || "";
	}

	getIcon() {
		return 'file-edit';
	}

	clear() {

	}

	onLoadFile(file: TFile): Promise<void> {
		return super.onLoadFile(file);
	}

	onUnloadFile(file: TFile) {
		return super.onUnloadFile(file);
	}

	onPaneMenu(menu: Menu, source: "more-options" | "tab-header" | string) {
		super.onPaneMenu(menu, source);
		menu.addItem((item) => {
			item
				.setIcon('list')
				.setTitle('Open as Markdown View')
				.onClick(async () => {
					this.plugin.outlinerFileModes[(this.leaf as any).id] = 'markdown';
					await this.plugin.setMarkdownView(this.leaf);
				})
				.setSection?.('pane');
		});
	}

	async onRename(file: TFile): Promise<void> {
		this.filePath = file.path;
		this.file = file;

		await this.setState(
			{
				...this.getState(),
				file: file.path,
			},
			{
				history: false,
			},
		);
		this.updateHeader();
		return super.onRename(file);
	}

	updateTitleBreadcrumbs() {
		// Clear the current title parent element
		this.titleParentEl.empty();

		// Attempt to retrieve the path of the file's parent, if it exists
		const parentPath = this.file?.parent?.path;

		// If a valid path exists and it's not the root directory
		if (parentPath && parentPath !== '/') {
			// Split the path by '/' to get each part of the path
			const parts = parentPath.split('/');

			// Iterate over each part of the path to create breadcrumbs
			parts.forEach((part, index) => {
				// Join the parts of the path up to the current index to form the breadcrumb's path
				const pathToHere = parts.slice(0, index + 1).join('/');

				// Create the breadcrumb span and add a click listener
				const breadcrumbSpan = this.titleParentEl.createSpan({
					cls: 'view-header-breadcrumb',
					text: part,
				});
				breadcrumbSpan.addEventListener('click', () => {
					const fileExplorerPlugin = this.app.internalPlugins.getEnabledPluginById('file-explorer');
					if (fileExplorerPlugin) {
						const file = this.app.vault.getAbstractFileByPath(pathToHere);
						if (file) {
							fileExplorerPlugin.revealInFolder(file);
						}
					}
				});

				// Create the separator span
				this.titleParentEl.createSpan({
					cls: 'view-header-breadcrumb-separator',
					text: '/',
				});
			});
		}
	}

	updateHeader() {
		this.titleEl.setText(this.file?.basename || this.filePath);
		this.leaf.updateHeader();
		setTimeout(() => {
			this.leaf.tabHeaderInnerTitleEl.setText(this.file?.basename || this.filePath);
		}, 20);
		this.updateTitleBreadcrumbs();
		this.titleEl.onclick = () => {
			if (!this.file) return;
			this.app.fileManager.promptForFileRename(this.file);
		};
	}

	// updateShowBacklinks() {
	// 	if (this.backlinksEl.isShown()) {
	// 		this.editor.updateBottomPadding();
	// 	}
	// 	// this.backlinks = this.addChild(new iZ(this.app, this.backlinksEl)),
	// 	// this.currentMode === this.editor.owner.editMode && this.editor.owner.editMode.onResize();
	// }


	createEditor(container: HTMLElement) {
		const embedEditor = new EmbeddableMarkdownEditor(this.app, container, {
			// onEscape: (editor) => {
			// 	new Notice(`Escaped the editor: (${editor.initial_value})`);
			// 	this.removeChild(editor);
			// },
			onEnter: (editor, mod: boolean, shift: boolean) => {
				if (!shift) {
					const {line, ch} = (editor.editor as Editor).getCursor();
					const lineText = editor.editor.getLine(line);

					const range = app.plugins.getPlugin('obsidian-zoom').getZoomRange(editor.editor);
					// const range = getZoomRange(editorView.state);
					const indentNewLine = getIndent(app);

					if (range) {
						const firstLineInRange = range.from.line;
						const lastLineInRange = range.to.line;
						const spaceOnFirstLine = editor.editor.getLine(firstLineInRange)?.match(/^\s*/)?.[0];
						const lastLineInRangeText = editor.editor.getLine(lastLineInRange);

						const cursor = editor.editor.getCursor();
						const lineText = editor.editor.getLine(cursor.line);

						if (lineText.trim().startsWith('-')) {
							const currentLine = cursor.line;
							const currentLineText = editor.editor.getLine(currentLine);
							const spaceOnCurrentLine = currentLineText.match(/^\s*/)?.[0];

							editor.editor.transaction({
								changes: [
									{
										text: `\n${spaceOnCurrentLine}${spaceOnCurrentLine.length > spaceOnFirstLine.length ? '' : indentNewLine}- `,
										from: {
											line: cursor.line,
											ch: cursor.ch || 0,
										}
									}
								],
								selection: {
									from: {
										line: cursor.line + 1,
										ch: 2 + (`${spaceOnCurrentLine}${spaceOnCurrentLine.length > spaceOnFirstLine.length ? '' : indentNewLine}`.length)
									},
									to: {
										line: cursor.line + 1,
										ch: 2 + (`${spaceOnCurrentLine}${spaceOnCurrentLine.length > spaceOnFirstLine.length ? '' : indentNewLine}`.length)
									}
								}
							});
							return true;
						}

						const spaceOnLastLine = lastLineInRangeText?.match(/^\s*/)?.[0];

						if (lastLineInRangeText.trim() === '-' && spaceOnLastLine === (spaceOnFirstLine + indentNewLine)) {
							editor.editor.transaction({
								changes: [
									{
										text: `\n${spaceOnFirstLine}${indentNewLine}- `,
										from: {
											line: lastLineInRange,
											ch: lastLineInRangeText.length || 0,
										}
									}
								],
								selection: {
									from: {
										line: lastLineInRange + 1,
										ch: 2 + (`${spaceOnFirstLine}${indentNewLine}`.length)
									},
									to: {
										line: lastLineInRange + 1,
										ch: 2 + (`${spaceOnFirstLine}${indentNewLine}`.length)
									}
								}
							});
							return true;
						}
					}

					if (lineText.startsWith("- ")) {
						(editor.editor as Editor).transaction({
							changes: [
								{
									text: "\n- ",
									from: {line, ch: ch},
								}
							],
							selection: {
								from: {line: line, ch: ch + 3},
								to: {line: line, ch: ch + 3},
							}
						});
						return true;
					} else if (!lineText.trim()) {
						(editor.editor as Editor).transaction({
							changes: [
								{
									text: "- ",
									from: {line, ch: 0},
								}
							],
							selection: {
								from: {line: line, ch: 2},
								to: {line: line, ch: 2},
							}
						});
						return true;
					}
				}
				return false;
			},
			onDelete: (editor) => {
				const {line, ch} = (editor.editor as Editor).getCursor();
				const lineText = editor.editor.getLine(line);
				if (/^(\s*?)-\s/g.test(lineText) && lineText.trim() === '-') {
					if (line === 0) {
						return true;
					}

					const range = app.plugins.getPlugin('obsidian-zoom').getZoomRange(editor.editor);
					if (range) {
						const firstLineInRange = range.from.line;
						if (firstLineInRange === line) {
							return true;
						}
					}

					(editor.editor as Editor).transaction({
						changes: [
							{
								text: "",
								from: {line: line - 1, ch: editor.editor.getLine(line - 1).length},
								to: {line, ch: ch},
							}
						],
					});
					return true;
				} else if (/^\s+$/g.test(lineText)) {
					console.log('empty line', lineText);
					(editor.editor as Editor).transaction({
						changes: [
							{
								text: "",
								from: {line: line - 1, ch: editor.editor.getLine(line - 1).length},
								to: {line, ch: ch},
							}
						]
					});
					return true;
				}

				return false;
			},
			// onSubmit: (editor) => {
			// 	new Notice(`Submitted on the editor: (${editor.value})`);
			// 	this.removeChild(editor as unknown as Component);
			// },
			// onFocus: (editor) => {
			// 	new Notice(`Focused the editor: (${editor.initial_value})`);
			// 	this.editor = editor.editor;
			// },
			onIndent: (editor, mod: boolean, shift: boolean) => {
				console.log('indent', mod, shift);
				if (shift) {
					const range = app.plugins.getPlugin('obsidian-zoom').getZoomRange(editor.editor);

					if (range) {
						const firstLineInRange = range.from.line;
						const lastLineInRange = range.to.line;

						console.log('range', range);
						const spaceOnFirstLine = editor.editor.getLine(firstLineInRange)?.match(/^\s*/)?.[0];
						const lastLineInRangeText = editor.editor.getLine(lastLineInRange);
						const spaceOnLastLine = lastLineInRangeText?.match(/^\s*/)?.[0];
						const indentNewLine = getIndent(app);

						if (firstLineInRange === lastLineInRange) return true;

						if (spaceOnFirstLine === spaceOnLastLine || (spaceOnLastLine === spaceOnFirstLine + indentNewLine)) {
							return true;
						}
					}
				}

				return false;
			},
			getDisplayText: () => this.getDisplayText(),
			getViewType: () => this.getViewType(),
			onChange: (update) => {
				this.data = `${this.frontmatter}\n\n` + update.state.doc.toString();
				this.requestSave();
			},
			// onBlur: (editor) => {
			// 	new Notice(`Unfocused the editor: (${editor.initial_value})`);
			// 	this.removeChild(editor);
			// },
			value: this.tempData || "- ",
			view: this,
		});

		this.editor = embedEditor.editor;
		this.editor.getValue = () => {
			return this.data || "";
		};


		// @ts-expect-error - This is a private method
		return this.addChild(embedEditor);
	}


	async setState(
		state: {
			file: string;
		},
		result: ViewStateResult,
	) {
		if (state && typeof state === 'object') {
			if ('file' in state) {
				this.filePath = state.file;
				const file = this.app.vault.getFileByPath(state.file);
				if (file) {
					const data = await this.app.vault.read(file);
					const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatterPosition;
					let finalData = data;

					if (frontmatter) {
						const frontmatterStart = frontmatter.start.line;
						const frontmatterEnd = frontmatter.end.line;
						const lines = data.split('\n');
						const frontmatterLines = lines.slice(frontmatterStart, frontmatterEnd + 1);
						this.frontmatter = frontmatterLines.join('\n');
						finalData = lines.slice(frontmatterEnd + 1).join('\n');
					}

					this.tempData = finalData.trimStart();

					this.loadEditor();
				}

			}
		}
		await super.setState(state, result);
	}

	getState() {
		return {
			file: this.filePath,
		};
	}

	loadEditor() {
		const container = this.containerEl.children[1] as HTMLElement;
		container.empty();

		container.style.display = 'flex';
		container.style.flexDirection = 'column';
		container.style.gap = '1%';

		const editorContainer = container.createDiv({cls: 'outliner-editor '});
		editorContainer.style.height = "100%";
		// editorContainer.style.border = "1px solid var(--background-modifier-border)";

		this.editors.push(editorContainer);
		this.createEditor(editorContainer);
	}

	async onOpen() {
		// this.backlinksEl = createDiv("embedded-backlinks");
		// this.backlinksEl.hide();
		// this.showBacklinks = this.app.workspace.backlinkInDocument;
		//
		//
		// if (!this.plugin.backlinkComponent) {
		// 	this.registerEvent(
		// 		this.app.workspace.on('backlinks:open', (
		// 			backlinkComponent: any,
		// 		) => {
		// 			console.log(backlinkComponent);
		// 			const backlinkConstructor = resolveBacklinkPrototype(backlinkComponent);
		// 			const component = new (backlinkConstructor as any)(this.app, this.backlinksEl);
		// 			console.log('backlink-open', component, backlinkConstructor);
		// 			this.backlink = this.addChild(component);
		// 			this.backlinksEl.show();
		// 		})
		// 	);
		// } else {
		// 	const backlinkConstructor = resolveBacklinkPrototype(this.plugin.backlinkComponent);
		// 	const component = new (backlinkConstructor as any)(this.app, this.backlinksEl);
		// 	console.log('backlink-open', component, backlinkConstructor);
		// 	this.backlink = this.addChild(component);
		// 	this.backlinksEl.show();
		// }
		//
		// this.updateShowBacklinks();
	}
}
