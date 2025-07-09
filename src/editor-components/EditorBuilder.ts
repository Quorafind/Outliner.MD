import { App, Component, TFile } from "obsidian";
import {
	EditorType,
	BaseEditorConfig,
	EditorConfig,
} from "./EditorConfigManager";
import { EditorFactory } from "./EditorFactory";
import {
	EditorCapabilities,
	EditorBehavior,
	EditorAppearance,
} from "./EditorTypes";
import { OutlinerEditorView } from "../OutlinerEditorView";
import OutlinerViewPlugin from "../OutlinerViewIndex";

/**
 * Builder result interface
 */
export interface EditorBuilderResult {
	editor: import("obsidian").Editor;
	component: Component;
	updateRange?: (range: { from: number; to: number }) => void;
	editorId?: string;
	metadata?: import("./EditorTypes").EditorMetadata;
}

/**
 * Builder configuration interface
 */
export interface BuilderConfig extends BaseEditorConfig {
	// Additional builder-specific options
	useLifecycleManagement?: boolean;
	useEnhancedTypeSystem?: boolean;
	useStrategyPattern?: boolean;
}

/**
 * Fluent API builder for creating editors
 */
export class EditorBuilder {
	protected config: Partial<BuilderConfig> = {};
	private editorType?: EditorType;

	/**
	 * Sets the editor type
	 */
	ofType(type: EditorType): EditorBuilder {
		this.editorType = type;
		return this;
	}

	/**
	 * Sets the Obsidian app instance
	 */
	withApp(app: App): EditorBuilder {
		this.config.app = app;
		return this;
	}

	/**
	 * Sets the container element
	 */
	inContainer(containerEl: HTMLElement): EditorBuilder {
		this.config.containerEl = containerEl;
		return this;
	}

	/**
	 * Sets the file for the editor
	 */
	forFile(file: TFile): EditorBuilder {
		this.config.file = file;
		return this;
	}

	/**
	 * Sets the file data
	 */
	withData(data: string): EditorBuilder {
		this.config.data = data;
		return this;
	}

	/**
	 * Sets the subpath for embedded editors
	 */
	withSubpath(subpath: string): EditorBuilder {
		this.config.subpath = subpath;
		return this;
	}

	/**
	 * Sets the target range
	 */
	withRange(from: number, to: number): EditorBuilder {
		this.config.targetRange = { from, to };
		return this;
	}

	/**
	 * Sets the plugin instance
	 */
	withPlugin(plugin: OutlinerViewPlugin): EditorBuilder {
		this.config.plugin = plugin;
		return this;
	}

	/**
	 * Sets the view instance
	 */
	withView(view: OutlinerEditorView): EditorBuilder {
		this.config.view = view;
		return this;
	}

	/**
	 * Configures read-only mode
	 */
	readOnly(readOnly: boolean = true): EditorBuilder {
		this.config.readOnly = readOnly;
		return this;
	}

	/**
	 * Configures fold by default
	 */
	foldByDefault(fold: boolean = true): EditorBuilder {
		this.config.foldByDefault = fold;
		return this;
	}

	/**
	 * Disables time format
	 */
	disableTimeFormat(disable: boolean = true): EditorBuilder {
		this.config.disableTimeFormat = disable;
		return this;
	}

	/**
	 * Sets capabilities
	 */
	withCapabilities(capabilities: Partial<EditorCapabilities>): EditorBuilder {
		this.config.capabilities = {
			...this.config.capabilities,
			...capabilities,
		};
		return this;
	}

	/**
	 * Sets behavior configuration
	 */
	withBehavior(behavior: Partial<EditorBehavior>): EditorBuilder {
		this.config.behavior = { ...this.config.behavior, ...behavior };
		return this;
	}

	/**
	 * Sets appearance configuration
	 */
	withAppearance(appearance: Partial<EditorAppearance>): EditorBuilder {
		this.config.appearance = { ...this.config.appearance, ...appearance };
		return this;
	}

	/**
	 * Sets event handlers
	 */
	withEventHandlers(handlers: {
		onSave?: (file: TFile, data: string) => void;
		onChange?: (update: any, path?: string) => void;
		onEnter?: (editor: any, mod: boolean, shift: boolean) => boolean;
		onDelete?: (editor: any) => boolean;
		onIndent?: (editor: any, mod: boolean, shift: boolean) => boolean;
	}): EditorBuilder {
		Object.assign(this.config, handlers);
		return this;
	}

	/**
	 * Enables lifecycle management
	 */
	withLifecycleManagement(enable: boolean = true): EditorBuilder {
		this.config.useLifecycleManagement = enable;
		return this;
	}

	/**
	 * Enables enhanced type system
	 */
	withEnhancedTypeSystem(enable: boolean = true): EditorBuilder {
		this.config.useEnhancedTypeSystem = enable;
		return this;
	}

	/**
	 * Enables strategy pattern
	 */
	withStrategyPattern(enable: boolean = true): EditorBuilder {
		this.config.useStrategyPattern = enable;
		return this;
	}

	/**
	 * Sets custom extensions
	 */
	withExtensions(
		extensions: import("@codemirror/state").Extension[]
	): EditorBuilder {
		this.config.customExtensions = extensions;
		return this;
	}

	/**
	 * Applies a configuration function to this builder
	 */
	pipe(fn: (builder: EditorBuilder) => EditorBuilder): EditorBuilder {
		return fn(this);
	}

	/**
	 * Configures for embedded editor
	 */
	asEmbedded(): EditorBuilder {
		return this.ofType(EditorType.EMBEDDED);
	}

	/**
	 * Configures for outliner editor
	 */
	asOutliner(): EditorBuilder {
		return this.ofType(EditorType.OUTLINER).foldByDefault(true);
	}

	/**
	 * Configures for task group editor
	 */
	asTaskGroup(): EditorBuilder {
		return this.ofType(EditorType.TASK_GROUP).foldByDefault(true);
	}

	/**
	 * Builds the editor with the configured options
	 */
	build(): EditorBuilderResult {
		if (!this.editorType) {
			throw new Error("Editor type must be specified");
		}

		if (!this.config.app) {
			throw new Error("App instance is required");
		}

		if (!this.config.containerEl) {
			throw new Error("Container element is required");
		}

		// Validate type-specific requirements
		this.validateRequirements();

		// Choose the appropriate creation method based on configuration
		if (this.config.useLifecycleManagement) {
			return this.buildWithLifecycleManagement();
		} else if (this.config.useEnhancedTypeSystem) {
			return this.buildWithEnhancedTypeSystem();
		} else if (this.config.useStrategyPattern) {
			return this.buildWithStrategyPattern();
		} else {
			return this.buildStandard();
		}
	}

	/**
	 * Validates requirements based on editor type
	 */
	private validateRequirements(): void {
		switch (this.editorType) {
			case EditorType.EMBEDDED:
			case EditorType.TASK_GROUP:
				if (!this.config.file) {
					throw new Error(
						`File is required for ${this.editorType} editor`
					);
				}
				break;
			case EditorType.OUTLINER:
				// Outliner editors can work without a file
				break;
		}
	}

	/**
	 * Builds editor with standard factory method
	 */
	private buildStandard(): EditorBuilderResult {
		const result = EditorFactory.createEditor(
			this.editorType!,
			this.config as BaseEditorConfig
		);
		return result;
	}

	/**
	 * Builds editor with enhanced type system
	 */
	private buildWithEnhancedTypeSystem(): EditorBuilderResult {
		const result = EditorFactory.createEnhancedEditor(
			this.editorType!,
			this.config as BaseEditorConfig
		);
		return {
			editor: result.editor,
			component: result.component,
			updateRange: result.updateRange,
			metadata: result.metadata,
		};
	}

	/**
	 * Builds editor with strategy pattern
	 */
	private buildWithStrategyPattern(): EditorBuilderResult {
		const result = EditorFactory.createEditorWithStrategy(
			this.editorType!,
			this.config as BaseEditorConfig
		);
		return result;
	}

	/**
	 * Builds editor with lifecycle management
	 */
	private buildWithLifecycleManagement(): EditorBuilderResult {
		const result = EditorFactory.createManagedEditor(
			this.editorType!,
			this.config as BaseEditorConfig
		);
		return {
			editor: result.editor,
			component: result.component,
			updateRange: result.updateRange,
			editorId: result.editorId,
		};
	}

	/**
	 * Creates a new builder instance
	 */
	static create(): EditorBuilder {
		return new EditorBuilder();
	}

	/**
	 * Creates a builder for an embedded editor
	 */
	static embedded(): EditorBuilder {
		return new EditorBuilder().asEmbedded();
	}

	/**
	 * Creates a builder for an outliner editor
	 */
	static outliner(): EditorBuilder {
		return new EditorBuilder().asOutliner();
	}

	/**
	 * Creates a builder for a task group editor
	 */
	static taskGroup(): EditorBuilder {
		return new EditorBuilder().asTaskGroup();
	}
}

/**
 * Predefined builder templates for common use cases
 */
export class EditorBuilderTemplates {
	/**
	 * Creates a basic embedded editor for file viewing
	 */
	static basicEmbedded(
		app: App,
		containerEl: HTMLElement,
		file: TFile
	): EditorBuilder {
		return EditorBuilder.embedded()
			.withApp(app)
			.inContainer(containerEl)
			.forFile(file)
			.readOnly(true);
	}

	/**
	 * Creates an editable embedded editor
	 */
	static editableEmbedded(
		app: App,
		containerEl: HTMLElement,
		file: TFile,
		onSave?: (file: TFile, data: string) => void
	): EditorBuilder {
		const builder = EditorBuilder.embedded()
			.withApp(app)
			.inContainer(containerEl)
			.forFile(file)
			.readOnly(false);

		if (onSave) {
			builder.withEventHandlers({ onSave });
		}

		return builder;
	}

	/**
	 * Creates a full-featured outliner editor
	 */
	static fullOutliner(
		app: App,
		containerEl: HTMLElement,
		plugin: OutlinerViewPlugin,
		view: OutlinerEditorView
	): EditorBuilder {
		return EditorBuilder.outliner()
			.withApp(app)
			.inContainer(containerEl)
			.withPlugin(plugin)
			.withView(view)
			.withLifecycleManagement(true)
			.withEnhancedTypeSystem(true)
			.withCapabilities({
				canFold: true,
				canIndent: true,
				canSearch: true,
				supportsTimeFormat: true,
			})
			.withBehavior({
				autoFold: true,
				autoSave: true,
				syncScroll: true,
			});
	}

	/**
	 * Creates a task group editor with task-specific features
	 */
	static taskGroupEditor(
		app: App,
		containerEl: HTMLElement,
		file: TFile,
		plugin: OutlinerViewPlugin
	): EditorBuilder {
		return EditorBuilder.taskGroup()
			.withApp(app)
			.inContainer(containerEl)
			.forFile(file)
			.withPlugin(plugin)
			.withCapabilities({
				canFold: true,
				canIndent: true,
				canSearch: true,
				supportsTaskGroups: true,
			})
			.withBehavior({
				autoFold: true,
				autoSave: true,
				groupTasks: true,
			});
	}

	/**
	 * Creates a minimal editor for simple text editing
	 */
	static minimal(
		app: App,
		containerEl: HTMLElement,
		data?: string
	): EditorBuilder {
		return EditorBuilder.embedded()
			.withApp(app)
			.inContainer(containerEl)
			.withData(data || "")
			.withCapabilities({
				canFold: false,
				canIndent: false,
				canSearch: false,
				supportsTimeFormat: false,
			})
			.withBehavior({
				autoFold: false,
				autoSave: false,
			});
	}

	/**
	 * Creates a read-only preview editor
	 */
	static preview(
		app: App,
		containerEl: HTMLElement,
		file: TFile
	): EditorBuilder {
		return EditorBuilder.embedded()
			.withApp(app)
			.inContainer(containerEl)
			.forFile(file)
			.readOnly(true)
			.withCapabilities({
				canFold: true,
				canIndent: false,
				canSearch: true,
				supportsTimeFormat: true,
			})
			.withBehavior({
				autoFold: false,
				autoSave: false,
			});
	}
}

/**
 * Fluent API for complex editor configurations
 */
export class AdvancedEditorBuilder extends EditorBuilder {
	/**
	 * Configures the editor for a specific use case
	 */
	forUseCase(
		useCase: "note-taking" | "task-management" | "code-editing" | "preview"
	): AdvancedEditorBuilder {
		switch (useCase) {
			case "note-taking":
				this.withCapabilities({
					canFold: true,
					canIndent: true,
					canSearch: true,
					supportsTimeFormat: true,
				}).withBehavior({
					autoFold: false,
					autoSave: true,
					syncScroll: true,
				});
				break;

			case "task-management":
				this.withCapabilities({
					canFold: true,
					canIndent: true,
					canSearch: true,
					supportsTaskGroups: true,
				}).withBehavior({
					autoFold: true,
					autoSave: true,
					groupTasks: true,
				});
				break;

			case "code-editing":
				this.withCapabilities({
					canFold: true,
					canIndent: true,
					canSearch: true,
					supportsTimeFormat: false,
				}).withBehavior({
					autoFold: false,
					autoSave: true,
					syncScroll: false,
				});
				break;

			case "preview":
				this.readOnly(true)
					.withCapabilities({
						canFold: true,
						canIndent: false,
						canSearch: true,
						supportsTimeFormat: true,
					})
					.withBehavior({
						autoFold: false,
						autoSave: false,
					});
				break;
		}

		return this;
	}

	/**
	 * Configures performance optimizations
	 */
	withPerformanceOptimizations(
		enable: boolean = true
	): AdvancedEditorBuilder {
		if (enable) {
			this.withBehavior({
				...this.config.behavior,
				lazyLoading: true,
				virtualScrolling: true,
				debounceUpdates: true,
			});
		}

		return this;
	}

	/**
	 * Configures accessibility features
	 */
	withAccessibility(enable: boolean = true): AdvancedEditorBuilder {
		if (enable) {
			this.withBehavior({
				...this.config.behavior,
				screenReaderSupport: true,
				keyboardNavigation: true,
				highContrast: false,
			});
		}

		return this;
	}

	/**
	 * Creates an advanced builder instance
	 */
	static create(): AdvancedEditorBuilder {
		return new AdvancedEditorBuilder();
	}
}
