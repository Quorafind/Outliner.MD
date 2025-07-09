import { Extension, Prec } from "@codemirror/state";
import { keymap } from "@codemirror/view";
import { EditorType, EditorCapabilities } from "../EditorTypes";

/**
 * Extension configuration for different editor types
 */
export interface ExtensionConfig {
	type: EditorType;
	capabilities: EditorCapabilities;
	disableTimeFormat?: boolean;
	readOnly?: boolean;
	customExtensions?: Extension[];
}

/**
 * Extension provider interface
 */
export interface ExtensionProvider {
	/**
	 * The name of this extension provider
	 */
	name: string;

	/**
	 * Priority of this provider (higher numbers load first)
	 */
	priority: number;

	/**
	 * Whether this provider can provide extensions for the given config
	 */
	canProvide(config: ExtensionConfig): boolean;

	/**
	 * Provides extensions for the given configuration
	 */
	provide(config: ExtensionConfig): Extension[];
}

/**
 * Base extension provider class
 */
export abstract class BaseExtensionProvider implements ExtensionProvider {
	public name: string;
	public priority: number;

	constructor(name: string, priority: number = 0) {
		this.name = name;
		this.priority = priority;
	}

	abstract canProvide(config: ExtensionConfig): boolean;
	abstract provide(config: ExtensionConfig): Extension[];

	/**
	 * Helper method to check if editor type matches
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
}

/**
 * Manager for editor extensions
 */
export class EditorExtensionManager {
	private providers: ExtensionProvider[] = [];

	/**
	 * Registers an extension provider
	 */
	registerProvider(provider: ExtensionProvider): void {
		this.providers.push(provider);
		// Sort by priority (highest first)
		this.providers.sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Unregisters an extension provider
	 */
	unregisterProvider(provider: ExtensionProvider): boolean {
		const index = this.providers.indexOf(provider);
		if (index !== -1) {
			this.providers.splice(index, 1);
			return true;
		}
		return false;
	}

	/**
	 * Gets all registered providers
	 */
	getProviders(): ExtensionProvider[] {
		return [...this.providers];
	}

	/**
	 * Gets providers that can handle the given configuration
	 */
	getCompatibleProviders(config: ExtensionConfig): ExtensionProvider[] {
		return this.providers.filter((provider) => provider.canProvide(config));
	}

	/**
	 * Builds extensions for the given configuration
	 */
	buildExtensions(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Get all compatible providers
		const compatibleProviders = this.getCompatibleProviders(config);

		// Collect extensions from all providers
		for (const provider of compatibleProviders) {
			try {
				const providerExtensions = provider.provide(config);
				extensions.push(...providerExtensions);
			} catch (error) {
				console.error(
					`Error loading extensions from provider ${provider.name}:`,
					error
				);
			}
		}

		// Add custom extensions if provided
		if (config.customExtensions) {
			extensions.push(...config.customExtensions);
		}

		return extensions;
	}

	/**
	 * Clears all registered providers
	 */
	clear(): void {
		this.providers = [];
	}

	/**
	 * Gets provider by name
	 */
	getProvider(name: string): ExtensionProvider | undefined {
		return this.providers.find((provider) => provider.name === name);
	}

	/**
	 * Checks if a provider is registered
	 */
	hasProvider(name: string): boolean {
		return this.getProvider(name) !== undefined;
	}
}

/**
 * Extension registry for managing global extension providers
 */
export class ExtensionRegistry {
	private static instance: ExtensionRegistry;
	private manager: EditorExtensionManager;

	private constructor() {
		this.manager = new EditorExtensionManager();
	}

	/**
	 * Gets the singleton instance
	 */
	static getInstance(): ExtensionRegistry {
		if (!ExtensionRegistry.instance) {
			ExtensionRegistry.instance = new ExtensionRegistry();
		}
		return ExtensionRegistry.instance;
	}

	/**
	 * Gets the extension manager
	 */
	getManager(): EditorExtensionManager {
		return this.manager;
	}

	/**
	 * Registers a global extension provider
	 */
	registerProvider(provider: ExtensionProvider): void {
		this.manager.registerProvider(provider);
	}

	/**
	 * Unregisters a global extension provider
	 */
	unregisterProvider(provider: ExtensionProvider): boolean {
		return this.manager.unregisterProvider(provider);
	}

	/**
	 * Builds extensions using the global registry
	 */
	buildExtensions(config: ExtensionConfig): Extension[] {
		return this.manager.buildExtensions(config);
	}
}

/**
 * Default extension manager instance
 */
export const defaultExtensionManager = new EditorExtensionManager();

/**
 * Default extension registry instance
 */
export const defaultExtensionRegistry = ExtensionRegistry.getInstance();

/**
 * Build extensions using the default registry
 */
export function buildExtensions(config: ExtensionConfig): Extension[] {
	return defaultExtensionRegistry.buildExtensions(config);
}

/**
 * Convenience function to register a provider
 */
export function registerExtensionProvider(provider: ExtensionProvider): void {
	defaultExtensionRegistry.registerProvider(provider);
}

/**
 * Convenience function to create an extension manager
 */
export function createExtensionManager(): EditorExtensionManager {
	return new EditorExtensionManager();
}

/**
 * Initializes the extension system
 */
export async function initializeExtensionSystem(): Promise<void> {
	console.log("Extension system initialized");
}
