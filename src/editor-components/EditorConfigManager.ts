import { App, TFile } from "obsidian";
import OutlinerViewPlugin from "../OutlinerViewIndex";
import { OutlinerEditorView } from "../OutlinerEditorView";
import {
	EditorType,
	BaseEditorConfig,
	EmbeddedEditorConfig,
	OutlinerEditorConfig,
	TaskGroupEditorConfig,
	EditorConfig,
	EditorTypeGuards,
	EditorTypeUtils,
	DEFAULT_CAPABILITIES,
	DEFAULT_BEHAVIOR,
	DEFAULT_APPEARANCE,
} from "./EditorTypes";

// Re-export types for backward compatibility
export { EditorType }; // Enum export (value + type)
export type {
	BaseEditorConfig,
	EmbeddedEditorConfig,
	OutlinerEditorConfig,
	TaskGroupEditorConfig,
	EditorConfig,
};

/**
 * Legacy default configuration values for backward compatibility
 */
const LEGACY_DEFAULT_CONFIG: Partial<BaseEditorConfig> = {
	foldByDefault: false,
	disableTimeFormat: false,
	readOnly: false,
};

const LEGACY_EMBEDDED_DEFAULTS: Partial<BaseEditorConfig> = {
	...LEGACY_DEFAULT_CONFIG,
	foldByDefault: false,
};

const LEGACY_OUTLINER_DEFAULTS: Partial<BaseEditorConfig> = {
	...LEGACY_DEFAULT_CONFIG,
	foldByDefault: true,
};

const LEGACY_TASK_GROUP_DEFAULTS: Partial<BaseEditorConfig> = {
	...LEGACY_DEFAULT_CONFIG,
	foldByDefault: true,
};

/**
 * Manages editor configuration validation, merging, and type-specific defaults
 */
export class EditorConfigManager {
	/**
	 * Validates and merges configuration for a specific editor type using enhanced type system
	 */
	static prepareConfig<T extends EditorConfig>(
		type: EditorType,
		options: BaseEditorConfig
	): T {
		// Validate required fields based on editor type
		this.validateConfig(type, options);

		// Merge with enhanced type-specific defaults
		const mergedConfig = this.mergeWithEnhancedDefaults(type, options);

		// Apply type-specific transformations
		return this.applyTypeSpecificConfig(type, mergedConfig) as T;
	}

	/**
	 * Enhanced configuration preparation using the new type system
	 */
	static prepareEnhancedConfig<T extends EditorConfig>(
		type: EditorType,
		options: BaseEditorConfig
	): T {
		// Validate using enhanced type guards
		if (!EditorTypeGuards.validateConfigType({ ...options, type })) {
			throw new Error(`Invalid configuration for editor type: ${type}`);
		}

		// Merge with enhanced defaults
		const capabilities = EditorTypeUtils.mergeCapabilities(
			type,
			options.capabilities
		);
		const behavior = EditorTypeUtils.mergeBehavior(type, options.behavior);
		const appearance = EditorTypeUtils.mergeAppearance(options.appearance);

		const enhancedConfig: BaseEditorConfig = {
			...options,
			type,
			capabilities,
			behavior,
			appearance,
		};

		// Apply legacy field mappings for backward compatibility
		this.applyLegacyMappings(enhancedConfig);

		return enhancedConfig as T;
	}

	/**
	 * Validates that required fields are present for the given editor type
	 */
	private static validateConfig(
		type: EditorType,
		options: BaseEditorConfig
	): void {
		// Common validations
		if (!options.app) {
			throw new Error("App instance is required for all editor types");
		}
		if (!options.containerEl) {
			throw new Error(
				"Container element is required for all editor types"
			);
		}

		// Type-specific validations
		switch (type) {
			case EditorType.EMBEDDED:
				if (!options.file) {
					throw new Error("File is required for embedded editor");
				}
				break;
			case EditorType.TASK_GROUP:
				if (!options.file) {
					throw new Error("File is required for task group editor");
				}
				break;
			case EditorType.OUTLINER:
				// Outliner editors can work without a file
				break;
			default:
				throw new Error(`Unsupported editor type: ${type}`);
		}
	}

	/**
	 * Merges user options with enhanced type-specific defaults
	 */
	private static mergeWithEnhancedDefaults(
		type: EditorType,
		options: BaseEditorConfig
	): BaseEditorConfig {
		// Use enhanced type system for defaults
		const capabilities = EditorTypeUtils.mergeCapabilities(
			type,
			options.capabilities
		);
		const behavior = EditorTypeUtils.mergeBehavior(type, options.behavior);
		const appearance = EditorTypeUtils.mergeAppearance(options.appearance);

		// Merge with legacy defaults for backward compatibility
		const legacyDefaults = this.getLegacyDefaults(type);

		return {
			...legacyDefaults,
			...options,
			type,
			capabilities,
			behavior,
			appearance,
		};
	}

	/**
	 * Gets legacy defaults for backward compatibility
	 */
	private static getLegacyDefaults(
		type: EditorType
	): Partial<BaseEditorConfig> {
		switch (type) {
			case EditorType.EMBEDDED:
				return LEGACY_EMBEDDED_DEFAULTS;
			case EditorType.OUTLINER:
				return LEGACY_OUTLINER_DEFAULTS;
			case EditorType.TASK_GROUP:
				return LEGACY_TASK_GROUP_DEFAULTS;
			default:
				return LEGACY_DEFAULT_CONFIG;
		}
	}

	/**
	 * Applies legacy field mappings for backward compatibility
	 */
	private static applyLegacyMappings(config: BaseEditorConfig): void {
		// Map capabilities to legacy fields
		if (config.capabilities) {
			if (config.foldByDefault === undefined) {
				config.foldByDefault = config.capabilities.canFold;
			}
			if (config.disableTimeFormat === undefined) {
				config.disableTimeFormat =
					!config.capabilities.supportsTimeFormat;
			}
		}

		// Map behavior to legacy fields
		if (config.behavior) {
			if (config.foldByDefault === undefined) {
				config.foldByDefault = config.behavior.autoFold;
			}
		}
	}

	/**
	 * Applies type-specific configuration transformations
	 */
	private static applyTypeSpecificConfig(
		type: EditorType,
		config: BaseEditorConfig
	): BaseEditorConfig {
		const result = { ...config };

		switch (type) {
			case EditorType.EMBEDDED:
				// Embedded editors should respect plugin settings for time format
				if (config.plugin?.settings) {
					result.disableTimeFormat =
						!config.plugin.settings.timeFormatWidget;
				}
				break;
			case EditorType.OUTLINER:
				// Outliner editors should respect plugin settings for time format
				if (config.plugin?.settings) {
					result.disableTimeFormat =
						!config.plugin.settings.timeFormatWidget;
				}
				// Ensure outliner editors have fold by default
				result.foldByDefault = true;
				break;
			case EditorType.TASK_GROUP:
				// Task group editors should respect plugin settings for time format
				if (config.plugin?.settings) {
					result.disableTimeFormat =
						!config.plugin.settings.timeFormatWidget;
				}
				// Ensure task group editors have fold by default
				result.foldByDefault = true;
				break;
		}

		return result;
	}

	/**
	 * Type guard to check if config is for embedded editor
	 * @deprecated Use EditorTypeGuards.isEmbeddedConfig instead
	 */
	static isEmbeddedConfig(
		config: BaseEditorConfig
	): config is EmbeddedEditorConfig {
		return EditorTypeGuards.isEmbeddedConfig(config);
	}

	/**
	 * Type guard to check if config is for outliner editor
	 * @deprecated Use EditorTypeGuards.isOutlinerConfig instead
	 */
	static isOutlinerConfig(
		config: BaseEditorConfig
	): config is OutlinerEditorConfig {
		return EditorTypeGuards.isOutlinerConfig(config);
	}

	/**
	 * Type guard to check if config is for task group editor
	 * @deprecated Use EditorTypeGuards.isTaskGroupConfig instead
	 */
	static isTaskGroupConfig(
		config: BaseEditorConfig
	): config is TaskGroupEditorConfig {
		return EditorTypeGuards.isTaskGroupConfig(config);
	}

	/**
	 * Enhanced validation using the new type system
	 */
	static validateEnhancedConfig(config: BaseEditorConfig): boolean {
		return EditorTypeGuards.validateConfigType(config);
	}

	/**
	 * Checks if an editor type supports a specific capability
	 */
	static supportsCapability(
		type: EditorType,
		capability: keyof import("./EditorTypes").EditorCapabilities
	): boolean {
		return EditorTypeGuards.supportsCapability(type, capability);
	}

	/**
	 * Gets the appropriate range configuration for the editor type
	 */
	static getRangeConfig(config: BaseEditorConfig): {
		from: number;
		to: number;
		type: string;
	} {
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
	 * Creates a configuration object with sensible defaults for testing
	 * @internal Used for testing purposes
	 */
	static createTestConfig(
		type: EditorType,
		overrides: Partial<BaseEditorConfig> = {}
	): BaseEditorConfig {
		const mockApp = {} as any;
		const mockContainer = document.createElement("div");

		const baseConfig: BaseEditorConfig = {
			app: mockApp,
			containerEl: mockContainer,
			...overrides,
		};

		return this.prepareConfig(type, baseConfig);
	}
}
