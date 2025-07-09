/**
 * Editor Lifecycle Management System
 * 
 * This module provides comprehensive lifecycle management for editors,
 * including creation, initialization, activation, updates, and destruction.
 * It ensures proper resource management and provides hooks for custom
 * lifecycle event handling.
 */

// Core lifecycle management
export {
	EditorLifecycleManager,
	EditorLifecycleState,
	defaultLifecycleManager,
} from "./EditorLifecycleManager";

export type {
	EditorLifecycleEvents,
	EditorInstance,
} from "./EditorLifecycleManager";

// Lifecycle event handlers
export {
	DefaultLifecycleEventHandlers,
	EmbeddedEditorLifecycleHandlers,
	OutlinerEditorLifecycleHandlers,
	TaskGroupEditorLifecycleHandlers,
	LifecycleEventHandlerFactory,
	createLifecycleEventHandlers,
} from "./LifecycleEventHandlers";

// Re-export editor types for convenience
export { EditorType } from "../EditorTypes";
