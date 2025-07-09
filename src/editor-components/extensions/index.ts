/**
 * Editor Extension Management System
 * 
 * This module provides a flexible extension system for editors that allows
 * for modular addition and removal of features based on editor type and
 * configuration. Extensions are provided by registered providers that can
 * be prioritized and conditionally loaded.
 */

// Core extension management
export {
	EditorExtensionManager,
	ExtensionRegistry,
	defaultExtensionManager,
	defaultExtensionRegistry,
	buildExtensions,
	registerExtensionProvider,
	createExtensionManager,
} from "./ExtensionManager";

export type {
	ExtensionConfig,
	ExtensionProvider,
} from "./ExtensionManager";

export {
	BaseExtensionProvider,
} from "./ExtensionManager";

// Core extension providers
export {
	BasicEditorProvider,
	KeymapProvider,
	FoldingProvider,
	TimeFormatProvider,
	BulletMenuProvider,
	TaskGroupProvider,
	SearchHighlightProvider,
	BlockIdProvider,
	ReadOnlyProvider,
	EditorTypeStyleProvider,
} from "./CoreExtensionProviders";

// Extension initialization
export {
	initializeDefaultExtensions,
	ensureDefaultExtensions,
	resetExtensions,
	getExtensionInfo,
} from "./ExtensionInitializer";

// Re-export editor types for convenience
export { EditorType } from "../EditorTypes";
export type { EditorCapabilities } from "../EditorTypes";
