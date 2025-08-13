import {
	App,
	Component,
	debounce,
	Editor,
	ExtraButtonComponent,
	Keymap,
	TFile,
} from "obsidian";
import OutlinerViewPlugin from "../../OutlinerViewIndex";
import { EditorBuilder } from "../../editor-components/EditorBuilder";
import { EditorFactory } from "../../editor-components/EditorFactory";
import { EditorType } from "../../editor-components/EditorTypes";
import { editorRangeUtils } from "../../utils/editorRangeUtils";

export class EmbeddedEditor extends Component {
	plugin: OutlinerViewPlugin;
	app: App;
	editor: Editor | undefined;
	editorId?: string;

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

	// Remove custom range and visibility methods as they're now handled by the new architecture
	private updateRange?: (range: { from: number; to: number }) => void;

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

				// Use the updateRange function provided by the new architecture
				if (this.updateRange && targetRange.type !== "whole") {
					this.updateRange(this.range);
				}

				// Handle front matter visibility for whole files
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
		// Clean up managed editor if using lifecycle management
		if (this.editorId) {
			try {
				await EditorFactory.destroyManagedEditor(this.editorId);
			} catch (error) {
				console.error("Error destroying managed editor:", error);
			}
		}
		super.onunload();
	}

	// Compatibility with embed registry expectations
	// Obsidian's embed loader calls child.loadFile() after constructing
	// We map that to this.load() and optionally update file/subpath
	loadFile(file?: TFile, subpath?: string) {
		if (file) this.file = file;
		if (typeof subpath === "string") this.subpath = subpath;
		this.load();
	}

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

	createEditor() {
		if (!this.file) return;

		const targetRange = this.getRange(this.file);
		this.range = {
			from: targetRange.from,
			to: targetRange.to,
		};

		// Check if readonly mode is requested
		const title = this.containerEl.getAttr("alt");
		const isReadOnly =
			title && (title === "readonly" || title.includes("readonly"));

		// Use EditorBuilder for cleaner, more flexible configuration
		const builder = EditorBuilder.embedded()
			.withApp(this.app)
			.inContainer(this.containerEl)
			.forFile(this.file)
			.withData(this.data || "")
			.withPlugin(this.plugin)
			.disableTimeFormat(!this.plugin.settings.timeFormatWidget)
			.readOnly(isReadOnly || false)
			.withBehavior({ autoSave: false })
			.withEventHandlers({
				onSave: (file, data) => this.requestSave(file, data),
			});

		// Add subpath and range if available
		if (this.subpath && this.subpath.trim()) {
			builder.withSubpath(this.subpath);
		}
		if (this.targetRange) {
			builder.withRange(this.targetRange.from, this.targetRange.to);
		}

		// Build the editor with enhanced features
		const result = builder.withEnhancedTypeSystem(true).build();

		this.editor = result.editor;
		this.updateRange = result.updateRange;

		// Mark embed container for part/block/heading styling
		if (targetRange.type !== "whole") {
			this.containerEl.toggleClass("embedded-part", true);
		}

		// Store metadata if available
		if (result.metadata) {
			// Could store metadata for debugging/monitoring purposes
			console.debug("Editor metadata:", result.metadata);
		}

		// Add UI elements based on the range type
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
		if (title && (title === "readonly" || title.includes("readonly"))) {
			this.addReadonlyButton();
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
				if (!this.editor || !this.file) return;

				// Recreate editor with opposite readonly state using the builder
				const result = EditorBuilder.embedded()
					.withApp(this.app)
					.inContainer(this.containerEl)
					.forFile(this.file)
					.withData(this.data || "")
					.withPlugin(this.plugin)
					.disableTimeFormat(!this.plugin.settings.timeFormatWidget)
					.readOnly(!locked)
					.withEventHandlers({
						onSave: (file, data) => this.requestSave(file, data),
					})
					.build();

				this.editor = result.editor;
				this.updateRange = result.updateRange;

				locked = !locked;
				component.setIcon(locked ? "lock" : "unlock");
				this.containerEl.toggleClass("readonly", locked);
			});
	}

	/**
	 * Update the visible range using the new architecture
	 */
	public updateEditorRange(range: { from: number; to: number }) {
		this.range = range;

		if (this.updateRange) {
			this.updateRange(range);
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

	// Remove the custom updateVisibleRange, updateIndentVisible, updateFrontMatterVisible methods
	// as they are now handled by the new architecture via editorRangeUtils
}
