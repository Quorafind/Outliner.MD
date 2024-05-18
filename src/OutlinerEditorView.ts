import {
	App,
	Editor,
	type MarkdownFileInfo,
	Menu,
	Scope,
	SearchComponent,
	Setting,
	TextFileView,
	TFile,
	type ViewStateResult,
	WorkspaceLeaf
} from "obsidian";
import OutlinerViewPlugin from "./OutlinerViewIndex";
import { EmbeddableMarkdownEditor } from "./editor-components/MarkdownEditor";
import { getIndent } from "./utils/utils";
import { hideRangesEffect } from "./cm/VisibleRangeController";
import { EditorView } from "@codemirror/view";
import { ClearSearchHighlightEffect } from "./cm/SearchHighlight";
import { foldable } from "@codemirror/language";
import { KeepRangeVisible } from "./cm/KeepRangeVisible";
import { SelectionAnnotation } from "./cm/SelectionController";

export function isEmebeddedLeaf(leaf: WorkspaceLeaf) {
	// Work around missing enhance.js API by checking match condition instead of looking up parent
	return leaf.containerEl.matches('.tv-block.tv-leaf-view .workspace-leaf');
}

export const OUTLINER_EDITOR_VIEW_ID = "outliner-editor-view";

export class OutlinerEditorView extends TextFileView implements MarkdownFileInfo {
	// editors: HTMLElement[] = [];
	app: App;
	editor: Editor | undefined;
	filePath: string = "";
	frontmatter: string = "";
	fileContentData: string = "";

	filteredValue: string = "";

	KeepOnlyZoomedContentVisible: KeepRangeVisible = new KeepRangeVisible();

	searchActionEl: HTMLElement | undefined;
	clearFilterBtn: HTMLElement | undefined;

	changedBySelf: boolean = false;

	inlineTitleEl: HTMLElement = createEl('div', {cls: 'inline-title'});

	hideCompleted: boolean = false;

	// backlinksEl: HTMLDivElement;
	// showBacklinks: boolean;

	currentMode: any;
	// backlink: Component;

	// editor: EmbeddableMarkdownEditor;

	constructor(leaf: WorkspaceLeaf, private plugin: OutlinerViewPlugin) {
		super(leaf);

		this.app = this.plugin.app;
		this.scope = new Scope(this.app.scope);
	}

	hoverPopover: any;

	getViewType() {
		return OUTLINER_EDITOR_VIEW_ID;
	}

	getDisplayText() {
		return this.file?.basename || this.filePath;
	}

	setViewData(data: string, clear: boolean) {


		if (data.replace(this.frontmatter, '').trimStart() === this.fileContentData.trimStart()) {
			// new Notice('No changes to save');


			return;
		}

		if (!this.editor) return;

		this.editor.replaceRange(
			data.replace(this.frontmatter, '').trimStart(), {
				line: 0,
				ch: 0
			}, this.editor.offsetToPos(this.editor.cm.state.doc.length)
		);

		// this.editor.scrollTo(null, currentScrollInfo.top);

		this.data = data;
	}

	getViewData(): string {
		return this.data || "";
	}

	getIcon() {
		return 'list';
	}

	clear() {

	}

	onLoadFile(file: TFile): Promise<void> {
		// this.inl;

		return super.onLoadFile(file);
	}

	onUnloadFile(file: TFile) {
		return super.onUnloadFile(file);
	}

	onPaneMenu(menu: Menu, source: "more-options" | "tab-header" | string) {
		super.onPaneMenu(menu, source);
		menu.addItem((item) => {
			item
				.setIcon('file-edit')
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

		this.inlineTitleEl.setText(this.file?.basename || this.filePath);
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

					const range = this.app.plugins.getPlugin('obsidian-zoom')?.getZoomRange(editor.editor);
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

					const prevLine = line > 0 ? editor.editor.getLine(line - 1) : "";

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
					} else if (!lineText.trim() && (/^(-|\*|\d+\.)(\s\[.\])?/g.test(prevLine.trim()))) {
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
					} else if (/^\s+/g.test(lineText) && !(/^(-|\*|\d+\.)(\s\[.\])?/g.test(lineText.trim()))) {
						const currentIndent = lineText.match(/^\s+/)?.[0];

						(editor.editor as Editor).transaction({
							changes: [
								{
									text: `\n${currentIndent}`,
									from: {line, ch},
								}
							],
							selection: {
								from: {line: line + 1, ch: currentIndent.length},
								to: {line: line + 1, ch: currentIndent.length},
							}
						});
						return true;
					}

					if (/^(-|\*|\d+\.)(\s\[.\])?/g.test(lineText.trim())) {
						const range = foldable(editor.editor.cm.state, editor.editor.posToOffset({
							line,
							ch: 0
						}), editor.editor.posToOffset({line: line + 1, ch: 0}) - 1);
						const indentNewLine = getIndent(this.app);
						const spaceBeforeStartLine = lineText.match(/^\s+/)?.[0] || "";
						if (range) {
							let foundValidLine = false;

							const startLineNum = editor.editor.cm.state.doc.lineAt(range.from).number;
							for (let i = startLineNum + 1; i < (editor.editor as Editor).cm.state.doc.lines; i++) {
								const line = (editor.editor as Editor).cm.state.doc.line(i);
								const lineText = line.text;

								// 检查行是否有缩进并且不以列表标记开始
								if (/^\s+/.test(lineText) && !(/^(-|\*|\d+\.)\s/.test(lineText.trimStart()))) {
									foundValidLine = true;
								} else {
									// 遇到不满足条件的行，检查是否已经遍历过至少一行
									if (foundValidLine) {
										const currentLine = (editor.editor as Editor).cm.state.doc.line(i - 1);
										if (currentLine.to === range.to) {
											(editor.editor as Editor).transaction({
												changes: [
													{
														text: `${spaceBeforeStartLine}- \n`,
														from: {line: i - 1, ch: 0},
													}
												]
											});
											(editor.editor as Editor).cm.dispatch({
												selection: {
													head: line.from,
													anchor: line.from,
												}
											});
											return true;
										} else {
											(editor.editor as Editor).cm.dispatch({
												changes: {
													insert: `${spaceBeforeStartLine}${indentNewLine}- \n`,
													from: line.from,
												}
											});
											(editor.editor as Editor).cm.dispatch({
												selection: {
													head: line.from,
													anchor: line.from,
												}
											});
											return true;
										}


									}
									return false;
								}
							}
						}
						return false;
					}
				}
				if (shift) {
					const {line, ch} = (editor.editor as Editor).getCursor();
					const charOffset = (editor.editor as Editor).posToOffset({line, ch});
					const charLine = (editor.editor as Editor).cm.state.doc.lineAt(charOffset);

					if (/^\s+/g.test(charLine.text) && !(/^(-|\*|\d+\.)(\s\[.\])?/g.test(charLine.text.trimStart()))) {
						const lineNum = charLine.number;

						for (let i = lineNum; i >= 1; i--) {
							const lineCursor = (editor.editor as Editor).cm.state.doc.line(i);
							const lineText = lineCursor.text;
							if (/^(-|\*|\d+\.)(\s\[.\])?/g.test(lineText.trimStart())) {
								const currentLine = (editor.editor as Editor).cm.state.doc.line(i);
								(editor.editor as Editor).cm.dispatch({
									selection: {
										head: currentLine.to,
										anchor: currentLine.to,
									},
									annotations: SelectionAnnotation.of('arrow.up.selection'),
								});

								return true;
							}
						}
					} else if ((/^(-|\*|\d+\.)(\s\[.\])?/g.test(charLine.text.trimStart()))) {
						const startLineNum = charLine.number;
						let foundValidLine = false;

						for (let i = startLineNum + 1; i < (editor.editor as Editor).cm.state.doc.lines; i++) {
							const line = (editor.editor as Editor).cm.state.doc.line(i);
							const lineText = line.text;

							// 检查行是否有缩进并且不以列表标记开始
							if (/^\s+/.test(lineText) && !(/^(-|\*|\d+\.)\s/.test(lineText.trimStart()))) {
								foundValidLine = true;
							} else {
								// 遇到不满足条件的行，检查是否已经遍历过至少一行
								if (foundValidLine) {
									const currentLine = (editor.editor as Editor).cm.state.doc.line(i - 1);
									(editor.editor as Editor).cm.dispatch({
										selection: {
											head: currentLine.to,
											anchor: currentLine.to,
										},
										annotations: SelectionAnnotation.of('arrow.up.selection'),
									});
									// new Notice('No valid line found');
									return true;
								}
								return false;
							}
						}
						if (foundValidLine) {
							const lastLine = (editor.editor as Editor).cm.state.doc.line((editor.editor as Editor).cm.state.doc.lines - 1);
							(editor.editor as Editor).cm.dispatch({
								selection: {
									head: lastLine.to,
									anchor: lastLine.to,
								},
								// annotations: SelectionAnnotation.of('arrow.up.selection'),
							});
							return true;
						}
						return false;
					}
				}


				return false;
			},
			onDelete: (editor) => {
				const {line, ch} = (editor.editor as Editor).getCursor();
				const lineText = editor.editor.getLine(line);

				const lineFrom = editor.editor.posToOffset({line, ch: 0});
				const lineTo = editor.editor.posToOffset({line: line + 1, ch: 0}) - 1;

				const foldRange = foldable(editor.editor.cm.state, lineFrom, lineTo);

				if (/^(\s*?)((-|\*|\d+\.)(\s\[.\])?)\s/g.test(lineText) && /^((-|\*|\d+\.)(\s\[.\])?)$/g.test(lineText.trim())) {
					if (line === 0) {
						return true;
					}

					if (foldRange) {
						return true;
					}

					const range = this.app.plugins.getPlugin('obsidian-zoom')?.getZoomRange(editor.editor);
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
				if (shift) {
					const range = this.app.plugins.getPlugin('obsidian-zoom')?.getZoomRange(editor.editor);

					if (range) {
						const firstLineInRange = range.from.line;
						const lastLineInRange = range.to.line;

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
			onArrowUp: (editor, mod: boolean, shift: boolean) => {
				if (shift) {
					let currentLine = (editor.editor as Editor).cm.state.doc.lineAt((editor.editor as Editor).cm.state.selection.main.from);
					const selection = (editor.editor as Editor).cm.state.selection.ranges[0];

					if (selection.from === currentLine.from) {
						currentLine = (editor.editor as Editor).cm.state.doc.lineAt(currentLine.from - 1);
					}

					const foldableRange = foldable(editor.editor.cm.state, currentLine.from, currentLine.to);


					if (foldableRange) {
						if (!/^(-|\*|\d{1,}\.)/.test(currentLine.text.trim())) {
							(editor.editor as Editor).cm.dispatch({
								selection: {
									head: foldableRange.from - currentLine.length,
									anchor: currentLine.to,
								},
								annotations: SelectionAnnotation.of('arrow.up.selection'),
							});
							return true;
						}

						(editor.editor as Editor).cm.dispatch({
							selection: {
								head: foldableRange.from - currentLine.length,
								anchor: foldableRange.to,
							},
							annotations: SelectionAnnotation.of('arrow.up.selection'),
						});
						return true;
					}

					(editor.editor as Editor).cm.dispatch({
						selection: {
							head: editor.editor.cm.state.doc.line(currentLine.number).to,
							anchor: editor.editor.cm.state.doc.line(currentLine.number).from,
						},
						annotations: SelectionAnnotation.of('arrow.up.selection'),
					});
					return true;

				}
				return false;
			},
			onArrowDown: (editor, mod: boolean, shift: boolean) => {
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
			type: 'outliner',
			foldByDefault: true,
		});


		this.editor = embedEditor.editor as Editor;
		this.editor.getValue = () => {
			return this.data || "";
		};

		// setTimeout(() => {
		// 	this.editor.setCursor(0, 0);
		// }, 1000);


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
					try {
						this.loadEditor();
					} catch (e) {
						console.log(e);
					}
					setTimeout(() => {
						if (!this.editor) return;
						this.editor.focus();
						const content = this.editor.getValue();
						this.editor.setCursor(content.length - 1);

						this.editor.editorComponent.sizerEl?.prepend(this.inlineTitleEl);
						this.inlineTitleEl.setText(file?.basename || this.filePath);
					}, 200);

					// console.log('set state', this.editor, this.editor.cm);
					// @ts-ignore
					// this.editor.editorComponent.sizerEl?.prepend(this.inlineTitleEl);
					// this.inlineTitleEl.setText(file?.basename || this.filePath);
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

		// this.editors.push(editorContainer);
		this.createEditor(editorContainer);
	}

	filter(view: EditorView, search: string) {
		if (search === "") {
			// console.log('show all', this.editor, view);
			this.plugin.KeepOnlyZoomedContentVisible?.showAllContent(view);
			this.filteredValue = "";
			this.contentEl.toggleClass('filtered', false);
			if (!this.editor) return;
			view.dispatch({
				effects: ClearSearchHighlightEffect.of()
			});
			return;
		}

		const ranges = this.plugin.calculateRangeForZooming.calculateRangesBasedOnSearch(
			view,
			this.editor?.getAllFoldableLines() || [],
			search
		);

		this.filteredValue = search;
		this.plugin.KeepOnlyZoomedContentVisible?.keepRangesVisible(view, ranges);
		this.contentEl.toggleClass('filtered', true);
	}

	hideCompletedItems(view: EditorView) {
		if (this.hideCompleted) {
			this.plugin.KeepOnlyZoomedContentVisible?.showAllContent(view);
			this.hideCompleted = false;
			return;
		}

		// const ranges = this.editor.getAllFoldableLines().filter((range) => {
		// 	const line = view.state.doc.lineAt(range.from);
		// 	const text = line.text.trim();
		// 	return !/^(-|\*|\d+\.)(\s\[.\])?$/g.test(text);
		// });

		// console.log(ranges);

		const ranges = this.plugin.calculateRangeForZooming.calculateRangesBasedOnType(view, 'completed');

		if (!this.editor) return;
		this.editor.cm.dispatch({
			effects: [hideRangesEffect.of({
				ranges: ranges
			})]
		});
		this.hideCompleted = true;


	}


	registerSearchActionBtn() {
		const showCompletedEl = this.addAction("check", "Show Completed", (evt) => {
			this.editor && this.hideCompletedItems(this.editor.cm);
			showCompletedEl.toggleClass('hide-completed', this.hideCompleted);
		});

		this.searchActionEl = this.addAction("search", "Search", (evt) => {
			const searchMenu = new Menu();
			searchMenu.dom.toggleClass('search-menu', true);
			let block = false;
			searchMenu.addItem((item) => {
				const itemDom = (item as any).dom;
				item.setIsLabel(true);
				// let tempValue = "";
				const settingEl = new Setting(itemDom)
					.setName("Filter")
					.addSearch((search) => {
						search.setValue(this.filteredValue).onChange((value) => {
							if (block) return;
							this.editor && this.editor.cm.dispatch({
								effects: ClearSearchHighlightEffect.of()
							});

							this.editor && this.filter(this.editor.cm, value);
						});


						search.clearButtonEl.addEventListener('click', () => {
							this.filter(this.editor?.cm as EditorView, "");
							searchMenu.hide();

						});

						search.inputEl.addEventListener('compositionstart', () => {
							block = true;
						});
						search.inputEl.addEventListener('compositionend', () => {
							block = false;
							if (!this.editor) return;
							this.filter(this.editor.cm, search.inputEl.value);
						});
					});


				item.onClick((e) => {
					e.preventDefault();
					e.stopImmediatePropagation();
					(settingEl.components[0] as SearchComponent).inputEl.focus();
				});
			});
			if (!this.searchActionEl) return;
			const {x, y} = this.searchActionEl.getBoundingClientRect();
			searchMenu.showAtPosition({
				x: x + this.searchActionEl.offsetHeight,
				y: y + this.searchActionEl.offsetHeight
			});

			searchMenu.onHide(() => {
				if (!this.editor) return;
				this.editor.focus();
			});

			document.body.find('.search-menu input')?.focus();
		});

		this.clearFilterBtn = this.addAction("filter-x", "Clear Filter", (evt) => {
			this.editor && this.filter(this.editor.cm, "");

		});
		this.clearFilterBtn.toggleClass('filter-clear', true);


	}

	public search() {
		if (!this.searchActionEl) return;
		this.searchActionEl.click();
		document.body.find('.search-menu input')?.focus();
	}

	public searchWithText(text: string) {
		if (!this.searchActionEl) return;
		this.searchActionEl.click();

		const searchInput = document.body.find('.search-menu input') as HTMLInputElement;
		searchInput?.focus();
		searchInput.value = text;
		searchInput.dispatchEvent(new Event('input'));

	}

	async onOpen() {
		this.load();
		this.registerSearchActionBtn();
	}

	onunload() {
		super.onunload();
		this.searchActionEl && this.searchActionEl.detach();
		this.clearFilterBtn && this.clearFilterBtn.detach();
		this.filteredValue = "";
	}
}
