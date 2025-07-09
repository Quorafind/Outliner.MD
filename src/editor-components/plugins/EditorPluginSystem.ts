import { Extension } from "@codemirror/state";
import { EditorType, EditorCapabilities } from "../EditorTypes";
import {
	ExtensionConfig,
	ExtensionProvider,
	BaseExtensionProvider,
} from "../extensions/ExtensionManager";

/**
 * Plugin metadata interface
 */
export interface PluginMetadata {
	id: string;
	name: string;
	version: string;
	description?: string;
	author?: string;
	dependencies?: string[];
	tags?: string[];
}

/**
 * Plugin configuration interface
 */
export interface PluginConfig {
	enabled: boolean;
	settings?: Record<string, any>;
	priority?: number;
}

/**
 * Plugin lifecycle hooks
 */
export interface PluginLifecycle {
	/**
	 * Called when the plugin is loaded
	 */
	onLoad?(): void | Promise<void>;

	/**
	 * Called when the plugin is unloaded
	 */
	onUnload?(): void | Promise<void>;

	/**
	 * Called when the plugin is enabled
	 */
	onEnable?(): void | Promise<void>;

	/**
	 * Called when the plugin is disabled
	 */
	onDisable?(): void | Promise<void>;

	/**
	 * Called when plugin settings are updated
	 */
	onSettingsUpdate?(settings: Record<string, any>): void | Promise<void>;
}

/**
 * Editor plugin interface
 */
export interface EditorPlugin extends PluginLifecycle {
	/**
	 * Plugin metadata
	 */
	metadata: PluginMetadata;

	/**
	 * Plugin configuration
	 */
	config: PluginConfig;

	/**
	 * Extension providers this plugin contributes
	 */
	extensionProviders?: ExtensionProvider[];

	/**
	 * Custom extension factory method
	 */
	createExtensions?(config: ExtensionConfig): Extension[];

	/**
	 * Checks if this plugin is compatible with the given editor configuration
	 */
	isCompatible?(config: ExtensionConfig): boolean;

	/**
	 * Gets plugin-specific settings schema
	 */
	getSettingsSchema?(): Record<string, any>;

	/**
	 * Validates plugin settings
	 */
	validateSettings?(settings: Record<string, any>): boolean;
}

/**
 * Base plugin class that implements common functionality
 */
export abstract class BaseEditorPlugin implements EditorPlugin {
	public metadata: PluginMetadata;
	public config: PluginConfig;

	constructor(metadata: PluginMetadata, config: Partial<PluginConfig> = {}) {
		this.metadata = metadata;
		this.config = {
			enabled: true,
			priority: 0,
			...config,
		};
	}

	/**
	 * Default compatibility check - can be overridden
	 */
	isCompatible(config: ExtensionConfig): boolean {
		return true;
	}

	/**
	 * Default settings validation - can be overridden
	 */
	validateSettings(settings: Record<string, any>): boolean {
		return true;
	}

	/**
	 * Helper method to check if editor type is supported
	 */
	protected supportsEditorType(
		config: ExtensionConfig,
		types: EditorType[]
	): boolean {
		return types.includes(config.type);
	}

	/**
	 * Helper method to check if capability is enabled
	 */
	protected hasCapability(
		config: ExtensionConfig,
		capability: keyof EditorCapabilities
	): boolean {
		return config.capabilities[capability] === true;
	}

	/**
	 * Helper method to get plugin setting
	 */
	protected getSetting<T>(key: string, defaultValue?: T): T {
		return this.config.settings?.[key] ?? defaultValue;
	}

	/**
	 * Helper method to set plugin setting
	 */
	protected setSetting(key: string, value: any): void {
		if (!this.config.settings) {
			this.config.settings = {};
		}
		this.config.settings[key] = value;
	}
}

/**
 * Plugin registry for managing editor plugins
 */
export class EditorPluginRegistry {
	private plugins = new Map<string, EditorPlugin>();
	private loadedPlugins = new Set<string>();
	private enabledPlugins = new Set<string>();

	/**
	 * Registers a plugin
	 */
	async registerPlugin(plugin: EditorPlugin): Promise<void> {
		const id = plugin.metadata.id;

		// Check for duplicate IDs
		if (this.plugins.has(id)) {
			throw new Error(`Plugin with ID '${id}' is already registered`);
		}

		// Validate dependencies
		if (plugin.metadata.dependencies) {
			for (const dep of plugin.metadata.dependencies) {
				if (!this.plugins.has(dep)) {
					throw new Error(
						`Plugin '${id}' depends on '${dep}' which is not registered`
					);
				}
			}
		}

		// Register the plugin
		this.plugins.set(id, plugin);

		// Load the plugin if it's enabled
		if (plugin.config.enabled) {
			await this.loadPlugin(id);
		}
	}

	/**
	 * Unregisters a plugin
	 */
	async unregisterPlugin(id: string): Promise<boolean> {
		const plugin = this.plugins.get(id);
		if (!plugin) {
			return false;
		}

		// Check for dependents
		const dependents = this.getDependents(id);
		if (dependents.length > 0) {
			throw new Error(
				`Cannot unregister plugin '${id}' because it has dependents: ${dependents.join(
					", "
				)}`
			);
		}

		// Unload the plugin if it's loaded
		if (this.loadedPlugins.has(id)) {
			await this.unloadPlugin(id);
		}

		// Remove from registry
		this.plugins.delete(id);
		return true;
	}

	/**
	 * Loads a plugin
	 */
	async loadPlugin(id: string): Promise<void> {
		const plugin = this.plugins.get(id);
		if (!plugin) {
			throw new Error(`Plugin '${id}' is not registered`);
		}

		if (this.loadedPlugins.has(id)) {
			return; // Already loaded
		}

		// Load dependencies first
		if (plugin.metadata.dependencies) {
			for (const dep of plugin.metadata.dependencies) {
				if (!this.loadedPlugins.has(dep)) {
					await this.loadPlugin(dep);
				}
			}
		}

		// Call plugin's onLoad hook
		if (plugin.onLoad) {
			await plugin.onLoad();
		}

		this.loadedPlugins.add(id);

		// Enable the plugin if it's configured to be enabled
		if (plugin.config.enabled) {
			await this.enablePlugin(id);
		}
	}

	/**
	 * Unloads a plugin
	 */
	async unloadPlugin(id: string): Promise<void> {
		const plugin = this.plugins.get(id);
		if (!plugin || !this.loadedPlugins.has(id)) {
			return;
		}

		// Disable the plugin first
		if (this.enabledPlugins.has(id)) {
			await this.disablePlugin(id);
		}

		// Call plugin's onUnload hook
		if (plugin.onUnload) {
			await plugin.onUnload();
		}

		this.loadedPlugins.delete(id);
	}

	/**
	 * Enables a plugin
	 */
	async enablePlugin(id: string): Promise<void> {
		const plugin = this.plugins.get(id);
		if (!plugin) {
			throw new Error(`Plugin '${id}' is not registered`);
		}

		if (!this.loadedPlugins.has(id)) {
			await this.loadPlugin(id);
		}

		if (this.enabledPlugins.has(id)) {
			return; // Already enabled
		}

		// Call plugin's onEnable hook
		if (plugin.onEnable) {
			await plugin.onEnable();
		}

		this.enabledPlugins.add(id);
		plugin.config.enabled = true;
	}

	/**
	 * Disables a plugin
	 */
	async disablePlugin(id: string): Promise<void> {
		const plugin = this.plugins.get(id);
		if (!plugin || !this.enabledPlugins.has(id)) {
			return;
		}

		// Call plugin's onDisable hook
		if (plugin.onDisable) {
			await plugin.onDisable();
		}

		this.enabledPlugins.delete(id);
		plugin.config.enabled = false;
	}

	/**
	 * Gets all registered plugins
	 */
	getPlugins(): EditorPlugin[] {
		return Array.from(this.plugins.values());
	}

	/**
	 * Gets enabled plugins
	 */
	getEnabledPlugins(): EditorPlugin[] {
		return Array.from(this.enabledPlugins)
			.map((id) => this.plugins.get(id)!)
			.filter((plugin) => plugin !== undefined);
	}

	/**
	 * Gets a plugin by ID
	 */
	getPlugin(id: string): EditorPlugin | undefined {
		return this.plugins.get(id);
	}

	/**
	 * Checks if a plugin is registered
	 */
	hasPlugin(id: string): boolean {
		return this.plugins.has(id);
	}

	/**
	 * Checks if a plugin is loaded
	 */
	isPluginLoaded(id: string): boolean {
		return this.loadedPlugins.has(id);
	}

	/**
	 * Checks if a plugin is enabled
	 */
	isPluginEnabled(id: string): boolean {
		return this.enabledPlugins.has(id);
	}

	/**
	 * Gets plugins that depend on the given plugin
	 */
	private getDependents(id: string): string[] {
		const dependents: string[] = [];
		for (const [pluginId, plugin] of this.plugins) {
			if (plugin.metadata.dependencies?.includes(id)) {
				dependents.push(pluginId);
			}
		}
		return dependents;
	}

	/**
	 * Updates plugin settings
	 */
	async updatePluginSettings(
		id: string,
		settings: Record<string, any>
	): Promise<void> {
		const plugin = this.plugins.get(id);
		if (!plugin) {
			throw new Error(`Plugin '${id}' is not registered`);
		}

		// Validate settings if plugin provides validation
		if (plugin.validateSettings && !plugin.validateSettings(settings)) {
			throw new Error(`Invalid settings for plugin '${id}'`);
		}

		// Update settings
		plugin.config.settings = { ...plugin.config.settings, ...settings };

		// Call plugin's onSettingsUpdate hook if it's enabled
		if (this.enabledPlugins.has(id) && plugin.onSettingsUpdate) {
			await plugin.onSettingsUpdate(settings);
		}
	}

	/**
	 * Gets compatible plugins for the given editor configuration
	 */
	getCompatiblePlugins(config: ExtensionConfig): EditorPlugin[] {
		return this.getEnabledPlugins().filter((plugin) => {
			return !plugin.isCompatible || plugin.isCompatible(config);
		});
	}

	/**
	 * Builds extensions from all compatible plugins
	 */
	buildExtensions(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];
		const compatiblePlugins = this.getCompatiblePlugins(config);

		// Sort plugins by priority (higher first)
		compatiblePlugins.sort(
			(a, b) => (b.config.priority || 0) - (a.config.priority || 0)
		);

		for (const plugin of compatiblePlugins) {
			try {
				// Add extensions from extension providers
				if (plugin.extensionProviders) {
					for (const provider of plugin.extensionProviders) {
						if (provider.canProvide(config)) {
							const providerExtensions = provider.provide(config);
							extensions.push(...providerExtensions);
						}
					}
				}

				// Add extensions from custom factory method
				if (plugin.createExtensions) {
					const pluginExtensions = plugin.createExtensions(config);
					extensions.push(...pluginExtensions);
				}
			} catch (error) {
				console.error(
					`Error loading extensions from plugin ${plugin.metadata.id}:`,
					error
				);
			}
		}

		return extensions;
	}

	/**
	 * Clears all plugins
	 */
	async clear(): Promise<void> {
		// Unload all plugins
		for (const id of Array.from(this.loadedPlugins)) {
			await this.unloadPlugin(id);
		}

		// Clear all collections
		this.plugins.clear();
		this.loadedPlugins.clear();
		this.enabledPlugins.clear();
	}
}

/**
 * Plugin manager that integrates with the extension system
 */
export class EditorPluginManager {
	private registry: EditorPluginRegistry;

	constructor() {
		this.registry = new EditorPluginRegistry();
	}

	/**
	 * Gets the plugin registry
	 */
	getRegistry(): EditorPluginRegistry {
		return this.registry;
	}

	/**
	 * Registers a plugin
	 */
	async registerPlugin(plugin: EditorPlugin): Promise<void> {
		return this.registry.registerPlugin(plugin);
	}

	/**
	 * Unregisters a plugin
	 */
	async unregisterPlugin(id: string): Promise<boolean> {
		return this.registry.unregisterPlugin(id);
	}

	/**
	 * Builds extensions for the given configuration using all compatible plugins
	 */
	buildExtensions(config: ExtensionConfig): Extension[] {
		return this.registry.buildExtensions(config);
	}

	/**
	 * Creates a plugin-aware extension provider
	 */
	createPluginExtensionProvider(): ExtensionProvider {
		return new PluginExtensionProvider(this.registry);
	}
}

/**
 * Extension provider that delegates to the plugin system
 */
class PluginExtensionProvider extends BaseExtensionProvider {
	private registry: EditorPluginRegistry;

	constructor(registry: EditorPluginRegistry) {
		super("plugin-system", 1000); // High priority
		this.registry = registry;
	}

	canProvide(config: ExtensionConfig): boolean {
		return this.registry.getCompatiblePlugins(config).length > 0;
	}

	provide(config: ExtensionConfig): Extension[] {
		return this.registry.buildExtensions(config);
	}
}

/**
 * Global plugin manager instance
 */
export const globalPluginManager = new EditorPluginManager();

/**
 * Convenience functions for plugin management
 */
export async function registerPlugin(plugin: EditorPlugin): Promise<void> {
	return globalPluginManager.registerPlugin(plugin);
}

export async function unregisterPlugin(id: string): Promise<boolean> {
	return globalPluginManager.unregisterPlugin(id);
}

export function getPluginRegistry(): EditorPluginRegistry {
	return globalPluginManager.getRegistry();
}

export function buildPluginExtensions(config: ExtensionConfig): Extension[] {
	return globalPluginManager.buildExtensions(config);
}
