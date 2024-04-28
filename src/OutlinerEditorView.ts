import {
	App,
	Component, Constructor,
	Editor,
	MarkdownFileInfo,
	Menu, Scope, Setting,
	TextFileView,
	TFile,
	ViewStateResult,
	WorkspaceLeaf
} from "obsidian";
import SamplePlugin from "./main";
import { EmbeddableMarkdownEditor } from "./embedEditor";
import { getIndent } from "./utils";
import { ScrollableMarkdownEditor } from "./obsidian-ex";
import { KeepOnlyZoomedContentVisible } from "./checkVisible";
import { EditorView } from "@codemirror/view";
import OutlinerViewPlugin from "./main";
import { ClearSearchHighlightEffect, SearchHighlightEffect } from "./SearchHighlight";

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
	fileContentData: string;

	filteredValue: string = "";

	KeepOnlyZoomedContentVisible: KeepOnlyZoomedContentVisible;

	searchActionEl: HTMLElement;
	clearFilterBtn: HTMLElement;

	// backlinksEl: HTMLDivElement;
	// showBacklinks: boolean;

	currentMode: any;
	// backlink: Component;

	// editor: EmbeddableMarkdownEditor;

	constructor(leaf: WorkspaceLeaf, private plugin: OutlinerViewPlugin) {
		super(leaf);

		this.app = this.plugin.app;
		this.scope = new Scope();
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

					const range = this.app.plugins.getPlugin('obsidian-zoom').getZoomRange(editor.editor);
					// const range = getZoomRange(editorView.state);
					const indentNewLine = getIndent(this.app);

					if (range) {
						const firstLineInRange = range.from.line;
						const lastLineInRange = range.to.line;
						const spaceOnFirstLine = editor.editor.getLine(firstLineInRange)?.match(/^\s*/)?.[0];
						const lastLineInRangeText = editor.editor.getLine(lastLineInRange);

						const cursor = editor.editor.getCursor();
						const lineText = editor.editor.getLine(cursor.line);

						if (/^((-|\*|\d+\.)(\s\[.\])?)/g.test(lineText.trim())) {
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

						if (/^((-|\*|\d+\.)(\s\[.\])?)$/g.test(lastLineInRangeText.trim()) && spaceOnLastLine === (spaceOnFirstLine + indentNewLine)) {
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
				if (/^(\s*?)((-|\*|\d+\.)(\s\[.\])?)\s/g.test(lineText) && /^((-|\*|\d+\.)(\s\[.\])?)$/g.test(lineText.trim())) {
					if (line === 0) {
						return true;
					}

					const range = this.app.plugins.getPlugin('obsidian-zoom').getZoomRange(editor.editor);
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
					const range = this.app.plugins.getPlugin('obsidian-zoom').getZoomRange(editor.editor);

					if (range) {
						const firstLineInRange = range.from.line;
						const lastLineInRange = range.to.line;

						console.log('range', range);
						const spaceOnFirstLine = editor.editor.getLine(firstLineInRange)?.match(/^\s*/)?.[0];
						const lastLineInRangeText = editor.editor.getLine(lastLineInRange);
						const spaceOnLastLine = lastLineInRangeText?.match(/^\s*/)?.[0];
						const indentNewLine = getIndent(this.app);

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
			value: this.fileContentData || "- ",
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
					// const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatterPosition;
					const frontmatter = /^---\n[\s\S]*\n---/m.exec(data);
					let finalData = data;

					if (frontmatter) {
						// const frontmatterStart = frontmatter.index;
						const frontmatterEnd = frontmatter.index + frontmatter[0].length;
						this.frontmatter = frontmatter[0];
						finalData = data.substring(frontmatterEnd);
					}

					this.fileContentData = finalData.trimStart();
					this.loadEditor();
					setTimeout(() => {
						this.editor.focus();
						const content = this.editor.getValue();
						this.editor.setCursor(content.length - 1);
					}, 200);
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

		this.editors.push(editorContainer);
		this.createEditor(editorContainer);
	}

	filter(view: EditorView, search: string) {
		if (search === "") {
			this.plugin.KeepOnlyZoomedContentVisible?.showAllContent(view);
			this.filteredValue = "";
			this.contentEl.toggleClass('filtered', false);
			return;
		}

		// console.log();
		const ranges = this.plugin.calculateRangeForZooming.calculateAllShowedContentRanges(
			view,
			this.editor.getAllFoldableLines(),
			search
		);

		this.filteredValue = search;
		this.plugin.KeepOnlyZoomedContentVisible?.keepRangesVisible(view, ranges);
		this.contentEl.toggleClass('filtered', true);
	}


	registerSearchActionBtn() {
		this.searchActionEl = this.addAction("search", "Search", (evt) => {
			const searchMenu = new Menu();
			searchMenu.dom.toggleClass('search-menu', true);
			let block = false;
			searchMenu.addItem((item) => {
				const itemDom = (item as any).dom;
				item.setIsLabel(true);
				let tempValue = "";
				const settingEl = new Setting(itemDom)
					.setName("Filter")
					.addSearch((search) => {
						search.setValue(this.filteredValue).onChange((value) => {
							if (block) return;
							this.editor.cm.dispatch({
								effects: ClearSearchHighlightEffect.of()
							});

							this.filter(this.editor.cm, value);


						});

						search.clearButtonEl.addEventListener('click', () => {
							searchMenu.hide();
						});

						search.inputEl.addEventListener('compositionstart', () => {
							block = true;
						});
						search.inputEl.addEventListener('compositionend', () => {
							block = false;
							this.filter(this.editor.cm, search.inputEl.value);
						});
					});


				item.onClick((e) => {
					e.preventDefault();
					e.stopImmediatePropagation();
					settingEl.components[0].inputEl.focus();
				});
			});
			const {x, y} = this.searchActionEl.getBoundingClientRect();
			searchMenu.showAtPosition({
				x: x + this.searchActionEl.offsetHeight,
				y: y + this.searchActionEl.offsetHeight
			});

			document.body.find('.search-menu input')?.focus();
		});

		this.clearFilterBtn = this.addAction("filter-x", "Clear Filter", (evt) => {
			this.filter(this.editor.cm, "");
		});
		this.clearFilterBtn.toggleClass('filter-clear', true);
	}

	search() {
		this.searchActionEl.click();
		document.body.find('.search-menu input')?.focus();
	}

	async onOpen() {
		this.load();
		this.registerSearchActionBtn();
	}
}
