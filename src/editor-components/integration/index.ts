/**
 * Editor Component Integration System
 *
 * This module provides standardized interfaces and adapters for integrating
 * editors with Obsidian components. It simplifies the integration code and
 * provides a consistent API for all editor types.
 *
 * Key Features:
 * - Standardized component interfaces
 * - Automatic lifecycle management
 * - Event handling and bridging
 * - UI element management
 * - Factory pattern for component creation
 * - Registry for component types
 * - Adapters for Obsidian integration
 *
 * Usage Examples:
 *
 * Create an integrated component:
 * ```typescript
 * import { globalIntegrationManager } from './integration';
 *
 * const { editorComponent, obsidianComponent } = await globalIntegrationManager
 *   .createIntegratedComponent("embedded", app, containerEl, {
 *     editorType: EditorType.EMBEDDED,
 *     readOnly: false,
 *     eventHandlers: {
 *       onSave: (file, content) => console.log("Saved:", file.path),
 *     },
 *   });
 * ```
 *
 * Create a custom component:
 * ```typescript
 * import { UIEditorComponentImpl } from './integration';
 *
 * class MyCustomComponent extends UIEditorComponentImpl {
 *   async update(data?: any): Promise<void> {
 *     // Custom update logic
 *     await super.update(data);
 *   }
 * }
 * ```
 *
 * Register a custom factory:
 * ```typescript
 * import { globalIntegrationManager } from './integration';
 *
 * class MyCustomFactory implements ComponentFactory {
 *   // Implementation
 * }
 *
 * globalIntegrationManager.registerAdapter("custom", new MyCustomFactory());
 * ```
 */

// Core interfaces
export type {
	EditorComponent,
	FileEditorComponent,
	RangeEditorComponent,
	UIEditorComponent,
	ComponentState,
	ComponentConfig,
	ComponentEventHandler,
	UIConfig,
	ButtonConfig,
	ComponentFactory,
	ObsidianComponentAdapter,
	ComponentRegistry,
	IntegrationManager,
} from "./ComponentInterfaces";

// Component implementations
export {
	BaseEditorComponent,
	FileEditorComponentImpl,
	RangeEditorComponentImpl,
	UIEditorComponentImpl,
	StandardObsidianAdapter,
	EmbeddedEditorFactory,
	OutlinerEditorFactory,
	TaskGroupEditorFactory,
	ComponentRegistryImpl,
	IntegrationManagerImpl,
	globalIntegrationManager,
} from "./ComponentAdapters";

// Import types for internal use
import type {
	ComponentConfig,
	EditorComponent,
	ComponentEventHandler,
	UIConfig,
	IntegrationManager,
} from "./ComponentInterfaces";

// Static imports moved from dynamic imports
import { globalIntegrationManager } from "./ComponentAdapters";
import { EditorType } from "../EditorConfigManager";
import {
	FileEditorComponentImpl,
	IntegrationManagerImpl,
} from "./ComponentAdapters";

/**
 * Creates an embedded editor component
 */
export async function createEmbeddedEditor(
	app: import("obsidian").App,
	containerEl: HTMLElement,
	file: import("obsidian").TFile,
	config: Partial<ComponentConfig> = {}
): Promise<{
	editorComponent: EditorComponent;
	obsidianComponent: import("obsidian").Component;
}> {
	return globalIntegrationManager.createIntegratedComponent(
		"embedded",
		app,
		containerEl,
		{
			editorType: EditorType.EMBEDDED,
			...config,
		}
	);
}

/**
 * Creates an outliner editor component
 */
export async function createOutlinerEditor(
	app: import("obsidian").App,
	containerEl: HTMLElement,
	config: Partial<ComponentConfig> = {}
): Promise<{
	editorComponent: EditorComponent;
	obsidianComponent: import("obsidian").Component;
}> {
	return globalIntegrationManager.createIntegratedComponent(
		"outliner",
		app,
		containerEl,
		{
			editorType: EditorType.OUTLINER,
			foldByDefault: true,
			...config,
		}
	);
}

/**
 * Creates a task group editor component
 */
export async function createTaskGroupEditor(
	app: import("obsidian").App,
	containerEl: HTMLElement,
	file: import("obsidian").TFile,
	config: Partial<ComponentConfig> = {}
): Promise<{
	editorComponent: EditorComponent;
	obsidianComponent: import("obsidian").Component;
}> {
	return globalIntegrationManager.createIntegratedComponent(
		"task-group",
		app,
		containerEl,
		{
			editorType: EditorType.TASK_GROUP,
			foldByDefault: true,
			...config,
		}
	);
}

/**
 * Creates a component with custom configuration
 */
export async function createCustomComponent(
	type: string,
	app: import("obsidian").App,
	containerEl: HTMLElement,
	config: ComponentConfig
): Promise<{
	editorComponent: EditorComponent;
	obsidianComponent: import("obsidian").Component;
}> {
	return globalIntegrationManager.createIntegratedComponent(
		type,
		app,
		containerEl,
		config
	);
}

/**
 * Migrates an existing EmbeddedEditor to the new component system
 */
export async function migrateEmbeddedEditor(
	legacyEditor: any,
	app: import("obsidian").App,
	containerEl: HTMLElement
): Promise<{
	editorComponent: EditorComponent;
	obsidianComponent: import("obsidian").Component;
}> {
	// Extract configuration from legacy editor
	const config: ComponentConfig = {
		editorType: EditorType.EMBEDDED,
		readOnly: legacyEditor.readOnly || false,
		eventHandlers: {
			onSave: legacyEditor.requestSave,
			onFileChanged: legacyEditor.onFileChanged,
		},
	};

	// Create new component
	const result = await createEmbeddedEditor(
		app,
		containerEl,
		legacyEditor.file,
		config
	);

	// Transfer any existing data
	if (
		legacyEditor.data &&
		result.editorComponent instanceof FileEditorComponentImpl
	) {
		await result.editorComponent.update(legacyEditor.data);
	}

	return result;
}

/**
 * Migrates an existing TaskGroupEditor to the new component system
 */
export async function migrateTaskGroupEditor(
	legacyEditor: any,
	app: import("obsidian").App,
	containerEl: HTMLElement
): Promise<{
	editorComponent: EditorComponent;
	obsidianComponent: import("obsidian").Component;
}> {
	// Extract configuration from legacy editor
	const config: ComponentConfig = {
		editorType: EditorType.TASK_GROUP,
		foldByDefault: true,
		eventHandlers: {
			onSave: legacyEditor.requestSave,
		},
	};

	// Create new component
	const result = await createTaskGroupEditor(
		app,
		containerEl,
		legacyEditor.file,
		config
	);

	return result;
}

/**
 * Provides a compatibility layer for legacy component APIs
 */
export function createCompatibilityLayer(
	editorComponent: EditorComponent
): any {
	return {
		// Legacy API compatibility
		get editor() {
			return editorComponent.editor;
		},

		get component() {
			return editorComponent.component;
		},

		get containerEl() {
			return editorComponent.containerEl;
		},

		get app() {
			return editorComponent.app;
		},

		// Legacy methods
		async onload() {
			await editorComponent.initialize();
		},

		async onunload() {
			await editorComponent.destroy();
		},

		update(data: any) {
			return editorComponent.update(data);
		},

		getState() {
			return editorComponent.getState();
		},
	};
}

/**
 * Integration system configuration
 */
export interface IntegrationConfig {
	/**
	 * Whether to automatically initialize the integration system
	 */
	autoInitialize: boolean;

	/**
	 * Default UI configuration for components
	 */
	defaultUIConfig: Partial<UIConfig>;

	/**
	 * Default event handlers
	 */
	defaultEventHandlers: Partial<ComponentEventHandler>;

	/**
	 * Whether to enable migration utilities
	 */
	enableMigration: boolean;
}

/**
 * Default integration configuration
 */
export const defaultIntegrationConfig: IntegrationConfig = {
	autoInitialize: true,
	defaultUIConfig: {
		showBacklinkButton: true,
		showSourceButton: true,
		showReadonlyButton: false,
		showCollapseButton: false,
		customButtons: [],
	},
	defaultEventHandlers: {},
	enableMigration: true,
};

/**
 * Initializes the integration system
 */
export async function initializeIntegrationSystem(
	config: Partial<IntegrationConfig> = {}
): Promise<void> {
	const finalConfig = { ...defaultIntegrationConfig, ...config };

	try {
		await globalIntegrationManager.initialize();
		console.log("Editor component integration system initialized");
	} catch (error) {
		console.error("Failed to initialize integration system:", error);
		throw error;
	}
}

/**
 * Gets the global integration manager
 */
export async function getIntegrationManager(): Promise<IntegrationManager> {
	return globalIntegrationManager;
}

/**
 * Component type constants
 */
export const ComponentTypes = {
	EMBEDDED: "embedded",
	EMBEDDED_EDITOR: "embedded-editor",
	OUTLINER: "outliner",
	OUTLINER_EDITOR: "outliner-editor",
	TASK_GROUP: "task-group",
	TASK_GROUP_EDITOR: "task-group-editor",
} as const;

/**
 * Integration system status
 */
export interface IntegrationStatus {
	initialized: boolean;
	registeredTypes: string[];
	managedComponents: number;
	adapters: string[];
}

/**
 * Gets the current status of the integration system
 */
export async function getIntegrationStatus(): Promise<IntegrationStatus> {
	const manager = await getIntegrationManager();

	return {
		initialized: true, // Assume initialized if we can get the manager
		registeredTypes: [], // Would need to expose this from the manager
		managedComponents: 0, // Would need to expose this from the manager
		adapters: [], // Would need to expose this from the manager
	};
}
