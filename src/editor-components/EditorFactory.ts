import { App, Component, debounce, Editor, TFile } from "obsidian";
import { EmbeddableMarkdownEditor } from "./MarkdownEditor";
import { editorRangeUtils } from "../utils/editorRangeUtils";
import {
	handleDelete,
	handleEnterWithZoom,
	handleIndent,
	handleRegularEnter,
	handleShiftEnter,
} from "../utils/editorEventHandlers";
import { EditorState } from "@codemirror/state";
import OutlinerViewPlugin from "../OutlinerViewIndex";
import { OutlinerEditorView } from "../OutlinerEditorView";
import {
	EditorConfigManager,
	EditorType,
	BaseEditorConfig,
	EditorConfig,
} from "./EditorConfigManager";
import { EditorTypeGuards, EditorTypeUtils } from "./EditorTypes";
import {
	defaultStrategyFactory,
	StrategyFactory,
} from "./strategies/StrategyFactory";
import {
	defaultLifecycleManager,
	EditorLifecycleManager,
	createLifecycleEventHandlers,
} from "./lifecycle";

/**
 * Legacy interface for backward compatibility
 * @deprecated Use BaseEditorConfig from EditorConfigManager instead
 */
export interface EditorFactoryOptions extends BaseEditorConfig {}

/**
 * Factory for creating different types of editors with shared configuration
 */
export class EditorFactory {
	private static strategyFactory: StrategyFactory = defaultStrategyFactory;
	private static lifecycleManager: EditorLifecycleManager =
		defaultLifecycleManager;
	/**
	 * Creates an editor based on the specified type and options
	 */
	static createEditor(
		type: EditorType,
		options: BaseEditorConfig
	): {
		editor: Editor;
		component: Component;
		updateRange?: (range: { from: number; to: number }) => void;
	} {
		// Prepare and validate configuration using EditorConfigManager
		const config = EditorConfigManager.prepareConfig(type, options);

		switch (type) {
			case EditorType.EMBEDDED:
				return this.createEmbeddedEditor(config);
			case EditorType.TASK_GROUP:
				return this.createTaskGroupEditor(config);
			case EditorType.OUTLINER:
				return this.createOutlinerEditor(config);
			default:
				throw new Error(`Unsupported editor type: ${type}`);
		}
	}

	/**
	 * Creates an editor using the enhanced type system
	 */
	static createEnhancedEditor(
		type: EditorType,
		options: BaseEditorConfig
	): {
		editor: Editor;
		component: Component;
		updateRange?: (range: { from: number; to: number }) => void;
		metadata: import("./EditorTypes").EditorMetadata;
	} {
		// Validate configuration using enhanced type guards
		if (!EditorTypeGuards.validateConfigType({ ...options, type })) {
			throw new Error(`Invalid configuration for editor type: ${type}`);
		}

		// Prepare configuration using enhanced system
		const config = EditorConfigManager.prepareEnhancedConfig(type, options);

		// Create metadata for the editor
		const metadata = EditorTypeUtils.createMetadata(type, {
			id: `editor-${type}-${Date.now()}`,
		});

		// Create the editor using the standard method
		const result = this.createEditor(type, config);

		return {
			...result,
			metadata,
		};
	}

	/**
	 * Creates an editor using the strategy pattern
	 */
	static createEditorWithStrategy(
		type: EditorType,
		options: BaseEditorConfig
	): {
		editor: Editor;
		component: Component;
		updateRange?: (range: { from: number; to: number }) => void;
	} {
		// Use the strategy factory to create the editor
		const result = this.strategyFactory.createEditor(type, options);

		return {
			editor: result.editor,
			component: result.component,
			updateRange: result.updateRange,
		};
	}

	/**
	 * Sets a custom strategy factory
	 */
	static setStrategyFactory(factory: StrategyFactory): void {
		this.strategyFactory = factory;
	}

	/**
	 * Gets the current strategy factory
	 */
	static getStrategyFactory(): StrategyFactory {
		return this.strategyFactory;
	}

	/**
	 * Validates configuration using the strategy pattern
	 */
	static validateConfigWithStrategy(config: BaseEditorConfig): boolean {
		return this.strategyFactory.validateConfig(config);
	}

	/**
	 * Creates an editor with full lifecycle management
	 */
	static createManagedEditor(
		type: EditorType,
		options: BaseEditorConfig
	): {
		editorId: string;
		editor: Editor;
		component: Component;
		updateRange?: (range: { from: number; to: number }) => void;
	} {
		// Create the editor using strategy pattern
		const result = this.createEditorWithStrategy(type, options);

		// Register with lifecycle manager
		const editorId = this.lifecycleManager.createEditor(
			result.editor,
			result.component,
			{ ...options, type },
			result.updateRange
		);

		// Set up lifecycle event handlers
		const eventHandlers = createLifecycleEventHandlers(options.app, type);
		this.lifecycleManager.setEventHandlers(eventHandlers);

		// Initialize the editor
		this.lifecycleManager
			.initializeEditor(editorId)
			.then(() => {
				this.lifecycleManager.activateEditor(editorId);
			})
			.catch((error) => {
				console.error("Failed to initialize editor:", error);
			});

		return {
			editorId,
			editor: result.editor,
			component: result.component,
			updateRange: result.updateRange,
		};
	}

	/**
	 * Destroys a managed editor
	 */
	static async destroyManagedEditor(editorId: string): Promise<void> {
		await this.lifecycleManager.destroyEditor(editorId);
	}

	/**
	 * Gets a managed editor instance
	 */
	static getManagedEditor(editorId: string) {
		return this.lifecycleManager.getInstance(editorId);
	}

	/**
	 * Sets a custom lifecycle manager
	 */
	static setLifecycleManager(manager: EditorLifecycleManager): void {
		this.lifecycleManager = manager;
	}

	/**
	 * Gets the current lifecycle manager
	 */
	static getLifecycleManager(): EditorLifecycleManager {
		return this.lifecycleManager;
	}

	/**
	 * Creates an embedded editor
	 */
	private static createEmbeddedEditor(options: BaseEditorConfig) {
		const {
			app,
			containerEl,
			file,
			subpath,
			targetRange,
			data,
			readOnly = false,
		} = options;

		// Create a component to host the editor
		const component = new Component();

		if (!file) {
			throw new Error("File is required for embedded editor");
		}

		// If we have data, create the editor right away
		if (data) {
			const range = targetRange
				? { from: targetRange.from, to: targetRange.to, type: "part" }
				: editorRangeUtils.getRange(
						app,
						file,
						subpath,
						undefined,
						data
				  );

			const editor = this.createEditorInstance(
				app,
				containerEl,
				file.path,
				data,
				range,
				options,
				component,
				readOnly
			);

			return {
				editor,
				component,
				updateRange: (range: { from: number; to: number }) => {
					editorRangeUtils.updateVisibleRange(editor, range, "part");
				},
			};
		}

		// Otherwise, read the file and then create the editor
		let editor: Editor;
		app.vault.read(file).then((fileData) => {
			const range = editorRangeUtils.getRange(
				app,
				file,
				subpath,
				targetRange,
				fileData
			);
			editor = this.createEditorInstance(
				app,
				containerEl,
				file.path,
				fileData,
				range,
				options,
				component,
				readOnly
			);

			// Set up save debouncing
			if (options.onSave) {
				const debouncedSave = debounce((file: TFile, data: string) => {
					options.onSave!(file, data);
				}, 400);

				// Register event listener for file changes
				component.registerEvent(
					app.metadataCache.on("changed", (changedFile) => {
						if (changedFile.path === file.path) {
							app.vault.read(changedFile).then((newData) => {
								if (editor && editor.getValue() !== newData) {
									editor.setValue(newData);
									debouncedSave(changedFile, newData);
								}
							});
						}
					})
				);
			}
		});

		return {
			// Editor will be defined after async file reading
			get editor() {
				return editor;
			},
			component,
			updateRange: (range: { from: number; to: number }) => {
				if (editor) {
					editorRangeUtils.updateVisibleRange(editor, range, "part");
				}
			},
		};
	}

	/**
	 * Creates a task group editor
	 */
	private static createTaskGroupEditor(options: BaseEditorConfig) {
		const { app, containerEl, file, data } = options;

		if (!file) {
			throw new Error("File is required for task group editor");
		}

		// Create a component to host the editor
		const component = new Component();

		// Create the editor
		const editor = this.createEditorInstance(
			app,
			containerEl,
			file.path,
			data || "",
			{ from: 0, to: (data || "").length, type: "whole" },
			{ ...options, foldByDefault: true },
			component
		);

		return { editor, component };
	}

	/**
	 * Creates an outliner editor
	 */
	private static createOutlinerEditor(options: BaseEditorConfig) {
		const { app, containerEl, file, data } = options;

		// Create a component to host the editor
		const component = new Component();

		// Create the editor
		const editor = this.createEditorInstance(
			app,
			containerEl,
			file?.path || "",
			data || "",
			{ from: 0, to: (data || "").length, type: "whole" },
			{ ...options, foldByDefault: true },
			component
		);

		return { editor, component };
	}

	/**
	 * Creates an editor instance with the given options
	 */
	private static createEditorInstance(
		app: App,
		containerEl: HTMLElement,
		path: string,
		data: string,
		range: { from: number; to: number; type: string },
		options: BaseEditorConfig,
		component: Component,
		readOnly: boolean = false
	): Editor {
		const { foldByDefault = false, disableTimeFormat = false } = options;

		// Create the shared event handlers
		const requestSave = debounce(async (file: TFile, data: string) => {
			if (file) {
				await app.vault.modify(file, data);
			}
		}, 400);

		// Create the embedded editor
		const embedEditor = new EmbeddableMarkdownEditor(app, containerEl, {
			// Configure based on editor type
			onEnter: (editor, mod: boolean, shift: boolean) => {
				if (!editor.view) return false;

				const editorInstance = editor.editor as Editor;
				const cursor = editorInstance.getCursor();
				const { line, ch } = cursor;
				const lineText = editorInstance.getLine(line);

				if (shift) {
					return handleShiftEnter(editorInstance, line, lineText);
				}

				// Try handling with zoom-specific logic first
				if (handleEnterWithZoom(editorInstance, app, mod, shift)) {
					return true;
				}

				// Fall back to regular enter handling
				return handleRegularEnter(editorInstance, line, ch, lineText);
			},
			onDelete: (editor) => {
				if (!editor.view) return false;
				return handleDelete(editor.editor as Editor);
			},
			onIndent: (editor, mod: boolean, shift: boolean) => {
				if (!editor.view) return false;
				return handleIndent(editor.editor as Editor, app, mod, shift);
			},
			getDisplayText: () => path.split("/").pop() || "Untitled",
			getViewType: () => "outliner",
			onChange: (update, path) => {
				if (path) {
					if (!update.docChanged) return;

					const file = app.vault.getFileByPath(path);
					const shouldAutoSave = options?.behavior?.autoSave ?? true;
					if (file && options.onSave && shouldAutoSave) {
						options.onSave(file, update.state.doc.toString());
					}
				}

				// Call custom onChange handler if provided
				if (options.onChange) {
					options.onChange(update, path);
				}
			},
			onBlur: (editor, path) => {
				if (path) {
					const file = app.vault.getFileByPath(path);
					const data = editor.editor?.cm.state.doc.toString();

					if (file && data && options.onSave) {
						options.onSave(file, data);
					} else if (file && data) {
						requestSave(file, data);
					}
				}
			},
			type: options.type ? options.type : EditorType.EMBEDDED,
			value: data || "",
			path: path,
			foldByDefault: foldByDefault,
			disableTimeFormat: disableTimeFormat,
			view: options.view,
		});

		// Apply visible range settings
		editorRangeUtils.updateVisibleRange(
			embedEditor.editor,
			{ from: range.from, to: range.to },
			range.type as "part" | "block" | "heading"
		);

		// Apply read-only mode if specified
		if (readOnly) {
			embedEditor.editor.cm.dispatch({
				effects: [
					embedEditor.readOnlyDepartment.reconfigure(
						EditorState.readOnly.of(true)
					),
				],
			});
			containerEl.toggleClass("readonly", true);
		}

		// If it's a full file and front matter should be hidden
		if (
			range.type === "whole" &&
			options.plugin?.settings.hideFrontmatter
		) {
			const file = app.vault.getFileByPath(path);
			if (file) {
				editorRangeUtils.updateFrontMatterVisible(
					embedEditor.editor,
					app,
					file
				);
			}
		}

		// Add the editor to the component
		// @ts-expect-error - This is a private method
		component.addChild(embedEditor);

		return embedEditor.editor;
	}
}
