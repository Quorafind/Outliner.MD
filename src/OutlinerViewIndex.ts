import {
	Editor,
	ItemView, MarkdownFileInfo,
	MarkdownView,
	Menu,
	moment, Notice,
	Plugin, TFile,
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


const FRONT_MATTER_KEY = 'outliner';

export default class OutlinerViewPlugin extends Plugin {
	outlinerFileModes: Record<string, string> = {};

	calculateRangeForZooming = new CalculateRangeForZooming();
	KeepOnlyZoomedContentVisible = new KeepOnlyZoomedContentVisible();

	// backlinkComponent: any;

	async onload() {
		this.registerView(OUTLINER_EDITOR_VIEW_ID, (leaf) => new OutlinerEditorView(leaf, this) as View);

		this.registerRibbons();

		this.patchMarkdownView();
		this.patchEmbedView();
		this.patchWorkspaceLeaf();
		this.patchItemView();
		this.initOutlinerView();

		this.registerMenu();
		this.registerCommands();
		// this.patchInlinePreview();
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
			if (folder) {
				// @ts-ignore
				const newFile = await this.app.vault.create(`${folder.path}/outliner-${moment().format('YYYYMMDDHHmmss')}.md`, `---\noutliner: true\n---\n\n- `);
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
		const mdFunction = this.app.embedRegistry.embedByExtension;

		const newMdFunction = (e: any, t: any, n: any) => {
			const fileCache = this.app.metadataCache.getFileCache(t);
			if (fileCache?.frontmatter && fileCache.frontmatter['excalidraw-plugin']) {
				return false;
			}
			return new EmbeddedEditor(e, t, n);
		}


		const renderReadingMode = (e: any, t: any, n: any) => {
			const fileCache = this.app.metadataCache.getFileCache(t);
			if (fileCache?.frontmatter && fileCache.frontmatter['excalidraw-plugin']) {
				return false;
			}
			if(!e.containerEl.getAttribute('alt') || !(/o-(.*)?/g.test(e.containerEl.getAttribute('alt')))) {
				return false;
			}
			return new EmbeddedRender(e, t, n);
		}

		this.register(around(mdFunction, {
			md: (next) => {
				return function (e: any, t: any, n: any) {

					console.log(e, t, n);

					if(e && e.displayMode === false && e.showInline) {
						// console.log(this);
						if(t.path.contains('.excalidraw.md')) return next.apply(this, [e, t, n]);
						const newResult = newMdFunction(e, t, n);
						if(newResult) {
							return newResult;
						} else {
							return next.apply(this, [e, t, n]);
						}
					} else if (e && e.displayMode === undefined && e.showInline) {
						// console.log(this);
						if(t.path.contains('.excalidraw.md')) return next.apply(this, [e, t, n]);
						const newResult = renderReadingMode(e, t, n);
						if(newResult) {
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
			this.app.workspace.on('editor-menu',(menu: Menu, editor: Editor, info: MarkdownView | MarkdownFileInfo)=> {
				if(!editor.somethingSelected()) return;
				if(!info?.file) return;

				menu.addItem((item) => {
					item
						.setSection('selection-link')
						.setIcon('list')
						.setTitle('Copy inline embedded')
						.onClick(() => {
							const id = `o-${randomId(4)}`;
							const mark = `%%${id}%%`;
							const selection = editor.getSelection();
							editor.replaceSelection(`${mark}${selection}${mark}`);

							const markdownLink = this.app.fileManager.generateMarkdownLink(info?.file as TFile, info.file?.path || '', '', `${id}`)

							navigator.clipboard.writeText('!' + markdownLink).then(() => {
								new Notice('Copied to clipboard');
							});
						});
				});
			})
		)
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
						if(pos === undefined) return;
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

						console.log(markdownView.leaf);
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

						console.log(outlinerView.leaf);
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});
	}

}

