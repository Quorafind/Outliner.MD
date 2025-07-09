/**
 * Editor Strategy Pattern Implementation
 * 
 * This module provides a strategy pattern implementation for creating different types of editors.
 * Each editor type has its own strategy class that handles type-specific logic and configuration.
 */

// Base strategy classes
export { EditorStrategy, EditorStrategyRegistry, defaultStrategyRegistry } from "./EditorStrategy";
export type { EditorCreationResult } from "./EditorStrategy";

// Concrete strategy implementations
export { EmbeddedEditorStrategy } from "./EmbeddedEditorStrategy";
export { OutlinerEditorStrategy } from "./OutlinerEditorStrategy";
export { TaskGroupEditorStrategy } from "./TaskGroupEditorStrategy";

// Strategy factory and utilities
export { 
	StrategyFactory, 
	defaultStrategyFactory,
	createEditor,
	getStrategy,
	registerStrategy,
	validateConfig,
	prepareConfig
} from "./StrategyFactory";

/**
 * Re-export editor types for convenience
 */
export { EditorType } from "../EditorTypes";
export type { BaseEditorConfig, EmbeddedEditorConfig, OutlinerEditorConfig, TaskGroupEditorConfig } from "../EditorTypes";
