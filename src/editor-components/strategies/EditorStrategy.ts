import { App, Component, Editor, TFile } from "obsidian";
import { BaseEditorConfig, EditorType } from "../EditorTypes";

/**
 * Result of editor creation
 */
export interface EditorCreationResult {
	editor: Editor;
	component: Component;
	updateRange?: (range: { from: number; to: number }) => void;
	metadata?: any;
}

/**
 * Abstract base strategy for editor creation
 */
export abstract class EditorStrategy {
	/**
	 * The editor type this strategy handles
	 */
	abstract readonly type: EditorType;

	/**
	 * Validates that the configuration is appropriate for this strategy
	 */
	abstract validateConfig(config: BaseEditorConfig): void;

	/**
	 * Creates an editor instance using this strategy
	 */
	abstract createEditor(config: BaseEditorConfig): EditorCreationResult;

	/**
	 * Gets the default configuration for this editor type
	 */
	abstract getDefaultConfig(): Partial<BaseEditorConfig>;

	/**
	 * Applies strategy-specific configuration transformations
	 */
	abstract applyConfigTransformations(config: BaseEditorConfig): BaseEditorConfig;

	/**
	 * Determines if this strategy can handle the given configuration
	 */
	canHandle(config: BaseEditorConfig): boolean {
		return config.type === this.type;
	}

	/**
	 * Prepares the configuration for editor creation
	 */
	prepareConfig(config: BaseEditorConfig): BaseEditorConfig {
		// Validate the configuration
		this.validateConfig(config);

		// Merge with defaults
		const defaults = this.getDefaultConfig();
		const mergedConfig = {
			...defaults,
			...config,
			type: this.type,
		};

		// Apply strategy-specific transformations
		return this.applyConfigTransformations(mergedConfig);
	}

	/**
	 * Common validation logic for all strategies
	 */
	protected validateCommonConfig(config: BaseEditorConfig): void {
		if (!config.app) {
			throw new Error("App instance is required for all editor types");
		}
		if (!config.containerEl) {
			throw new Error("Container element is required for all editor types");
		}
	}

	/**
	 * Creates a range configuration object
	 */
	protected createRangeConfig(config: BaseEditorConfig): { from: number; to: number; type: string } {
		if (config.targetRange) {
			return {
				from: config.targetRange.from,
				to: config.targetRange.to,
				type: "part",
			};
		}

		const dataLength = config.data?.length || 0;
		return {
			from: 0,
			to: dataLength,
			type: "whole",
		};
	}

	/**
	 * Creates a component for hosting the editor
	 */
	protected createComponent(): Component {
		return new Component();
	}

	/**
	 * Applies plugin settings to configuration
	 */
	protected applyPluginSettings(config: BaseEditorConfig): BaseEditorConfig {
		if (config.plugin?.settings) {
			const result = { ...config };
			
			// Apply time format setting
			if (result.disableTimeFormat === undefined) {
				result.disableTimeFormat = !config.plugin.settings.timeFormatWidget;
			}

			return result;
		}
		return config;
	}
}

/**
 * Strategy registry for managing editor strategies
 */
export class EditorStrategyRegistry {
	private strategies = new Map<EditorType, EditorStrategy>();

	/**
	 * Registers a strategy for an editor type
	 */
	register(strategy: EditorStrategy): void {
		this.strategies.set(strategy.type, strategy);
	}

	/**
	 * Gets a strategy for the given editor type
	 */
	getStrategy(type: EditorType): EditorStrategy {
		const strategy = this.strategies.get(type);
		if (!strategy) {
			throw new Error(`No strategy registered for editor type: ${type}`);
		}
		return strategy;
	}

	/**
	 * Finds a strategy that can handle the given configuration
	 */
	findStrategy(config: BaseEditorConfig): EditorStrategy {
		if (!config.type) {
			throw new Error("Editor type must be specified in configuration");
		}
		return this.getStrategy(config.type);
	}

	/**
	 * Creates an editor using the appropriate strategy
	 */
	createEditor(config: BaseEditorConfig): EditorCreationResult {
		const strategy = this.findStrategy(config);
		const preparedConfig = strategy.prepareConfig(config);
		return strategy.createEditor(preparedConfig);
	}

	/**
	 * Gets all registered strategy types
	 */
	getRegisteredTypes(): EditorType[] {
		return Array.from(this.strategies.keys());
	}

	/**
	 * Checks if a strategy is registered for the given type
	 */
	hasStrategy(type: EditorType): boolean {
		return this.strategies.has(type);
	}

	/**
	 * Unregisters a strategy for an editor type
	 */
	unregister(type: EditorType): boolean {
		return this.strategies.delete(type);
	}

	/**
	 * Clears all registered strategies
	 */
	clear(): void {
		this.strategies.clear();
	}
}

/**
 * Default strategy registry instance
 */
export const defaultStrategyRegistry = new EditorStrategyRegistry();
