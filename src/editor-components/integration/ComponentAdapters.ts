import { App, Component, TFile, Editor, debounce, EventRef } from "obsidian";
import {
	EditorComponent,
	FileEditorComponent,
	RangeEditorComponent,
	UIEditorComponent,
	ComponentState,
	ComponentConfig,
	ComponentEventHandler,
	UIConfig,
	ButtonConfig,
	ObsidianComponentAdapter,
	ComponentFactory,
	ComponentRegistry,
	IntegrationManager,
} from "./ComponentInterfaces";
import { EditorBuilder } from "../EditorBuilder";
import { EditorType } from "../EditorConfigManager";
import { RangeUtils } from "../../utils/editorRangeUtils";

/**
 * Base implementation of EditorComponent
 */
export abstract class BaseEditorComponent implements EditorComponent {
	public component: Component;
	public editor?: Editor;
	public containerEl: HTMLElement;
	public app: App;
	protected config: ComponentConfig;
	protected eventHandlers?: ComponentEventHandler;
	protected state: ComponentState;

	constructor(app: App, containerEl: HTMLElement, config: ComponentConfig) {
		this.app = app;
		this.containerEl = containerEl;
		this.config = config;
		this.eventHandlers = config.eventHandlers;
		this.component = new Component();

		this.state = {
			initialized: false,
			hasEditor: false,
			isReadOnly: config.readOnly || false,
			hasUnsavedChanges: false,
		};
	}

	async initialize(): Promise<void> {
		if (this.state.initialized) return;

		try {
			await this.createEditor();
			this.setupEventHandlers();
			this.state.initialized = true;
			this.state.hasEditor = !!this.editor;

			this.notifyStateChanged();
		} catch (error) {
			this.handleError(error as Error);
			throw error;
		}
	}

	async destroy(): Promise<void> {
		this.removeEventHandlers();
		this.component.unload();
		this.state.initialized = false;
		this.state.hasEditor = false;
	}

	abstract update(data?: any): Promise<void>;

	getState(): ComponentState {
		return { ...this.state };
	}

	protected abstract createEditor(): Promise<void>;

	protected setupEventHandlers(): void {
		// Override in subclasses
	}

	protected removeEventHandlers(): void {
		// Override in subclasses
	}

	protected handleError(error: Error): void {
		console.error("Editor component error:", error);
		if (this.eventHandlers?.onError) {
			this.eventHandlers.onError(error);
		}
	}

	protected notifyStateChanged(): void {
		if (this.eventHandlers?.onStateChanged) {
			this.eventHandlers.onStateChanged(this.state);
		}
	}

	protected notifyContentChanged(content: string): void {
		this.state.hasUnsavedChanges = true;
		this.state.lastModified = new Date();

		if (this.eventHandlers?.onContentChanged) {
			this.eventHandlers.onContentChanged(content);
		}

		this.notifyStateChanged();
	}
}

/**
 * File-based editor component implementation
 */
export class FileEditorComponentImpl
	extends BaseEditorComponent
	implements FileEditorComponent
{
	public file?: TFile;
	public data?: string;

	constructor(
		app: App,
		containerEl: HTMLElement,
		config: ComponentConfig,
		file?: TFile
	) {
		super(app, containerEl, config);
		this.file = file;
	}

	async loadFile(file: TFile): Promise<void> {
		this.file = file;
		this.data = await this.app.vault.read(file);

		if (this.state.initialized) {
			await this.update();
		}
	}

	async saveFile(): Promise<void> {
		if (!this.file || !this.editor) return;

		const content = this.editor.getValue();
		await this.app.vault.modify(this.file, content);

		this.data = content;
		this.state.hasUnsavedChanges = false;

		if (this.eventHandlers?.onSave) {
			this.eventHandlers.onSave(this.file, content);
		}

		this.notifyStateChanged();
	}

	async reloadFile(): Promise<void> {
		if (!this.file) return;

		const newData = await this.app.vault.read(this.file);
		if (newData !== this.data) {
			this.data = newData;
			await this.update();
		}
	}

	async checkFileModified(): Promise<boolean> {
		if (!this.file) return false;

		const currentData = await this.app.vault.read(this.file);
		return currentData !== this.data;
	}

	async update(data?: string): Promise<void> {
		if (data !== undefined) {
			this.data = data;
		}

		if (this.editor && this.data !== undefined) {
			const currentContent = this.editor.getValue();
			if (currentContent !== this.data) {
				this.editor.setValue(this.data);
			}
		}
	}

	protected async createEditor(): Promise<void> {
		if (!this.file) {
			throw new Error("File is required for file editor component");
		}

		if (!this.data) {
			this.data = await this.app.vault.read(this.file);
		}

		const result = EditorBuilder.create()
			.ofType(this.config.editorType)
			.withApp(this.app)
			.inContainer(this.containerEl)
			.forFile(this.file)
			.withData(this.data)
			.readOnly(this.config.readOnly || false)
			.foldByDefault(this.config.foldByDefault || false)
			.disableTimeFormat(this.config.disableTimeFormat || false)
			.withEventHandlers({
				onSave: (file, data) => this.handleSave(file, data),
				onChange: (update) => this.handleContentChange(update),
			})
			.build();

		this.editor = result.editor;
		this.component.addChild(result.component);
	}

	protected setupEventHandlers(): void {
		super.setupEventHandlers();

		// Watch for file changes
		if (this.file) {
			const eventRef = this.app.metadataCache.on("changed", (file) => {
				if (file.path === this.file?.path) {
					this.handleFileChanged(file);
				}
			});
			this.component.registerEvent(eventRef);
		}
	}

	private handleSave = debounce(async (file: TFile, data: string) => {
		this.data = data;
		this.state.hasUnsavedChanges = false;

		if (this.eventHandlers?.onSave) {
			this.eventHandlers.onSave(file, data);
		}

		this.notifyStateChanged();
	}, 400);

	private handleContentChange(update: any): void {
		if (update.docChanged) {
			const content = update.state.doc.toString();
			this.notifyContentChanged(content);
		}
	}

	private handleFileChanged = debounce(async (file: TFile) => {
		if (this.eventHandlers?.onFileChanged) {
			this.eventHandlers.onFileChanged(file);
		}

		// Optionally reload the file
		if (!this.state.hasUnsavedChanges) {
			await this.reloadFile();
		}
	}, 800);
}

/**
 * Range-based editor component implementation
 */
export class RangeEditorComponentImpl
	extends FileEditorComponentImpl
	implements RangeEditorComponent
{
	public range?:
		| { from: number; to: number }
		| { from: number; to: number }[];

	constructor(
		app: App,
		containerEl: HTMLElement,
		config: ComponentConfig,
		file?: TFile,
		range?: { from: number; to: number } | { from: number; to: number }[]
	) {
		super(app, containerEl, config, file);
		this.range = range;
	}

	updateRange(
		range: { from: number; to: number } | { from: number; to: number }[]
	): void {
		this.range = range;

		if (this.editor) {
			if (Array.isArray(range)) {
				const typedRanges = range.map((r) => ({
					...r,
					type: "block" as const,
				}));
				RangeUtils.updateMultipleRanges(this.editor, typedRanges);
			} else {
				const typedRange = { ...range, type: "block" as const };
				RangeUtils.updateSingleRange(this.editor, typedRange);
			}
		}
	}

	getRange(): { from: number; to: number; type: string } {
		if (!this.range) {
			return { from: 0, to: this.data?.length || 0, type: "whole" };
		}

		if (Array.isArray(this.range)) {
			// Return the first range for simplicity
			return { ...this.range[0], type: "block" };
		}

		return { ...this.range, type: "block" };
	}

	protected async createEditor(): Promise<void> {
		await super.createEditor();

		// Apply range after editor creation
		if (this.range) {
			this.updateRange(this.range);
		}
	}
}

/**
 * UI-enhanced editor component implementation
 */
export class UIEditorComponentImpl
	extends RangeEditorComponentImpl
	implements UIEditorComponent
{
	private uiConfig: UIConfig;
	private uiElements: Map<string, HTMLElement> = new Map();

	constructor(
		app: App,
		containerEl: HTMLElement,
		config: ComponentConfig,
		file?: TFile,
		range?: { from: number; to: number } | { from: number; to: number }[]
	) {
		super(app, containerEl, config, file, range);

		this.uiConfig = {
			showBacklinkButton: true,
			showSourceButton: true,
			showReadonlyButton: false,
			showCollapseButton: false,
			customButtons: [],
			...config.uiConfig,
		};
	}

	addUIElements(): void {
		this.removeUIElements(); // Clean up existing elements

		if (this.uiConfig.showBacklinkButton && this.file) {
			this.addBacklinkButton();
		}

		if (this.uiConfig.showSourceButton) {
			this.addSourceButton();
		}

		if (this.uiConfig.showReadonlyButton) {
			this.addReadonlyButton();
		}

		if (this.uiConfig.showCollapseButton) {
			this.addCollapseButton();
		}

		// Add custom buttons
		for (const buttonConfig of this.uiConfig.customButtons) {
			this.addCustomButton(buttonConfig);
		}
	}

	removeUIElements(): void {
		for (const [id, element] of this.uiElements) {
			element.remove();
		}
		this.uiElements.clear();
	}

	updateUIElements(): void {
		// Update button states based on current component state
		const readonlyButton = this.uiElements.get("readonly-button");
		if (readonlyButton) {
			readonlyButton.toggleClass("active", this.state.isReadOnly);
		}
	}

	getUIConfig(): UIConfig {
		return { ...this.uiConfig };
	}

	protected async createEditor(): Promise<void> {
		await super.createEditor();
		this.addUIElements();
	}

	private addBacklinkButton(): void {
		const button = this.containerEl.createEl("div", {
			cls: "backlink-btn editor-ui-button",
		});

		// Implementation would add backlink functionality
		// This is a simplified version
		button.addEventListener("click", () => {
			if (this.file) {
				this.app.workspace.openLinkText(this.file.path, "", true);
			}
		});

		this.uiElements.set("backlink-button", button);
	}

	private addSourceButton(): void {
		const button = this.containerEl.createEl("div", {
			cls: "source-btn editor-ui-button",
		});

		button.addEventListener("click", () => {
			if (this.file) {
				const leaf = this.app.workspace.getLeaf();
				leaf.openFile(this.file);
			}
		});

		this.uiElements.set("source-button", button);
	}

	private addReadonlyButton(): void {
		const button = this.containerEl.createEl("div", {
			cls: "readonly-btn editor-ui-button",
		});

		button.addEventListener("click", () => {
			this.state.isReadOnly = !this.state.isReadOnly;
			this.updateUIElements();
			this.notifyStateChanged();
		});

		this.uiElements.set("readonly-button", button);
	}

	private addCollapseButton(): void {
		const button = this.containerEl.createEl("div", {
			cls: "collapse-btn editor-ui-button",
		});

		let collapsed = false;
		button.addEventListener("click", () => {
			collapsed = !collapsed;
			this.containerEl.toggleClass("collapsed", collapsed);
		});

		this.uiElements.set("collapse-button", button);
	}

	private addCustomButton(config: ButtonConfig): void {
		const button = this.containerEl.createEl("div", {
			cls: `custom-btn editor-ui-button ${config.className || ""}`,
		});

		if (config.tooltip) {
			button.setAttribute("title", config.tooltip);
		}

		button.addEventListener("click", config.onClick);

		if (config.onHover) {
			button.addEventListener("mouseover", config.onHover);
		}

		this.uiElements.set(config.id, button);
	}
}

/**
 * Standard Obsidian component adapter
 */
export class StandardObsidianAdapter implements ObsidianComponentAdapter {
	adapt(editorComponent: EditorComponent): Component {
		return editorComponent.component;
	}

	createEventBridge(editorComponent: EditorComponent): void {
		// Create bridges between editor component events and Obsidian events
		const component = editorComponent.component;

		// Bridge component lifecycle
		component.onload = async () => {
			if (!editorComponent.getState().initialized) {
				await editorComponent.initialize();
			}
		};

		component.onunload = async () => {
			await editorComponent.destroy();
		};
	}

	handleLifecycle(
		editorComponent: EditorComponent,
		obsidianComponent: Component
	): void {
		// Ensure proper lifecycle management
		obsidianComponent.addChild(editorComponent.component);

		// Set up cleanup
		obsidianComponent.register(() => {
			editorComponent.destroy();
		});
	}
}

/**
 * Component factory implementations
 */
export class EmbeddedEditorFactory implements ComponentFactory {
	canCreate(type: string): boolean {
		return type === "embedded" || type === "embedded-editor";
	}

	getSupportedTypes(): string[] {
		return ["embedded", "embedded-editor"];
	}

	async createComponent(
		type: string,
		app: App,
		containerEl: HTMLElement,
		config: ComponentConfig
	): Promise<EditorComponent> {
		if (!this.canCreate(type)) {
			throw new Error(`Unsupported component type: ${type}`);
		}

		// Ensure we have the right editor type
		const editorConfig = {
			...config,
			editorType: EditorType.EMBEDDED,
		};

		return new UIEditorComponentImpl(app, containerEl, editorConfig);
	}
}

export class OutlinerEditorFactory implements ComponentFactory {
	canCreate(type: string): boolean {
		return type === "outliner" || type === "outliner-editor";
	}

	getSupportedTypes(): string[] {
		return ["outliner", "outliner-editor"];
	}

	async createComponent(
		type: string,
		app: App,
		containerEl: HTMLElement,
		config: ComponentConfig
	): Promise<EditorComponent> {
		if (!this.canCreate(type)) {
			throw new Error(`Unsupported component type: ${type}`);
		}

		// Ensure we have the right editor type and default folding
		const editorConfig = {
			...config,
			editorType: EditorType.OUTLINER,
			foldByDefault: config.foldByDefault !== false,
		};

		return new UIEditorComponentImpl(app, containerEl, editorConfig);
	}
}

export class TaskGroupEditorFactory implements ComponentFactory {
	canCreate(type: string): boolean {
		return type === "task-group" || type === "task-group-editor";
	}

	getSupportedTypes(): string[] {
		return ["task-group", "task-group-editor"];
	}

	async createComponent(
		type: string,
		app: App,
		containerEl: HTMLElement,
		config: ComponentConfig
	): Promise<EditorComponent> {
		if (!this.canCreate(type)) {
			throw new Error(`Unsupported component type: ${type}`);
		}

		// Ensure we have the right editor type and default folding
		const editorConfig = {
			...config,
			editorType: EditorType.TASK_GROUP,
			foldByDefault: config.foldByDefault !== false,
		};

		return new UIEditorComponentImpl(app, containerEl, editorConfig);
	}
}

/**
 * Component registry implementation
 */
export class ComponentRegistryImpl implements ComponentRegistry {
	private factories = new Map<string, ComponentFactory>();

	constructor() {
		// Register default factories
		this.registerFactory("embedded", new EmbeddedEditorFactory());
		this.registerFactory("embedded-editor", new EmbeddedEditorFactory());
		this.registerFactory("outliner", new OutlinerEditorFactory());
		this.registerFactory("outliner-editor", new OutlinerEditorFactory());
		this.registerFactory("task-group", new TaskGroupEditorFactory());
		this.registerFactory("task-group-editor", new TaskGroupEditorFactory());
	}

	registerFactory(type: string, factory: ComponentFactory): void {
		this.factories.set(type, factory);
	}

	unregisterFactory(type: string): boolean {
		return this.factories.delete(type);
	}

	getFactory(type: string): ComponentFactory | undefined {
		return this.factories.get(type);
	}

	getRegisteredTypes(): string[] {
		return Array.from(this.factories.keys());
	}

	async createComponent(
		type: string,
		app: App,
		containerEl: HTMLElement,
		config: ComponentConfig
	): Promise<EditorComponent> {
		const factory = this.getFactory(type);
		if (!factory) {
			throw new Error(
				`No factory registered for component type: ${type}`
			);
		}

		return factory.createComponent(type, app, containerEl, config);
	}
}

/**
 * Integration manager implementation
 */
export class IntegrationManagerImpl implements IntegrationManager {
	private registry: ComponentRegistryImpl;
	private adapters = new Map<string, ObsidianComponentAdapter>();
	private managedComponents = new Set<EditorComponent>();

	constructor() {
		this.registry = new ComponentRegistryImpl();

		// Register default adapter
		const standardAdapter = new StandardObsidianAdapter();
		this.registerAdapter("default", standardAdapter);
		this.registerAdapter("embedded", standardAdapter);
		this.registerAdapter("outliner", standardAdapter);
		this.registerAdapter("task-group", standardAdapter);
	}

	async initialize(): Promise<void> {
		// Initialization logic if needed
	}

	registerAdapter(type: string, adapter: ObsidianComponentAdapter): void {
		this.adapters.set(type, adapter);
	}

	async createIntegratedComponent(
		type: string,
		app: App,
		containerEl: HTMLElement,
		config: ComponentConfig
	): Promise<{
		editorComponent: EditorComponent;
		obsidianComponent: Component;
	}> {
		// Create the editor component
		const editorComponent = await this.registry.createComponent(
			type,
			app,
			containerEl,
			config
		);

		// Get the appropriate adapter
		const adapter =
			this.adapters.get(type) || this.adapters.get("default")!;

		// Adapt to Obsidian component
		const obsidianComponent = adapter.adapt(editorComponent);

		// Set up event bridge
		adapter.createEventBridge(editorComponent);

		// Handle lifecycle
		adapter.handleLifecycle(editorComponent, obsidianComponent);

		// Track for cleanup
		this.managedComponents.add(editorComponent);

		return { editorComponent, obsidianComponent };
	}

	manageLifecycle(
		editorComponent: EditorComponent,
		obsidianComponent: Component
	): void {
		// Additional lifecycle management if needed
		this.managedComponents.add(editorComponent);

		// Set up cleanup when the Obsidian component is unloaded
		obsidianComponent.register(() => {
			this.managedComponents.delete(editorComponent);
		});
	}

	async cleanup(): Promise<void> {
		// Clean up all managed components
		for (const component of this.managedComponents) {
			try {
				await component.destroy();
			} catch (error) {
				console.error("Error cleaning up component:", error);
			}
		}

		this.managedComponents.clear();
	}
}

/**
 * Global integration manager instance
 */
export const globalIntegrationManager = new IntegrationManagerImpl();
