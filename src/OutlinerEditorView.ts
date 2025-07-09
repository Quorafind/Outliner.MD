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
	WorkspaceLeaf,
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
import {
	EditorBuilder,
	EditorBuilderResult,
} from "./editor-components/EditorBuilder";
import { EditorType } from "./editor-components/EditorTypes";
import { EditorFactory } from "./editor-components/EditorFactory";

export function isEmebeddedLeaf(leaf: WorkspaceLeaf) {
	// Work around missing enhance.js API by checking match condition instead of looking up parent
	return leaf.containerEl.matches(".tv-block.tv-leaf-view .workspace-leaf");
}

export const OUTLINER_EDITOR_VIEW_ID = "outliner-editor-view";

export class OutlinerEditorView
	extends TextFileView
	implements MarkdownFileInfo
{
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

	inlineTitleEl: HTMLElement = createEl("div", { cls: "inline-title" });

	hideCompleted: boolean = false;

	currentMode: any;

	// New editor management properties
	private editorResult?: EditorBuilderResult;
	private editorComponent?: import("obsidian").Component;

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
		if (
			data.replace(this.frontmatter, "").trimStart() ===
			this.fileContentData.trimStart()
		) {
			// new Notice('No changes to save');

			return;
		}

		if (!this.editor) return;

		this.editor.replaceRange(
			data.replace(this.frontmatter, "").trimStart(),
			{
				line: 0,
				ch: 0,
			},
			this.editor.offsetToPos(this.editor.cm.state.doc.length)
		);

		// this.editor.scrollTo(null, currentScrollInfo.top);

		this.data = data;
	}

	getViewData(): string {
		return this.data || "";
	}

	getIcon() {
		return "list";
	}

	clear() {}

	getSelection() {
		return this.editor?.getSelection();
	}

	onLoadFile(file: TFile): Promise<void> {
		// this.inl;

		return super.onLoadFile(file);
	}

	async onUnloadFile(file: TFile) {
		// Clean up managed editor
		if (this.editorResult?.editorId) {
			try {
				await EditorFactory.destroyManagedEditor(
					this.editorResult.editorId
				);
			} catch (error) {
				console.error("Error destroying managed editor:", error);
			}
		}
		this.editorResult = undefined;
		this.editorComponent = undefined;

		return super.onUnloadFile(file);
	}

	onPaneMenu(menu: Menu, source: "more-options" | "tab-header" | string) {
		super.onPaneMenu(menu, source);
		menu.addItem((item) => {
			item.setIcon("file-edit")
				.setTitle("Open as Markdown View")
				.onClick(async () => {
					this.plugin.outlinerFileModes[(this.leaf as any).id] =
						"markdown";
					await this.plugin.setMarkdownView(this.leaf);
				})
				.setSection?.("pane");
		});
	}

	async onRename(file: TFile): Promise<void> {
		if (!(file?.extension === "md")) return super.onRename(file);

		this.filePath = file.path;
		this.file = file;

		await this.setState(
			{
				...this.getState(),
				file: file.path,
			},
			{
				history: false,
			}
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
		if (parentPath && parentPath !== "/") {
			// Split the path by '/' to get each part of the path
			const parts = parentPath.split("/");

			// Iterate over each part of the path to create breadcrumbs
			parts.forEach((part, index) => {
				// Join the parts of the path up to the current index to form the breadcrumb's path
				const pathToHere = parts.slice(0, index + 1).join("/");

				// Create the breadcrumb span and add a click listener
				const breadcrumbSpan = this.titleParentEl.createSpan({
					cls: "view-header-breadcrumb",
					text: part,
				});
				breadcrumbSpan.addEventListener("click", () => {
					const fileExplorerPlugin =
						this.app.internalPlugins.getEnabledPluginById(
							"file-explorer"
						);
					if (fileExplorerPlugin) {
						const file =
							this.app.vault.getAbstractFileByPath(pathToHere);
						if (file) {
							fileExplorerPlugin.revealInFolder(file);
						}
					}
				});

				// Create the separator span
				this.titleParentEl.createSpan({
					cls: "view-header-breadcrumb-separator",
					text: "/",
				});
			});
		}
	}

	updateHeader() {
		this.titleEl.setText(this.file?.basename || this.filePath);
		this.leaf.updateHeader();
		setTimeout(() => {
			this.leaf.tabHeaderInnerTitleEl.setText(
				this.file?.basename || this.filePath
			);
		}, 20);
		this.updateTitleBreadcrumbs();
		this.titleEl.onclick = () => {
			if (!this.file) return;
			this.app.fileManager.promptForFileRename(this.file);
		};

		this.inlineTitleEl.setText(this.file?.basename || this.filePath);
	}

	createEditor(container: HTMLElement) {
		// Use EditorBuilder for cleaner, more maintainable configuration
		this.editorResult = EditorBuilder.outliner()
			.withApp(this.app)
			.inContainer(container)
			.withData(this.fileContentData || "- ")
			.withPlugin(this.plugin)
			.withView(this)
			.withLifecycleManagement(true) // Enable lifecycle management
			.withEnhancedTypeSystem(true) // Use enhanced type system
			.disableTimeFormat(!this.plugin.settings.timeFormatWidget)
			.withEventHandlers({
				onSave: () => {
					this.requestSave();
				},
				onChange: (update) => {
					this.data =
						`${this.frontmatter}\n\n` + update.state.doc.toString();
					this.requestSave();
				},
			})
			.withCapabilities({
				canFold: true,
				canSearch: true,
				canDragDrop: true,
				supportsTimeFormat: this.plugin.settings.timeFormatWidget,
				supportsBulletMenu: true,
				supportsTaskGroups: true,
			})
			.withBehavior({
				autoFold: true,
				autoSave: true,
				syncWithFile: true,
				preserveSelection: true,
			})
			.build();

		this.editor = this.editorResult.editor;
		this.editorComponent = this.editorResult.component;

		// Enhance editor with custom getValue method
		this.editor.getValue = () => {
			return this.data || "";
		};

		// Add the inline title to the editor
		setTimeout(() => {
			if (!this.editor) return;

			// Find the sizer element from the editor component
			const sizerEl =
				this.containerEl.querySelector(".cm-content")?.parentElement;
			if (sizerEl) {
				sizerEl.prepend(this.inlineTitleEl);
				this.inlineTitleEl.setText(
					this.file?.basename || this.filePath
				);
			}
		}, 200);

		return this.editorComponent;
	}

	async setState(
		state: {
			file: string;
		},
		result: ViewStateResult
	) {
		if (state && typeof state === "object") {
			if ("file" in state) {
				this.filePath = state.file;
				const file = this.app.vault.getFileByPath(state.file);
				if (file) {
					const data = await this.app.vault.read(file);
					// const frontmatter = this.app.metadataCache.getFileCache(file)?.frontmatterPosition;
					const frontmatter = /^---\n[\s\S]*\n---/m.exec(data);
					let finalData = data;

					if (frontmatter) {
						// const frontmatterStart = frontmatter.index;
						const frontmatterEnd =
							frontmatter.index + frontmatter[0].length;
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

						this.editor.editorComponent.sizerEl?.prepend(
							this.inlineTitleEl
						);
						this.inlineTitleEl.setText(
							file?.basename || this.filePath
						);
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

		container.style.display = "flex";
		container.style.flexDirection = "column";
		container.style.gap = "1%";

		const editorContainer = container.createDiv({
			cls: "outliner-editor",
		});
		editorContainer.style.height = "100%";

		this.createEditor(editorContainer);
	}

	filter(view: EditorView, search: string) {
		if (search === "") {
			// console.log('show all', this.editor, view);
			this.plugin.KeepOnlyZoomedContentVisible?.showAllContent(view);
			this.filteredValue = "";
			this.contentEl.toggleClass("filtered", false);
			if (!this.editor) return;
			view.dispatch({
				effects: ClearSearchHighlightEffect.of(),
			});
			return;
		}

		const ranges =
			this.plugin.calculateRangeForZooming.calculateRangesBasedOnSearch(
				view,
				this.editor?.getAllFoldableLines() || [],
				search
			);

		this.filteredValue = search;
		this.plugin.KeepOnlyZoomedContentVisible?.keepRangesVisible(
			view,
			ranges
		);
		this.contentEl.toggleClass("filtered", true);
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

		const ranges =
			this.plugin.calculateRangeForZooming.calculateRangesBasedOnType(
				view,
				"completed"
			);

		if (!this.editor) return;
		this.editor.cm.dispatch({
			effects: [
				hideRangesEffect.of({
					ranges: ranges,
				}),
			],
		});
		this.hideCompleted = true;
	}

	registerSearchActionBtn() {
		const showCompletedEl = this.addAction(
			"check",
			"Show Completed",
			(evt) => {
				this.editor && this.hideCompletedItems(this.editor.cm);
				showCompletedEl.toggleClass(
					"hide-completed",
					this.hideCompleted
				);
			}
		);

		this.searchActionEl = this.addAction("search", "Search", (evt) => {
			const searchMenu = new Menu();
			searchMenu.dom.toggleClass("search-menu", true);
			let block = false;
			searchMenu.addItem((item) => {
				const itemDom = (item as any).dom;
				item.setIsLabel(true);
				// let tempValue = "";
				const settingEl = new Setting(itemDom)
					.setName("Filter")
					.addSearch((search) => {
						search
							.setValue(this.filteredValue)
							.onChange((value) => {
								if (block) return;
								this.editor &&
									this.editor.cm.dispatch({
										effects:
											ClearSearchHighlightEffect.of(),
									});

								this.editor &&
									this.filter(this.editor.cm, value);
							});

						search.clearButtonEl.addEventListener("click", () => {
							this.filter(this.editor?.cm as EditorView, "");
							searchMenu.hide();
						});

						search.inputEl.addEventListener(
							"compositionstart",
							() => {
								block = true;
							}
						);
						search.inputEl.addEventListener(
							"compositionend",
							() => {
								block = false;
								if (!this.editor) return;
								this.filter(
									this.editor.cm,
									search.inputEl.value
								);
							}
						);
					});

				item.onClick((e) => {
					e.preventDefault();
					e.stopImmediatePropagation();
					(
						settingEl.components[0] as SearchComponent
					).inputEl.focus();
				});
			});
			if (!this.searchActionEl) return;
			const { x, y } = this.searchActionEl.getBoundingClientRect();
			searchMenu.showAtPosition({
				x: x + this.searchActionEl.offsetHeight,
				y: y + this.searchActionEl.offsetHeight,
			});

			searchMenu.onHide(() => {
				if (!this.editor) return;
				this.editor.focus();
			});

			document.body.find(".search-menu input")?.focus();
		});

		this.clearFilterBtn = this.addAction(
			"filter-x",
			"Clear Filter",
			(evt) => {
				this.editor && this.filter(this.editor.cm, "");
			}
		);
		this.clearFilterBtn.toggleClass("filter-clear", true);
	}

	public search() {
		if (!this.searchActionEl) return;
		this.searchActionEl.click();
		document.body.find(".search-menu input")?.focus();
	}

	public searchWithText(text: string) {
		if (!this.searchActionEl) return;
		this.searchActionEl.click();

		const searchInput = document.body.find(
			".search-menu input"
		) as HTMLInputElement;
		searchInput?.focus();
		searchInput.value = text;
		searchInput.dispatchEvent(new Event("input"));
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
