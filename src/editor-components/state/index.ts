/**
 * Editor State Management System
 * 
 * This module provides comprehensive state management for editors including:
 * - State snapshots and history management
 * - Undo/redo functionality
 * - State synchronization between editors
 * - State persistence to storage
 * - Configurable storage backends
 */

// Core state management
export {
	EditorStateManager,
} from "./EditorStateManager";

export type {
	EditorStateSnapshot,
	EditorStateChange,
	StateSyncOptions,
	StatePersistenceOptions,
} from "./EditorStateManager";

// State synchronization
export {
	StateSynchronizer,
	SyncStrategy,
	SyncFilters,
} from "./StateSynchronizer";

export type {
	SyncTarget,
	SyncEvent,
} from "./StateSynchronizer";

// State persistence
export {
	StatePersistenceManager,
	LocalStorageBackend,
	FileStorageBackend,
	createLocalPersistenceManager,
	createFilePersistenceManager,
} from "./StatePersistence";

export type {
	StorageBackend,
} from "./StatePersistence";

// Re-export editor types for convenience
export { EditorType } from "../EditorTypes";
