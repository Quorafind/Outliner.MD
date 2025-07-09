/**
 * Editor Plugin System
 *
 * This module provides a comprehensive plugin system for editors that allows
 * for modular addition of features like search highlighting, bullet menus,
 * task groups, etc. It replaces the current hardcoded extension additions
 * with a flexible, extensible architecture.
 *
 * Key Features:
 * - Plugin lifecycle management (load, unload, enable, disable)
 * - Dependency management between plugins
 * - Settings management with validation
 * - Integration with the existing extension system
 * - Built-in plugins for common functionality
 *
 * Usage:
 * ```typescript
 * import { globalPluginManager, registerPlugin } from './plugins';
 * import { MyCustomPlugin } from './MyCustomPlugin';
 *
 * // Register a custom plugin
 * await registerPlugin(new MyCustomPlugin());
 *
 * // Build extensions for an editor
 * const extensions = globalPluginManager.buildExtensions(editorConfig);
 * ```
 */

import {
	globalPluginManager,
	EditorPluginRegistry,
	EditorPluginManager,
	BaseEditorPlugin,
	registerPlugin,
	unregisterPlugin,
	getPluginRegistry,
	buildPluginExtensions,
} from "./EditorPluginSystem";

import {
	SearchHighlightPlugin,
	BulletMenuPlugin,
	TaskGroupPlugin,
	DateRenderPlugin,
	PlaceholderPlugin,
	createBuiltinPlugins,
	registerBuiltinPlugins,
} from "./BuiltinPlugins";

// Core plugin system exports
export {
	// Base classes
	BaseEditorPlugin,

	// Registry and management
	EditorPluginRegistry,
	EditorPluginManager,

	// Global instances and convenience functions
	globalPluginManager,
	registerPlugin,
	unregisterPlugin,
	getPluginRegistry,
	buildPluginExtensions,
};

// Type exports
export type {
	// Interfaces
	PluginMetadata,
	PluginConfig,
	PluginLifecycle,
	EditorPlugin,
} from "./EditorPluginSystem";

// Built-in plugins
export {
	SearchHighlightPlugin,
	BulletMenuPlugin,
	TaskGroupPlugin,
	DateRenderPlugin,
	PlaceholderPlugin,
	createBuiltinPlugins,
	registerBuiltinPlugins,
};

// Re-export extension system types for convenience
export type {
	ExtensionConfig,
	ExtensionProvider,
} from "../extensions/ExtensionManager";

/**
 * Initializes the plugin system with built-in plugins
 */
export async function initializePluginSystem(): Promise<void> {
	try {
		await registerBuiltinPlugins(globalPluginManager);
		console.log("Plugin system initialized with built-in plugins");
	} catch (error) {
		console.error("Failed to initialize plugin system:", error);
		throw error;
	}
}

/**
 * Creates a plugin-aware extension provider that can be registered
 * with the main extension system
 */
export function createPluginExtensionProvider(): import("../extensions/ExtensionManager").ExtensionProvider {
	return globalPluginManager.createPluginExtensionProvider();
}

/**
 * Validates plugin metadata
 */
export function validatePluginMetadata(
	metadata: import("./EditorPluginSystem").PluginMetadata
): boolean {
	if (!metadata.id || typeof metadata.id !== "string") {
		return false;
	}

	if (!metadata.name || typeof metadata.name !== "string") {
		return false;
	}

	if (!metadata.version || typeof metadata.version !== "string") {
		return false;
	}

	// Validate version format (basic semver check)
	const versionRegex = /^\d+\.\d+\.\d+/;
	if (!versionRegex.test(metadata.version)) {
		return false;
	}

	return true;
}

/**
 * Creates a basic plugin configuration
 */
export function createBasicPluginConfig(
	overrides: Partial<import("./EditorPluginSystem").PluginConfig> = {}
): import("./EditorPluginSystem").PluginConfig {
	return {
		enabled: true,
		priority: 0,
		settings: {},
		...overrides,
	};
}

/**
 * Merges plugin settings with defaults
 */
export function mergePluginSettings(
	defaults: Record<string, any>,
	settings: Record<string, any>
): Record<string, any> {
	return { ...defaults, ...settings };
}

/**
 * Creates a plugin ID from name and author
 */
export function createPluginId(name: string, author?: string): string {
	const cleanName = name.toLowerCase().replace(/[^a-z0-9]/g, "-");
	if (author) {
		const cleanAuthor = author.toLowerCase().replace(/[^a-z0-9]/g, "-");
		return `${cleanAuthor}-${cleanName}`;
	}
	return cleanName;
}

/**
 * Plugin system configuration
 */
export interface PluginSystemConfig {
	/**
	 * Whether to automatically load built-in plugins
	 */
	autoLoadBuiltins: boolean;

	/**
	 * Maximum number of plugins that can be loaded
	 */
	maxPlugins?: number;

	/**
	 * Whether to enable plugin validation
	 */
	enableValidation: boolean;

	/**
	 * Plugin directories to scan for plugins
	 */
	pluginDirectories?: string[];
}

/**
 * Default plugin system configuration
 */
export const defaultPluginSystemConfig: PluginSystemConfig = {
	autoLoadBuiltins: true,
	enableValidation: true,
	maxPlugins: 100,
};

/**
 * Plugin system status
 */
export interface PluginSystemStatus {
	initialized: boolean;
	totalPlugins: number;
	enabledPlugins: number;
	loadedPlugins: number;
	errors: string[];
}

/**
 * Gets the current status of the plugin system
 */
export function getPluginSystemStatus(): PluginSystemStatus {
	const registry = globalPluginManager.getRegistry();
	const allPlugins = registry.getPlugins();
	const enabledPlugins = registry.getEnabledPlugins();

	let loadedCount = 0;
	for (const plugin of allPlugins) {
		if (registry.isPluginLoaded(plugin.metadata.id)) {
			loadedCount++;
		}
	}

	return {
		initialized: true,
		totalPlugins: allPlugins.length,
		enabledPlugins: enabledPlugins.length,
		loadedPlugins: loadedCount,
		errors: [], // TODO: Implement error tracking
	};
}

/**
 * Plugin system events
 */
export enum PluginSystemEvent {
	PLUGIN_REGISTERED = "plugin-registered",
	PLUGIN_UNREGISTERED = "plugin-unregistered",
	PLUGIN_LOADED = "plugin-loaded",
	PLUGIN_UNLOADED = "plugin-unloaded",
	PLUGIN_ENABLED = "plugin-enabled",
	PLUGIN_DISABLED = "plugin-disabled",
	PLUGIN_ERROR = "plugin-error",
}

/**
 * Plugin system event data
 */
export interface PluginSystemEventData {
	pluginId: string;
	event: PluginSystemEvent;
	timestamp: number;
	error?: Error;
	metadata?: import("./EditorPluginSystem").PluginMetadata;
}

// TODO: Implement event system for plugin lifecycle events
// This would allow other parts of the application to react to plugin changes
