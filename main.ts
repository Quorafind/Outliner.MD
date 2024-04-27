import {
	ItemView,
	MarkdownView,
	Menu,
	Plugin,
	View,
	ViewState,
	Workspace,
	WorkspaceLeaf,
	moment,
	TFolder
} from 'obsidian';
import { around } from "monkey-around";
import { isEmebeddedLeaf, OUTLINER_EDITOR_VIEW_ID, OutlinerEditorView } from "./OutlinerEditorView";


const FRONT_MATTER_KEY = 'outliner';

export default class MyPlugin extends Plugin {
	outlinerFileModes: Record<string, string> = {};

	// backlinkComponent: any;

	async onload() {
		this.registerView(OUTLINER_EDITOR_VIEW_ID, (leaf) => new OutlinerEditorView(leaf, this) as View);

		this.addRibbonIcon('list', 'Create new outliner file', async () => {
			this.app.workspace.getLeaf(true).setViewState({
				type: OUTLINER_EDITOR_VIEW_ID,
				state: {
					file: this.app.vault.getMarkdownFiles()[0].path,
				},
			});
		});

		this.patchMarkdownView();
		this.patchWorkspaceLeaf();
		this.patchItemView();
		this.initTemplifyView();

		this.registerMenu();
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

	initTemplifyView(): void {
		const fileLeaves = this.app.workspace.getLeavesOfType('markdown');
		for (const leaf of fileLeaves) {
			const file = leaf.view.file;
			const cache = this.app.metadataCache.getFileCache(file);
			if (cache?.frontmatter && cache.frontmatter[FRONT_MATTER_KEY]) {
				this.outlinerFileModes[leaf.id] = OUTLINER_EDITOR_VIEW_ID;
				this.setTemplifyView(leaf, {
					file: file.path,
				});
			}
		}
	}

	async setTemplifyView(
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

		// const patchEditor = () => {
		// 	const activeEditor = this.app.workspace.activeEditor;
		//
		// 	if (!activeEditor && !activeEditor?.updateShowBacklinks) return false;
		//
		// 	const childrenList = activeEditor._children;
		// 	if (!childrenList) return false;
		//
		// 	const children = childrenList.find((child) => {
		// 		return !!child.backlinkDom;
		// 	});
		//
		//
		// 	if (!children) {
		// 		activeEditor.toggleBacklinks();
		// 		if (!activeEditor._children) return false;
		// 		const children = activeEditor._children.find((child) => {
		// 			return !!child.backlinkDom;
		// 		});
		// 		if (children) {
		// 			this.backlinkComponent = children;
		// 			this.app.workspace.trigger('backlinks:open', children);
		// 			return true;
		// 		}
		// 		return false;
		// 	}
		// 	this.app.workspace.trigger('backlinks:open', children);
		// 	return true;
		// };

		// this.app.workspace.onLayoutReady(() => {
		// 	if (!patchEditor()) {
		// 		const evt = this.app.workspace.on('file-open', () => {
		// 			patchEditor() && this.app.workspace.offref(evt);
		// 		});
		// 		this.registerEvent(evt);
		// 	}
		// });
	}

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
										await self.setTemplifyView(this.leaf?.view.leaf, {
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
						.setIcon('list')
						.setTitle('Create new outliner file')
						.onClick(async () => {
							const newFile = await this.app.vault.create(`${file.path}/outliner-${moment().format('YYYYMMDDHHmmss')}.md`, `---\noutliner: true\n---\n\n- `);
							this.app.workspace.getLeaf(true).setViewState({
								type: OUTLINER_EDITOR_VIEW_ID,
								state: {
									file: newFile.path,
								},
							});
						});
				});
			})
		);
	}

}

