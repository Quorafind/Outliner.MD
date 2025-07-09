import { App, Component, TFile, Editor } from "obsidian";
import { EditorType } from "../EditorConfigManager";
import OutlinerViewPlugin from "../../OutlinerViewIndex";

/**
 * Base interface for all editor components
 */
export interface EditorComponent {
	/**
	 * The underlying Obsidian component
	 */
	component: Component;

	/**
	 * The editor instance
	 */
	editor?: Editor;

	/**
	 * The container element
	 */
	containerEl: HTMLElement;

	/**
	 * The app instance
	 */
	app: App;

	/**
	 * Initializes the component
	 */
	initialize(): Promise<void>;

	/**
	 * Destroys the component and cleans up resources
	 */
	destroy(): Promise<void>;

	/**
	 * Updates the component with new data
	 */
	update(data?: any): Promise<void>;

	/**
	 * Gets the current state of the component
	 */
	getState(): ComponentState;
}

/**
 * Component state interface
 */
export interface ComponentState {
	initialized: boolean;
	hasEditor: boolean;
	isReadOnly: boolean;
	hasUnsavedChanges: boolean;
	lastModified?: Date;
	metadata?: Record<string, any>;
}

/**
 * File-based editor component interface
 */
export interface FileEditorComponent extends EditorComponent {
	/**
	 * The file being edited
	 */
	file?: TFile;

	/**
	 * The current file data
	 */
	data?: string;

	/**
	 * Loads a file into the editor
	 */
	loadFile(file: TFile): Promise<void>;

	/**
	 * Saves the current content to the file
	 */
	saveFile(): Promise<void>;

	/**
	 * Reloads the file content
	 */
	reloadFile(): Promise<void>;

	/**
	 * Checks if the file has been modified externally
	 */
	checkFileModified(): Promise<boolean>;
}

/**
 * Range-based editor component interface
 */
export interface RangeEditorComponent extends EditorComponent {
	/**
	 * The current visible range
	 */
	range?: { from: number; to: number } | { from: number; to: number }[];

	/**
	 * Updates the visible range
	 */
	updateRange(range: { from: number; to: number } | { from: number; to: number }[]): void;

	/**
	 * Gets the current range
	 */
	getRange(): { from: number; to: number; type: string };
}

/**
 * UI-enhanced editor component interface
 */
export interface UIEditorComponent extends EditorComponent {
	/**
	 * Adds UI elements to the component
	 */
	addUIElements(): void;

	/**
	 * Removes UI elements from the component
	 */
	removeUIElements(): void;

	/**
	 * Updates UI elements based on current state
	 */
	updateUIElements(): void;

	/**
	 * Gets the current UI configuration
	 */
	getUIConfig(): UIConfig;
}

/**
 * UI configuration interface
 */
export interface UIConfig {
	showBacklinkButton: boolean;
	showSourceButton: boolean;
	showReadonlyButton: boolean;
	showCollapseButton: boolean;
	customButtons: ButtonConfig[];
}

/**
 * Button configuration interface
 */
export interface ButtonConfig {
	id: string;
	icon: string;
	tooltip?: string;
	className?: string;
	onClick: (event: MouseEvent) => void;
	onHover?: (event: MouseEvent) => void;
}

/**
 * Event handling interface for editor components
 */
export interface ComponentEventHandler {
	/**
	 * Handles file changes
	 */
	onFileChanged?(file: TFile): void;

	/**
	 * Handles content changes
	 */
	onContentChanged?(content: string): void;

	/**
	 * Handles save events
	 */
	onSave?(file: TFile, content: string): void;

	/**
	 * Handles error events
	 */
	onError?(error: Error): void;

	/**
	 * Handles state changes
	 */
	onStateChanged?(state: ComponentState): void;
}

/**
 * Configuration interface for editor components
 */
export interface ComponentConfig {
	/**
	 * The editor type
	 */
	editorType: EditorType;

	/**
	 * Whether the editor is read-only
	 */
	readOnly?: boolean;

	/**
	 * Whether to fold content by default
	 */
	foldByDefault?: boolean;

	/**
	 * Whether to disable time format
	 */
	disableTimeFormat?: boolean;

	/**
	 * Plugin instance
	 */
	plugin?: OutlinerViewPlugin;

	/**
	 * Event handlers
	 */
	eventHandlers?: ComponentEventHandler;

	/**
	 * UI configuration
	 */
	uiConfig?: Partial<UIConfig>;

	/**
	 * Custom metadata
	 */
	metadata?: Record<string, any>;
}

/**
 * Factory interface for creating editor components
 */
export interface ComponentFactory {
	/**
	 * Creates a component of the specified type
	 */
	createComponent(
		type: string,
		app: App,
		containerEl: HTMLElement,
		config: ComponentConfig
	): Promise<EditorComponent>;

	/**
	 * Checks if the factory can create a component of the specified type
	 */
	canCreate(type: string): boolean;

	/**
	 * Gets the supported component types
	 */
	getSupportedTypes(): string[];
}

/**
 * Adapter interface for integrating with Obsidian components
 */
export interface ObsidianComponentAdapter {
	/**
	 * Adapts an editor component to work with Obsidian's component system
	 */
	adapt(editorComponent: EditorComponent): Component;

	/**
	 * Creates a bridge between editor events and Obsidian events
	 */
	createEventBridge(editorComponent: EditorComponent): void;

	/**
	 * Handles component lifecycle integration
	 */
	handleLifecycle(editorComponent: EditorComponent, obsidianComponent: Component): void;
}

/**
 * Registry interface for managing component types
 */
export interface ComponentRegistry {
	/**
	 * Registers a component factory
	 */
	registerFactory(type: string, factory: ComponentFactory): void;

	/**
	 * Unregisters a component factory
	 */
	unregisterFactory(type: string): boolean;

	/**
	 * Gets a factory for the specified type
	 */
	getFactory(type: string): ComponentFactory | undefined;

	/**
	 * Gets all registered component types
	 */
	getRegisteredTypes(): string[];

	/**
	 * Creates a component using the appropriate factory
	 */
	createComponent(
		type: string,
		app: App,
		containerEl: HTMLElement,
		config: ComponentConfig
	): Promise<EditorComponent>;
}

/**
 * Integration manager interface
 */
export interface IntegrationManager {
	/**
	 * Initializes the integration system
	 */
	initialize(): Promise<void>;

	/**
	 * Registers component adapters
	 */
	registerAdapter(type: string, adapter: ObsidianComponentAdapter): void;

	/**
	 * Creates an integrated component
	 */
	createIntegratedComponent(
		type: string,
		app: App,
		containerEl: HTMLElement,
		config: ComponentConfig
	): Promise<{ editorComponent: EditorComponent; obsidianComponent: Component }>;

	/**
	 * Manages component lifecycle
	 */
	manageLifecycle(editorComponent: EditorComponent, obsidianComponent: Component): void;

	/**
	 * Cleans up integration resources
	 */
	cleanup(): Promise<void>;
}
