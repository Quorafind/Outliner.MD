/**
 * Editor Builder System
 *
 * This module provides a fluent API builder pattern for creating editors
 * that makes editor creation more readable and maintainable while supporting
 * complex configuration scenarios.
 *
 * Key Features:
 * - Fluent API for readable editor configuration
 * - Predefined templates for common use cases
 * - Advanced builder with specialized configurations
 * - Type-safe configuration validation
 * - Integration with all editor creation methods
 *
 * Usage Examples:
 *
 * Basic embedded editor:
 * ```typescript
 * const result = EditorBuilder.embedded()
 *   .withApp(app)
 *   .inContainer(containerEl)
 *   .forFile(file)
 *   .readOnly(true)
 *   .build();
 * ```
 *
 * Full-featured outliner:
 * ```typescript
 * const result = EditorBuilderTemplates.fullOutliner(app, containerEl, plugin, view)
 *   .withLifecycleManagement(true)
 *   .build();
 * ```
 *
 * Advanced configuration:
 * ```typescript
 * const result = AdvancedEditorBuilder.create()
 *   .asOutliner()
 *   .withApp(app)
 *   .inContainer(containerEl)
 *   .forUseCase("note-taking")
 *   .withPerformanceOptimizations(true)
 *   .withAccessibility(true)
 *   .build();
 * ```
 */

import { App, TFile } from "obsidian";
import {
	EditorBuilder,
	EditorBuilderTemplates,
	AdvancedEditorBuilder,
	type EditorBuilderResult,
	type BuilderConfig,
} from "../EditorBuilder";
import {
	type EditorType,
	type BaseEditorConfig,
	type EditorConfig,
} from "../EditorConfigManager";
import {
	type EditorCapabilities,
	type EditorBehavior,
	type EditorAppearance,
} from "../EditorTypes";
import { OutlinerEditorView } from "../../OutlinerEditorView";
import OutlinerViewPlugin from "../../OutlinerViewIndex";

// Re-export the builder classes
export {
	EditorBuilder,
	EditorBuilderTemplates,
	AdvancedEditorBuilder,
	type EditorBuilderResult,
	type BuilderConfig,
};

// Re-export related types for convenience
export type { EditorType, BaseEditorConfig, EditorConfig };

export type { EditorCapabilities, EditorBehavior, EditorAppearance };

/**
 * Builder utilities and helper functions
 */
/**
 * Creates a basic configuration object
 */
export function createBasicConfig(
	app: App,
	containerEl: HTMLElement
): Partial<BuilderConfig> {
	return {
		app,
		containerEl,
	};
}

/**
 * Validates builder configuration
 */
export function validateBuilderConfig(config: Partial<BuilderConfig>): boolean {
	if (!config.app) {
		console.error("App instance is required");
		return false;
	}

	if (!config.containerEl) {
		console.error("Container element is required");
		return false;
	}

	return true;
}

/**
 * Merges multiple configurations
 */
export function mergeConfigs(
	...configs: Partial<BuilderConfig>[]
): Partial<BuilderConfig> {
	return configs.reduce((merged, config) => {
		return {
			...merged,
			...config,
			capabilities: {
				...merged.capabilities,
				...config.capabilities,
			},
			behavior: {
				...merged.behavior,
				...config.behavior,
			},
			appearance: {
				...merged.appearance,
				...config.appearance,
			},
		};
	}, {});
}

/**
 * Creates a configuration preset
 */
export function createPreset(
	name: string,
	config: Partial<BuilderConfig>
): (builder: EditorBuilder) => EditorBuilder {
	return (builder) => {
		// Apply the preset configuration
		if (config.capabilities) {
			builder.withCapabilities(config.capabilities);
		}
		if (config.behavior) {
			builder.withBehavior(config.behavior);
		}
		if (config.appearance) {
			builder.withAppearance(config.appearance);
		}
		if (config.readOnly !== undefined) {
			builder.readOnly(config.readOnly);
		}
		if (config.foldByDefault !== undefined) {
			builder.foldByDefault(config.foldByDefault);
		}
		if (config.disableTimeFormat !== undefined) {
			builder.disableTimeFormat(config.disableTimeFormat);
		}

		return builder;
	};
}

/**
 * Common builder presets
 */
export const BuilderPresets = {
	/**
	 * Minimal editor preset
	 */
	minimal: createPreset("minimal", {
		capabilities: {
			canFold: false,
			canIndent: false,
			canSearch: false,
			supportsTimeFormat: false,
		},
		behavior: {
			autoFold: false,
			autoSave: false,
		},
	}),

	/**
	 * Full-featured preset
	 */
	fullFeatured: createPreset("full-featured", {
		capabilities: {
			canFold: true,
			canIndent: true,
			canSearch: true,
			supportsTimeFormat: true,
		},
		behavior: {
			autoFold: true,
			autoSave: true,
			syncScroll: true,
		},
	}),

	/**
	 * Read-only preset
	 */
	readOnly: createPreset("read-only", {
		readOnly: true,
		capabilities: {
			canFold: true,
			canIndent: false,
			canSearch: true,
			supportsTimeFormat: true,
		},
		behavior: {
			autoFold: false,
			autoSave: false,
		},
	}),

	/**
	 * Performance-optimized preset
	 */
	performanceOptimized: createPreset("performance-optimized", {
		behavior: {
			lazyLoading: true,
			virtualScrolling: true,
			debounceUpdates: true,
		},
	}),

	/**
	 * Accessibility-focused preset
	 */
	accessible: createPreset("accessible", {
		behavior: {
			screenReaderSupport: true,
			keyboardNavigation: true,
			highContrast: false,
		},
	}),
};

/**
 * Builder factory for creating builders with common configurations
 */
export class BuilderFactory {
	/**
	 * Creates a builder with minimal configuration
	 */
	static minimal(app: App, containerEl: HTMLElement): EditorBuilder {
		return EditorBuilder.create()
			.withApp(app)
			.inContainer(containerEl)
			.pipe(BuilderPresets.minimal);
	}

	/**
	 * Creates a builder with full-featured configuration
	 */
	static fullFeatured(app: App, containerEl: HTMLElement): EditorBuilder {
		return EditorBuilder.create()
			.withApp(app)
			.inContainer(containerEl)
			.pipe(BuilderPresets.fullFeatured);
	}

	/**
	 * Creates a builder with read-only configuration
	 */
	static readOnly(app: App, containerEl: HTMLElement): EditorBuilder {
		return EditorBuilder.create()
			.withApp(app)
			.inContainer(containerEl)
			.pipe(BuilderPresets.readOnly);
	}

	/**
	 * Creates a builder with performance optimizations
	 */
	static performanceOptimized(
		app: App,
		containerEl: HTMLElement
	): EditorBuilder {
		return EditorBuilder.create()
			.withApp(app)
			.inContainer(containerEl)
			.pipe(BuilderPresets.performanceOptimized);
	}

	/**
	 * Creates a builder with accessibility features
	 */
	static accessible(app: App, containerEl: HTMLElement): EditorBuilder {
		return EditorBuilder.create()
			.withApp(app)
			.inContainer(containerEl)
			.pipe(BuilderPresets.accessible);
	}
}

/**
 * Convenience functions for quick editor creation
 */
/**
 * Quickly creates a basic embedded editor
 */
export function embeddedEditor(
	app: App,
	containerEl: HTMLElement,
	file: TFile,
	readOnly: boolean = false
): EditorBuilderResult {
	return EditorBuilder.embedded()
		.withApp(app)
		.inContainer(containerEl)
		.forFile(file)
		.readOnly(readOnly)
		.build();
}

/**
 * Quickly creates an outliner editor
 */
export function outlinerEditor(
	app: App,
	containerEl: HTMLElement,
	plugin: OutlinerViewPlugin,
	view: OutlinerEditorView
): EditorBuilderResult {
	return EditorBuilderTemplates.fullOutliner(
		app,
		containerEl,
		plugin,
		view
	).build();
}

/**
 * Quickly creates a task group editor
 */
export function taskGroupEditor(
	app: App,
	containerEl: HTMLElement,
	file: TFile,
	plugin: OutlinerViewPlugin
): EditorBuilderResult {
	return EditorBuilderTemplates.taskGroupEditor(
		app,
		containerEl,
		file,
		plugin
	).build();
}
