import {
	Editor,
	ItemView,
	MarkdownFileInfo,
	MarkdownView,
	Menu,
	moment,
	Notice,
	Plugin,
	TFile,
	TFolder,
	View,
	type ViewState,
	Workspace,
	WorkspaceLeaf
} from 'obsidian';
import { around } from "monkey-around";
import { isEmebeddedLeaf, OUTLINER_EDITOR_VIEW_ID, OutlinerEditorView } from "./OutlinerEditorView";

import { KeepOnlyZoomedContentVisible } from "./keepOnlyZoomedContentVisible";
import { CalculateRangeForZooming } from "./calculateRangeForZooming";
import "./less/global.less";
import { EmbeddedEditor } from "./EmbeddedEditor";
import { randomId } from "./utils";
import { EmbeddedRender } from "./EmbeddedRender";
import { createMarkRendererPlugin } from "./InlineMarker";
import { DEFAULT_SETTINGS, OutlinerViewSettings, OutlinerViewSettingTab } from "./OutlinerViewSettings";


const FRONT_MATTER_KEY = 'outliner';

export default class OutlinerViewPlugin extends Plugin {
	outlinerFileModes: Record<string, string> = {};
	settings: OutlinerViewSettings = DEFAULT_SETTINGS;

	calculateRangeForZooming = new CalculateRangeForZooming();
	KeepOnlyZoomedContentVisible = new KeepOnlyZoomedContentVisible();

	// backlinkComponent: any;

	async onload() {

		await this.loadSettings();
		this.addSettingTab(new OutlinerViewSettingTab(this.app, this));

		this.registerView(OUTLINER_EDITOR_VIEW_ID, (leaf) => new OutlinerEditorView(leaf, this) as View);

		this.registerRibbons();

		this.patchMarkdownView();
		this.patchEmbedView();
		this.patchWorkspaceLeaf();
		this.patchItemView();
		this.patchVchildren();
		this.initOutlinerView();

		this.registerMenu();
		this.registerCommands();

		this.registerEditorExtension([createMarkRendererPlugin()]);
		// this.patchInlinePreview();
		this.app.workspace.onLayoutReady(() => {
			document.body.toggleClass('outliner-paper-layout', this.settings.paperLayout);
			// document.body.toggleClass('outliner-bold-text', this.settings.boldText);
		});
	}

	onunload() {
		Promise.all(
			this.app.workspace.getLeavesOfType(OUTLINER_EDITOR_VIEW_ID).map((leaf) => {
				this.outlinerFileModes[(leaf as any).id] = 'markdown';
				return this.setMarkdownView(leaf);
			}),
		).then(() => {
			super.unload();
		});
	}

	registerRibbons() {
		this.addRibbonIcon('list', 'New outliner file', async () => {
			const folder = this.app.fileManager.getMarkdownNewFileParent();
			if (!folder) {
				new Notice('No folder to create file in');
				return;
			}
			if (folder) {
				// @ts-ignore
				const newFile = await this.app.vault.create((folder.path ? `${folder.path}/` : '') + `outliner-${moment().format('YYYYMMDDHHmmss')}.md`, `---\noutliner: true\n---\n\n- `);
				await this.app.workspace.getLeaf(true).setViewState({
					type: OUTLINER_EDITOR_VIEW_ID,
					state: {
						file: newFile.path,
					},
					active: true,
				});
			}
		});
	}

	async setMarkdownView(leaf: WorkspaceLeaf, focus = true) {
		// console.log(leaf.view.getState());
		await leaf.setViewState(
			{
				type: 'markdown',
				state: leaf.view.getState(),
				popstate: true,
			} as ViewState,
			{focus},
		);
	}

	initOutlinerView(): void {
		const fileLeaves = this.app.workspace.getLeavesOfType('markdown');
		for (const leaf of fileLeaves) {
			const file = leaf.view.file;
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter && cache.frontmatter[FRONT_MATTER_KEY]) {
				this.outlinerFileModes[leaf.id] = OUTLINER_EDITOR_VIEW_ID;
				this.setOutlinerView(leaf, {
					file: file.path,
				});
			}
		}
	}

	async setOutlinerView(
		leaf: WorkspaceLeaf,
		{
			file,
		}: {
			file: string;
		},
	) {
		await leaf.setViewState({
			type: OUTLINER_EDITOR_VIEW_ID,
			state: {...leaf.view.getState(), file},
			popstate: true,
		} as ViewState);
	}

	patchMarkdownView() {
		around(Workspace.prototype, {
			getActiveViewOfType: (next: any) =>
				function (t: any) {

					const result = next.call(this, t);
					if (!result) {
						if (t?.VIEW_TYPE === 'markdown') {
							const activeLeaf = this.activeLeaf;
							if (activeLeaf?.view instanceof OutlinerEditorView) {
								return activeLeaf.view;
							}
						}
					}
					return result;
				},
		});
	}

	patchEmbedView() {
		if (!this.settings.editableBlockEmbeds) return;

		const mdFunction = this.app.embedRegistry.embedByExtension;

		const newMdFunction = (e: any, t: any, n: any) => {
			const fileCache = this.app.metadataCache.getFileCache(t);
			if (fileCache?.frontmatter && fileCache.frontmatter['excalidraw-plugin']) {
				return false;
			}
			return new EmbeddedEditor(this, e, t, n);
		};


		const renderReadingMode = (e: any, t: any, n: any) => {
			const fileCache = this.app.metadataCache.getFileCache(t);
			if (fileCache?.frontmatter && fileCache.frontmatter['excalidraw-plugin']) {
				return false;
			}
			if (!e.containerEl.getAttribute('alt') || !(/o-(.*)?/g.test(e.containerEl.getAttribute('alt')))) {
				return false;
			}
			return new EmbeddedRender(e, t, n);
		};

		this.register(around(mdFunction, {
			md: (next) => {
				return function (e: any, t: any, n: any) {

					if (e && e.displayMode === false && e.showInline) {
						// console.log(this);
						if (t.path.contains('.excalidraw.md')) return next.apply(this, [e, t, n]);
						const newResult = newMdFunction(e, t, n);
						if (newResult) {
							return newResult;
						} else {
							return next.apply(this, [e, t, n]);
						}
					} else if (e && e.displayMode === undefined && e.showInline) {
						// console.log(this);
						if (t.path.contains('.excalidraw.md')) return next.apply(this, [e, t, n]);
						const newResult = renderReadingMode(e, t, n);
						if (newResult) {
							return newResult;
						} else {
							return next.apply(this, [e, t, n]);
						}
					}

					return next.apply(this, [e, t, n]);
				};
			}
		}));

		// const embedRegistry = this.app.embedRegistry;
		// const originalFunction = this.app.embedRegistry.embedByExtension.md;
		//
		// this.app.embedRegistry.embedByExtension.md = function(e: any, t: any, n: any) {
		// 	// 记录传入的参数
		// 	console.log("Received arguments:", e, t, n);
		//
		// 	// 调用原始函数，并保留原始的this上下文和传递所有接收到的参数
		// 	const result = originalFunction.apply(this,[ e, t, n]);
		//
		// 	// 这里可以插入你想在原函数执行后执行的代码
		// 	console.log("After executing the original function");
		//
		// 	// 返回原函数的返回值
		// 	return result;
		// };
	}

	// private patchInlinePreview() {
	// 	const patchWidget = (plugin: OutlinerViewPlugin, widget: WidgetType) => {
	// 		const uninstaller = around(widget.constructor.prototype, {
	// 			applyTitle: (old: any) => {
	// 				return function (...e: any) {
	// 					const result = old.apply(this, e);
	// 					console.log(this, e);
	// 					return result;
	// 				};
	// 			},
	// 		});
	//
	// 		plugin.register(uninstaller);
	// 	}
	//
	// 	const patchDecoration = (plugin: OutlinerViewPlugin) => {
	// 		const uninstaller = around(Decoration, {
	// 			set(old) {
	// 				return function (a: any, sort?: boolean) {
	// 					if(Array.isArray(a)) {
	// 						for(const item of a) {
	// 							if(item.value.widget && item.value.widget.depth !== undefined) {
	// 								patchWidget(plugin, item.value.widget);
	// 								console.log(item.value.widget);
	// 								uninstaller();
	// 							}
	// 						}
	// 					}
	// 					return old.call(this, a, sort);
	// 				};
	// 			},
	// 		});
	//
	// 		plugin.register(uninstaller);
	// 	};
	//
	// 	patchDecoration(this);
	// }

	patchWorkspaceLeaf(): void {
		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;

		// Monkey patch WorkspaceLeaf to open Kanbans with KanbanView by default
		this.register(
			around(WorkspaceLeaf.prototype, {
				// Kanbans can be viewed as markdown or kanban, and we keep track of the mode
				// while the file is open. When the file closes, we no longer need to keep track of it.
				detach(next) {
					return function () {
						const state = this.view?.getState();

						if (state?.file && self.outlinerFileModes[this.id || state.file]) {
							delete self.outlinerFileModes[this.id || state.file];
						}

						return next.apply(this);
					};
				},
				// openLinkText(next) {
				// 	return function (linktext: string, sourcePath: string, newLeaf?: boolean | PaneType | undefined, openViewState?: OpenViewState | undefined) {
				// 		console.log('openLinkText', this, linktext, sourcePath, newLeaf, openViewState);
				//
				// 		return next.apply(this, [linktext, sourcePath, newLeaf, openViewState]);
				// 	};
				//
				//
				// },

				setViewState(next) {
					return function (state: ViewState, ...rest: any[]) {
						if (
							// Don't force kanban mode during shutdown
							// @ts-ignore
							self._loaded &&
							// If we have a markdown file
							state.type === 'markdown' &&
							state.state?.file &&
							// And the current mode of the file is not set to markdown
							self.outlinerFileModes[this.id || state.state.file] !== 'markdown'
						) {
							// Then check for the kanban frontMatterKey
							const cache = self.app.metadataCache.getCache(state.state.file);

							if (cache?.frontmatter && cache.frontmatter[FRONT_MATTER_KEY]) {
								const newState = {
									...state,
									type: OUTLINER_EDITOR_VIEW_ID,
									state: {
										...state.state,
									},
								};

								self.outlinerFileModes[state.state.file] = OUTLINER_EDITOR_VIEW_ID;

								return next.apply(this, [newState, ...rest]);
							}
						}

						return next.apply(this, [state, ...rest]);
					};
				},
				getRoot(old) {
					return function () {
						const top = old.call(this);
						return top?.getRoot === this.getRoot ? top : top?.getRoot();
					};
				},
				setPinned(old) {
					return function (pinned: boolean) {
						old.call(this, pinned);
						if (isEmebeddedLeaf(this) && !pinned) this.setPinned(true);
					};
				},
			}),
		);
	}

	patchItemView() {
// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		// Once 0.15.3+ is min. required Obsidian, this can be simplified to View + "onPaneMenu"
		const [cls, method] = View.prototype['onPaneMenu'] ? [View, 'onPaneMenu'] : [ItemView, 'onMoreOptionsMenu'];
		const uninstaller = around(cls.prototype, {
			[method](old: (menu: Menu, ...args: unknown[]) => void) {
				return function (menu: Menu, ...args: unknown[]) {
					const templifyView = this.leaf?.view instanceof OutlinerEditorView;
					const markdownView = this.leaf?.view instanceof MarkdownView;

					if (markdownView && !templifyView) {
						const file = this.leaf?.view.file;
						const cache = self.app.metadataCache.getFileCache(file);
						if (cache?.frontmatter && cache.frontmatter[FRONT_MATTER_KEY]) {
							menu.addItem((item) => {
								item
									.setIcon('list')
									.setTitle('Open as Outliner View')
									.onClick(async () => {
										self.outlinerFileModes[(this.leaf?.view.leaf as any).id || file.path] = OUTLINER_EDITOR_VIEW_ID;
										await self.setOutlinerView(this.leaf?.view.leaf, {
											file: file.path,
										});
									})
									.setSection?.('pane');
							});
						}
					}
					return old.call(this, menu, ...args);
				};
			},
		});
		this.register(uninstaller);
	}

	patchVchildren() {
		if (!this.settings.editableBacklinks) return;

		const patchSearchResultDom = (plugin: OutlinerViewPlugin, child: any) => {
			const resultUninstaller = around(child.constructor.prototype, {
				render: (old) => {
					return function (
						e: any, b: any
					) {

						// if (!this.parent?.isBacklink && !this.parentDom?.isBacklink) {
						// 	return old.call(this, e, b);
						// }
						const containerEl = this.parentDom.parentDom.el.closest(".mod-global-search");
						this.isBacklink = !!containerEl;
						if (this.isBacklink) {
							return old.call(this, e, b);
						}
						// new Notice(this.isBacklink.toString());
						if (this.embeddedEditor) {
							const firstChild = this.embeddedEditor;
							if (firstChild) {
								(firstChild as EmbeddedEditor).updateRange(
									this.currentRange || {
										from: this.start,
										to: this.end,
									}
								);
								return;
							}
						} else {
							// new Notice('No embedded editor');
							if (this.parentDom.file) {
								this.embeddedEditor = new EmbeddedEditor(plugin, {
									sourcePath: this.parentDom.file.path,
									app: this.parentDom.app,
									containerEl: this.el,
								}, this.parentDom.file, '', {
									from: this.start,
									to: this.end,
								}, this.content);

								this.embeddedEditor.load();
								// this.parent?.vChildren.addChild(this.embeddedEditor);
								return;
							}
							// this.addChild(children);
						}

						const result = old.call(this, e, b);

						return result;
					};
				},
				onResultClick: (old) => {
					return function (e: any) {
						// console.log(this, e);
						if (this.embeddedEditor) {
							// this.embeddedEditor.editor.focus();
							return;
						}
						return old.call(this, e);
					};
				},
				showMoreAfter: (old) => {
					return function () {
						const result = old.call(this);
						this.currentRange = {
							from: this.start,
							to: this.end,
						};

						return result;
					};
				},
				showMoreBefore: (old) => {
					return function () {
						const result = old.call(this);
						this.currentRange = {
							from: this.start,
							to: this.end,
						};

						return result;
					};
				},

			});
			this.register(resultUninstaller);

			const parent = child.parent;

			const componentUninstaller = around(parent.constructor.prototype, {
				renderContentMatches: (old) => {
					return function () {
						// new Notice('renderContentMatches');
						// console.log(this);
						this.vChildren._children.forEach((child: any) => {
							if (child?.embeddedEditor) {
								child?.embeddedEditor.unload();
							}
						});
						// const backlink = this.el.closest('.backlink-pane');
						// this.isBacklink = !!backlink;
						return old.call(this);
					};
				},
				// onResultClick: (old) => {
				// 	return function (e: any) {
				// 		new Notice('onResultClick');
				// 		return old.call(this, e);
				// 	};
				// }
			});

			this.register(componentUninstaller);
		};

		const patchSearchDom = (plugin: OutlinerViewPlugin) => {
			const searchView = this.app.workspace.getLeavesOfType("search")[0]?.view as any;
			if (!searchView) return false;

			const dom = searchView.dom.constructor;

			const uninstaller = around(dom.prototype, {
				stopLoader(old) {
					return function () {
						old.call(this);
						// console.log(this?.vChildren?.children);
						this?.vChildren?.children?.forEach((child: any) => {
							if (child?.file && !child?.pathEl) {
								if (child.vChildren._children[0]) {
									patchSearchResultDom(plugin, child.vChildren._children[0]);
									uninstaller();
									setTimeout(() => {
										// child.vChildren._children.forEach((child: any) => {
										// 	child.render(true, true);
										// });
										child.vChildren.owner.renderContentMatches();
									}, 800);
								}
							}
						});

					};
				}
			});

			this.register(
				uninstaller
			);
			return true;
		};
		this.app.workspace.onLayoutReady(() => {
			if (!patchSearchDom(this)) {
				const evt = this.app.workspace.on("layout-change", () => {
					patchSearchDom(this) && this.app.workspace.offref(evt);
				});
				this.registerEvent(evt);
			}
		});

	}

	registerMenu() {
		this.registerEvent(
			this.app.workspace.on('file-menu', (menu, file) => {
				if (!(file instanceof TFolder)) return;
				menu.addItem((item) => {
					item
						.setSection('action-primary')
						.setIcon('list')
						.setTitle('New outliner file')
						.onClick(async () => {
							const newFile = await this.app.vault.create(`${file.path}/outliner-${moment().format('YYYYMMDDHHmmss')}.md`, `---\noutliner: true\n---\n\n- `);
							this.app.workspace.getLeaf(true).setViewState({
								type: OUTLINER_EDITOR_VIEW_ID,
								state: {
									file: newFile.path,
								},
								active: true,
							});
						});
				});
			})
		);

		this.registerEvent(
			this.app.workspace.on('editor-menu', (menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo) => {
				if (!editor.somethingSelected()) return;
				if (!info?.file) return;

				menu.addItem((item) => {
					item
						.setSection('selection-link')
						.setIcon('list')
						.setTitle('Copy inline embed')
						.onClick(() => {
							const id = `o-${randomId(4)}`;
							const mark = `%%${id}%%`;
							const selection = editor.getSelection();
							if (!selection) return;

							let newLine = false;
							if (selection.split('\n').length > 1) {
								const startCursor = editor.getCursor('from');

								if (startCursor.ch === 0) {
									newLine = true;
								}
							}

							editor.replaceSelection(`${mark + (newLine ? '\n' : '')}${selection}${mark}`);

							const markdownLink = this.app.fileManager.generateMarkdownLink(info?.file as TFile, info.file?.path || '', '', `${id}`);

							navigator.clipboard.writeText('!' + markdownLink).then(() => {
								new Notice('Copied to clipboard');
							});
						});
				});
			})
		);
	}

	registerCommands() {
		this.addCommand({
			id: 'duplicate-current-bullet-and-its-children',
			name: 'Duplicate current bullet and its children',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				// @ts-ignore
				const outlinerView = this.app.workspace.getActiveViewOfType(OutlinerEditorView);
				if (outlinerView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						const editor = (outlinerView as OutlinerEditorView).editor;
						const cursor = editor?.getCursor();
						if (cursor === undefined) return;
						const pos = editor?.posToOffset(cursor);
						if (pos === undefined) return;
						const line = editor?.cm.state.doc.lineAt(pos);
						if (!line || !editor?.cm.state) return;
						const ranges = this.calculateRangeForZooming.calculateRangeForZooming(editor?.cm.state, line?.from);
						if (ranges) {
							const newPos = ranges.from + editor?.cm.state.doc.slice(ranges.from, ranges.to).length;
							editor?.cm.dispatch({
								changes: [
									{
										from: ranges.to,
										to: ranges.to,
										insert: '\n' + editor?.cm.state.doc.slice(ranges.from, ranges.to),
									}
								],
								selection: {
									head: editor?.cm.state.doc.lineAt(newPos).to,
									anchor: editor?.cm.state.doc.lineAt(newPos).to
								}

							});
						} else {
							const newPos = line.from + editor?.cm.state.doc.slice(line.from, line.to).length;
							editor?.cm.dispatch({
								changes: [
									{
										from: line.to,
										to: line.to,
										insert: '\n' + editor?.cm.state.doc.slice(line.from, line.to),
									}
								],
								selection: {
									head: editor?.cm.state.doc.lineAt(newPos).to,
									anchor: editor?.cm.state.doc.lineAt(newPos).to
								}
							});
						}
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		this.addCommand({
			id: 'search-in-current-file',
			name: 'Search in current file',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				// @ts-ignore
				const outlinerView = this.app.workspace.getActiveViewOfType(OutlinerEditorView);
				if (outlinerView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						(outlinerView as OutlinerEditorView).search();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		this.addCommand({
			id: 'open-as-outliner-view',
			name: 'Open as Outliner View',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				// @ts-ignore
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView && markdownView.getViewType() === 'markdown' && this.app.metadataCache.getFileCache(markdownView.file)?.frontmatter?.[FRONT_MATTER_KEY]) {
					if (!checking) {
						this.outlinerFileModes[markdownView.leaf.id] = OUTLINER_EDITOR_VIEW_ID;
						this.setOutlinerView(markdownView.leaf, {
							file: markdownView.file?.path,
						});

					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		this.addCommand({
			id: 'open-as-markdown-view',
			name: 'Open as Markdown View',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				// @ts-ignore
				const outlinerView = this.app.workspace.getActiveViewOfType(OutlinerEditorView);
				if (outlinerView) {
					if (!checking) {
						this.outlinerFileModes[outlinerView.leaf.id] = 'markdown';
						this.setMarkdownView(outlinerView.leaf);

					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		this.addCommand({
			id: 'create-inline-embed',
			name: 'Create inline embed',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				const id = `o-${randomId(4)}`;
				const mark = `%%${id}%%`;
				const selection = editor.getSelection();
				if (!selection) return;

				let newLine = false;
				if (selection.split('\n').length > 1) {
					const startCursor = editor.getCursor('from');

					if (startCursor.ch === 0) {
						newLine = true;
					}
				}

				editor.replaceSelection(`${mark + (newLine ? '\n' : '')}${selection}${mark}`);

				if (!view.file) return;
				const markdownLink = this.app.fileManager.generateMarkdownLink(view.file, view.file.path, '', `${id}`);

				navigator.clipboard.writeText('!' + markdownLink).then(() => {
					new Notice('Copied to clipboard');
				});
			}
		});
	}

	public async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());

	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

}

