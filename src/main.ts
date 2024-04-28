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
import { CalculateRangeForZooming } from "./utils";
import { KeepOnlyZoomedContentVisible } from './checkVisible';


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
		this.patchWorkspaceLeaf();
		this.patchItemView();
		this.initOutlinerView();

		this.registerMenu();
		this.registerCommands();
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
	}

	registerCommands() {
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

