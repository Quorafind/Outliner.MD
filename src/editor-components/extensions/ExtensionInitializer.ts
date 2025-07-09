import { defaultExtensionRegistry } from "./ExtensionManager";
import {
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

/**
 * Initializes the default extension providers
 */
export function initializeDefaultExtensions(): void {
	const registry = defaultExtensionRegistry;

	// Register all core extension providers
	registry.registerProvider(new BasicEditorProvider());
	registry.registerProvider(new KeymapProvider());
	registry.registerProvider(new FoldingProvider());
	registry.registerProvider(new TimeFormatProvider());
	registry.registerProvider(new BulletMenuProvider());
	registry.registerProvider(new TaskGroupProvider());
	registry.registerProvider(new SearchHighlightProvider());
	registry.registerProvider(new BlockIdProvider());
	registry.registerProvider(new ReadOnlyProvider());
	registry.registerProvider(new EditorTypeStyleProvider());
}

/**
 * Checks if default extensions have been initialized
 */
let initialized = false;

/**
 * Ensures default extensions are initialized (idempotent)
 */
export function ensureDefaultExtensions(): void {
	if (!initialized) {
		initializeDefaultExtensions();
		initialized = true;
	}
}

/**
 * Resets the extension system (for testing)
 */
export function resetExtensions(): void {
	defaultExtensionRegistry.getManager().clear();
	initialized = false;
}

/**
 * Gets information about registered extensions
 */
export function getExtensionInfo(): {
	providerCount: number;
	providers: Array<{ name: string; priority: number }>;
} {
	const manager = defaultExtensionRegistry.getManager();
	const providers = manager.getProviders();

	return {
		providerCount: providers.length,
		providers: providers.map(p => ({
			name: p.name,
			priority: p.priority,
		})),
	};
}

// Auto-initialize when this module is imported
ensureDefaultExtensions();
