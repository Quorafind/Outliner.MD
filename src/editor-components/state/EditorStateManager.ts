import { Editor, TFile } from "obsidian";
import { EditorType } from "../EditorTypes";

/**
 * Editor state snapshot
 */
export interface EditorStateSnapshot {
	id: string;
	editorId: string;
	timestamp: Date;
	content: string;
	selection: {
		from: number;
		to: number;
		anchor: number;
		head: number;
	};
	scrollPosition: {
		top: number;
		left: number;
	};
	metadata: Record<string, any>;
}

/**
 * Editor state change event
 */
export interface EditorStateChange {
	type: 'content' | 'selection' | 'scroll' | 'metadata';
	editorId: string;
	before: any;
	after: any;
	timestamp: Date;
}

/**
 * State synchronization options
 */
export interface StateSyncOptions {
	syncContent: boolean;
	syncSelection: boolean;
	syncScroll: boolean;
	syncMetadata: boolean;
	debounceMs: number;
}

/**
 * State persistence options
 */
export interface StatePersistenceOptions {
	enabled: boolean;
	storageKey: string;
	maxSnapshots: number;
	autoSave: boolean;
	saveInterval: number;
}

/**
 * Editor state manager for handling state synchronization, undo/redo, and persistence
 */
export class EditorStateManager {
	private editors = new Map<string, Editor>();
	private snapshots = new Map<string, EditorStateSnapshot[]>();
	private currentSnapshotIndex = new Map<string, number>();
	private changeListeners = new Set<(change: EditorStateChange) => void>();
	private syncOptions: StateSyncOptions;
	private persistenceOptions: StatePersistenceOptions;
	private debounceTimers = new Map<string, NodeJS.Timeout>();

	constructor(
		syncOptions: Partial<StateSyncOptions> = {},
		persistenceOptions: Partial<StatePersistenceOptions> = {}
	) {
		this.syncOptions = {
			syncContent: true,
			syncSelection: true,
			syncScroll: false,
			syncMetadata: true,
			debounceMs: 300,
			...syncOptions,
		};

		this.persistenceOptions = {
			enabled: false,
			storageKey: 'outliner-editor-states',
			maxSnapshots: 50,
			autoSave: true,
			saveInterval: 5000,
			...persistenceOptions,
		};

		if (this.persistenceOptions.enabled && this.persistenceOptions.autoSave) {
			this.startAutoSave();
		}
	}

	/**
	 * Registers an editor with the state manager
	 */
	registerEditor(editorId: string, editor: Editor): void {
		this.editors.set(editorId, editor);
		this.snapshots.set(editorId, []);
		this.currentSnapshotIndex.set(editorId, -1);

		// Create initial snapshot
		this.createSnapshot(editorId);

		// Set up event listeners
		this.setupEventListeners(editorId, editor);
	}

	/**
	 * Unregisters an editor from the state manager
	 */
	unregisterEditor(editorId: string): void {
		// Clean up timers
		const timer = this.debounceTimers.get(editorId);
		if (timer) {
			clearTimeout(timer);
			this.debounceTimers.delete(editorId);
		}

		// Remove from maps
		this.editors.delete(editorId);
		this.snapshots.delete(editorId);
		this.currentSnapshotIndex.delete(editorId);
	}

	/**
	 * Creates a state snapshot for an editor
	 */
	createSnapshot(editorId: string): EditorStateSnapshot | null {
		const editor = this.editors.get(editorId);
		if (!editor) return null;

		const snapshot: EditorStateSnapshot = {
			id: `${editorId}-${Date.now()}`,
			editorId,
			timestamp: new Date(),
			content: editor.getValue(),
			selection: {
				from: editor.getCursor('from').line,
				to: editor.getCursor('to').line,
				anchor: editor.getCursor('anchor').line,
				head: editor.getCursor('head').line,
			},
			scrollPosition: {
				top: editor.cm.scrollDOM.scrollTop,
				left: editor.cm.scrollDOM.scrollLeft,
			},
			metadata: {},
		};

		// Add to snapshots
		const snapshots = this.snapshots.get(editorId) || [];
		const currentIndex = this.currentSnapshotIndex.get(editorId) || -1;

		// Remove any snapshots after current index (for redo functionality)
		snapshots.splice(currentIndex + 1);

		// Add new snapshot
		snapshots.push(snapshot);

		// Limit number of snapshots
		if (snapshots.length > this.persistenceOptions.maxSnapshots) {
			snapshots.shift();
		} else {
			this.currentSnapshotIndex.set(editorId, snapshots.length - 1);
		}

		this.snapshots.set(editorId, snapshots);

		return snapshot;
	}

	/**
	 * Restores an editor to a specific snapshot
	 */
	restoreSnapshot(editorId: string, snapshot: EditorStateSnapshot): boolean {
		const editor = this.editors.get(editorId);
		if (!editor) return false;

		try {
			// Restore content
			if (this.syncOptions.syncContent) {
				editor.setValue(snapshot.content);
			}

			// Restore selection
			if (this.syncOptions.syncSelection) {
				editor.setCursor({
					line: snapshot.selection.head,
					ch: 0,
				});
			}

			// Restore scroll position
			if (this.syncOptions.syncScroll) {
				editor.cm.scrollDOM.scrollTop = snapshot.scrollPosition.top;
				editor.cm.scrollDOM.scrollLeft = snapshot.scrollPosition.left;
			}

			return true;
		} catch (error) {
			console.error('Failed to restore snapshot:', error);
			return false;
		}
	}

	/**
	 * Performs undo operation
	 */
	undo(editorId: string): boolean {
		const snapshots = this.snapshots.get(editorId);
		const currentIndex = this.currentSnapshotIndex.get(editorId);

		if (!snapshots || currentIndex === undefined || currentIndex <= 0) {
			return false;
		}

		const previousSnapshot = snapshots[currentIndex - 1];
		if (this.restoreSnapshot(editorId, previousSnapshot)) {
			this.currentSnapshotIndex.set(editorId, currentIndex - 1);
			return true;
		}

		return false;
	}

	/**
	 * Performs redo operation
	 */
	redo(editorId: string): boolean {
		const snapshots = this.snapshots.get(editorId);
		const currentIndex = this.currentSnapshotIndex.get(editorId);

		if (!snapshots || currentIndex === undefined || currentIndex >= snapshots.length - 1) {
			return false;
		}

		const nextSnapshot = snapshots[currentIndex + 1];
		if (this.restoreSnapshot(editorId, nextSnapshot)) {
			this.currentSnapshotIndex.set(editorId, currentIndex + 1);
			return true;
		}

		return false;
	}

	/**
	 * Checks if undo is available
	 */
	canUndo(editorId: string): boolean {
		const currentIndex = this.currentSnapshotIndex.get(editorId);
		return currentIndex !== undefined && currentIndex > 0;
	}

	/**
	 * Checks if redo is available
	 */
	canRedo(editorId: string): boolean {
		const snapshots = this.snapshots.get(editorId);
		const currentIndex = this.currentSnapshotIndex.get(editorId);
		return snapshots !== undefined && 
			   currentIndex !== undefined && 
			   currentIndex < snapshots.length - 1;
	}

	/**
	 * Gets all snapshots for an editor
	 */
	getSnapshots(editorId: string): EditorStateSnapshot[] {
		return this.snapshots.get(editorId) || [];
	}

	/**
	 * Gets the current snapshot index
	 */
	getCurrentSnapshotIndex(editorId: string): number {
		return this.currentSnapshotIndex.get(editorId) || -1;
	}

	/**
	 * Adds a change listener
	 */
	addChangeListener(listener: (change: EditorStateChange) => void): void {
		this.changeListeners.add(listener);
	}

	/**
	 * Removes a change listener
	 */
	removeChangeListener(listener: (change: EditorStateChange) => void): void {
		this.changeListeners.delete(listener);
	}

	/**
	 * Sets up event listeners for an editor
	 */
	private setupEventListeners(editorId: string, editor: Editor): void {
		// Content change listener
		const contentChangeHandler = () => {
			this.handleContentChange(editorId);
		};

		// Selection change listener
		const selectionChangeHandler = () => {
			this.handleSelectionChange(editorId);
		};

		// Store handlers for cleanup
		// Note: In a real implementation, you'd want to store these handlers
		// and clean them up when unregistering the editor
	}

	/**
	 * Handles content changes
	 */
	private handleContentChange(editorId: string): void {
		// Debounce snapshot creation
		const existingTimer = this.debounceTimers.get(editorId);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		const timer = setTimeout(() => {
			this.createSnapshot(editorId);
			this.debounceTimers.delete(editorId);
		}, this.syncOptions.debounceMs);

		this.debounceTimers.set(editorId, timer);
	}

	/**
	 * Handles selection changes
	 */
	private handleSelectionChange(editorId: string): void {
		// Emit selection change event
		const change: EditorStateChange = {
			type: 'selection',
			editorId,
			before: null, // Would need to track previous selection
			after: null,  // Would need current selection
			timestamp: new Date(),
		};

		this.emitChange(change);
	}

	/**
	 * Emits a state change event
	 */
	private emitChange(change: EditorStateChange): void {
		this.changeListeners.forEach(listener => {
			try {
				listener(change);
			} catch (error) {
				console.error('Error in state change listener:', error);
			}
		});
	}

	/**
	 * Starts auto-save functionality
	 */
	private startAutoSave(): void {
		if (this.persistenceOptions.saveInterval > 0) {
			setInterval(() => {
				this.saveToStorage();
			}, this.persistenceOptions.saveInterval);
		}
	}

	/**
	 * Saves state to storage
	 */
	private saveToStorage(): void {
		if (!this.persistenceOptions.enabled) return;

		try {
			const data = {
				snapshots: Object.fromEntries(this.snapshots),
				currentIndices: Object.fromEntries(this.currentSnapshotIndex),
				timestamp: new Date().toISOString(),
			};

			localStorage.setItem(this.persistenceOptions.storageKey, JSON.stringify(data));
		} catch (error) {
			console.error('Failed to save editor state:', error);
		}
	}

	/**
	 * Loads state from storage
	 */
	loadFromStorage(): void {
		if (!this.persistenceOptions.enabled) return;

		try {
			const data = localStorage.getItem(this.persistenceOptions.storageKey);
			if (!data) return;

			const parsed = JSON.parse(data);
			
			// Restore snapshots
			if (parsed.snapshots) {
				this.snapshots = new Map(Object.entries(parsed.snapshots));
			}

			// Restore current indices
			if (parsed.currentIndices) {
				this.currentSnapshotIndex = new Map(Object.entries(parsed.currentIndices));
			}
		} catch (error) {
			console.error('Failed to load editor state:', error);
		}
	}

	/**
	 * Clears all state data
	 */
	clear(): void {
		this.snapshots.clear();
		this.currentSnapshotIndex.clear();
		
		// Clear timers
		this.debounceTimers.forEach(timer => clearTimeout(timer));
		this.debounceTimers.clear();

		// Clear storage
		if (this.persistenceOptions.enabled) {
			localStorage.removeItem(this.persistenceOptions.storageKey);
		}
	}
}
