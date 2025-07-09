import { EditorStrategy, EditorStrategyRegistry, defaultStrategyRegistry } from "./EditorStrategy";
import { EmbeddedEditorStrategy } from "./EmbeddedEditorStrategy";
import { OutlinerEditorStrategy } from "./OutlinerEditorStrategy";
import { TaskGroupEditorStrategy } from "./TaskGroupEditorStrategy";
import { EditorType, BaseEditorConfig } from "../EditorTypes";

/**
 * Factory for creating and managing editor strategies
 */
export class StrategyFactory {
	private registry: EditorStrategyRegistry;

	constructor(registry?: EditorStrategyRegistry) {
		this.registry = registry || defaultStrategyRegistry;
		this.initializeDefaultStrategies();
	}

	/**
	 * Initializes the default strategies
	 */
	private initializeDefaultStrategies(): void {
		// Register all default strategies
		this.registry.register(new EmbeddedEditorStrategy());
		this.registry.register(new OutlinerEditorStrategy());
		this.registry.register(new TaskGroupEditorStrategy());
	}

	/**
	 * Creates an editor using the strategy pattern
	 */
	createEditor(type: EditorType, config: BaseEditorConfig) {
		return this.registry.createEditor({ ...config, type });
	}

	/**
	 * Gets a strategy for the given type
	 */
	getStrategy(type: EditorType): EditorStrategy {
		return this.registry.getStrategy(type);
	}

	/**
	 * Registers a custom strategy
	 */
	registerStrategy(strategy: EditorStrategy): void {
		this.registry.register(strategy);
	}

	/**
	 * Unregisters a strategy
	 */
	unregisterStrategy(type: EditorType): boolean {
		return this.registry.unregister(type);
	}

	/**
	 * Gets all registered strategy types
	 */
	getAvailableTypes(): EditorType[] {
		return this.registry.getRegisteredTypes();
	}

	/**
	 * Checks if a strategy is available for the given type
	 */
	hasStrategy(type: EditorType): boolean {
		return this.registry.hasStrategy(type);
	}

	/**
	 * Validates that a configuration can be handled by a strategy
	 */
	validateConfig(config: BaseEditorConfig): boolean {
		try {
			const strategy = this.registry.findStrategy(config);
			strategy.validateConfig(config);
			return true;
		} catch (error) {
			return false;
		}
	}

	/**
	 * Gets the default configuration for an editor type
	 */
	getDefaultConfig(type: EditorType): Partial<BaseEditorConfig> {
		const strategy = this.getStrategy(type);
		return strategy.getDefaultConfig();
	}

	/**
	 * Prepares a configuration using the appropriate strategy
	 */
	prepareConfig(type: EditorType, config: BaseEditorConfig): BaseEditorConfig {
		const strategy = this.getStrategy(type);
		return strategy.prepareConfig({ ...config, type });
	}
}

/**
 * Default strategy factory instance
 */
export const defaultStrategyFactory = new StrategyFactory();

/**
 * Convenience function to create an editor using the default strategy factory
 */
export function createEditor(type: EditorType, config: BaseEditorConfig) {
	return defaultStrategyFactory.createEditor(type, config);
}

/**
 * Convenience function to get a strategy using the default strategy factory
 */
export function getStrategy(type: EditorType): EditorStrategy {
	return defaultStrategyFactory.getStrategy(type);
}

/**
 * Convenience function to register a strategy using the default strategy factory
 */
export function registerStrategy(strategy: EditorStrategy): void {
	defaultStrategyFactory.registerStrategy(strategy);
}

/**
 * Convenience function to validate configuration using the default strategy factory
 */
export function validateConfig(config: BaseEditorConfig): boolean {
	return defaultStrategyFactory.validateConfig(config);
}

/**
 * Convenience function to prepare configuration using the default strategy factory
 */
export function prepareConfig(type: EditorType, config: BaseEditorConfig): BaseEditorConfig {
	return defaultStrategyFactory.prepareConfig(type, config);
}
