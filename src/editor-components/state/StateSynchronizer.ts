import { Editor, TFile } from "obsidian";
import { EditorStateChange, EditorStateSnapshot } from "./EditorStateManager";

/**
 * Synchronization strategy
 */
export enum SyncStrategy {
	IMMEDIATE = "immediate",
	DEBOUNCED = "debounced",
	MANUAL = "manual",
}

/**
 * Synchronization target
 */
export interface SyncTarget {
	id: string;
	editor: Editor;
	priority: number;
	filter?: (change: EditorStateChange) => boolean;
}

/**
 * Synchronization event
 */
export interface SyncEvent {
	sourceId: string;
	targetIds: string[];
	change: EditorStateChange;
	timestamp: Date;
	success: boolean;
	error?: Error;
}

/**
 * State synchronizer for coordinating state between multiple editors
 */
export class StateSynchronizer {
	private targets = new Map<string, SyncTarget>();
	private syncListeners = new Set<(event: SyncEvent) => void>();
	private strategy: SyncStrategy;
	private debounceMs: number;
	private debounceTimers = new Map<string, NodeJS.Timeout>();

	constructor(strategy: SyncStrategy = SyncStrategy.DEBOUNCED, debounceMs: number = 300) {
		this.strategy = strategy;
		this.debounceMs = debounceMs;
	}

	/**
	 * Registers a synchronization target
	 */
	registerTarget(target: SyncTarget): void {
		this.targets.set(target.id, target);
	}

	/**
	 * Unregisters a synchronization target
	 */
	unregisterTarget(targetId: string): void {
		// Clear any pending debounce timers
		const timer = this.debounceTimers.get(targetId);
		if (timer) {
			clearTimeout(timer);
			this.debounceTimers.delete(targetId);
		}

		this.targets.delete(targetId);
	}

	/**
	 * Synchronizes a state change to relevant targets
	 */
	synchronize(change: EditorStateChange): void {
		const sourceTarget = this.targets.get(change.editorId);
		if (!sourceTarget) return;

		// Get targets to sync to (excluding source)
		const syncTargets = this.getSyncTargets(change);

		if (syncTargets.length === 0) return;

		switch (this.strategy) {
			case SyncStrategy.IMMEDIATE:
				this.performSync(change, syncTargets);
				break;
			case SyncStrategy.DEBOUNCED:
				this.performDebouncedSync(change, syncTargets);
				break;
			case SyncStrategy.MANUAL:
				// Manual sync requires explicit call to performSync
				break;
		}
	}

	/**
	 * Manually triggers synchronization
	 */
	manualSync(change: EditorStateChange): void {
		const syncTargets = this.getSyncTargets(change);
		this.performSync(change, syncTargets);
	}

	/**
	 * Gets targets that should receive the sync
	 */
	private getSyncTargets(change: EditorStateChange): SyncTarget[] {
		const targets: SyncTarget[] = [];

		for (const [id, target] of this.targets) {
			// Skip source editor
			if (id === change.editorId) continue;

			// Apply filter if present
			if (target.filter && !target.filter(change)) continue;

			targets.push(target);
		}

		// Sort by priority (higher priority first)
		return targets.sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Performs immediate synchronization
	 */
	private performSync(change: EditorStateChange, targets: SyncTarget[]): void {
		const targetIds = targets.map(t => t.id);
		let success = true;
		let error: Error | undefined;

		try {
			for (const target of targets) {
				this.applySyncToTarget(target, change);
			}
		} catch (err) {
			success = false;
			error = err as Error;
		}

		// Emit sync event
		const syncEvent: SyncEvent = {
			sourceId: change.editorId,
			targetIds,
			change,
			timestamp: new Date(),
			success,
			error,
		};

		this.emitSyncEvent(syncEvent);
	}

	/**
	 * Performs debounced synchronization
	 */
	private performDebouncedSync(change: EditorStateChange, targets: SyncTarget[]): void {
		// Clear existing timer for this editor
		const existingTimer = this.debounceTimers.get(change.editorId);
		if (existingTimer) {
			clearTimeout(existingTimer);
		}

		// Set new timer
		const timer = setTimeout(() => {
			this.performSync(change, targets);
			this.debounceTimers.delete(change.editorId);
		}, this.debounceMs);

		this.debounceTimers.set(change.editorId, timer);
	}

	/**
	 * Applies synchronization to a specific target
	 */
	private applySyncToTarget(target: SyncTarget, change: EditorStateChange): void {
		const { editor } = target;

		switch (change.type) {
			case 'content':
				if (change.after && typeof change.after === 'string') {
					editor.setValue(change.after);
				}
				break;
			case 'selection':
				if (change.after && change.after.line !== undefined) {
					editor.setCursor(change.after.line, change.after.ch || 0);
				}
				break;
			case 'scroll':
				if (change.after && editor.cm.scrollDOM) {
					editor.cm.scrollDOM.scrollTop = change.after.top || 0;
					editor.cm.scrollDOM.scrollLeft = change.after.left || 0;
				}
				break;
			case 'metadata':
				// Metadata sync would depend on specific implementation
				break;
		}
	}

	/**
	 * Adds a sync event listener
	 */
	addSyncListener(listener: (event: SyncEvent) => void): void {
		this.syncListeners.add(listener);
	}

	/**
	 * Removes a sync event listener
	 */
	removeSyncListener(listener: (event: SyncEvent) => void): void {
		this.syncListeners.delete(listener);
	}

	/**
	 * Emits a sync event
	 */
	private emitSyncEvent(event: SyncEvent): void {
		this.syncListeners.forEach(listener => {
			try {
				listener(event);
			} catch (error) {
				console.error('Error in sync event listener:', error);
			}
		});
	}

	/**
	 * Sets the synchronization strategy
	 */
	setStrategy(strategy: SyncStrategy): void {
		this.strategy = strategy;
	}

	/**
	 * Gets the current synchronization strategy
	 */
	getStrategy(): SyncStrategy {
		return this.strategy;
	}

	/**
	 * Sets the debounce time
	 */
	setDebounceMs(ms: number): void {
		this.debounceMs = ms;
	}

	/**
	 * Gets the current debounce time
	 */
	getDebounceMs(): number {
		return this.debounceMs;
	}

	/**
	 * Gets all registered targets
	 */
	getTargets(): SyncTarget[] {
		return Array.from(this.targets.values());
	}

	/**
	 * Gets a specific target by ID
	 */
	getTarget(id: string): SyncTarget | undefined {
		return this.targets.get(id);
	}

	/**
	 * Checks if a target is registered
	 */
	hasTarget(id: string): boolean {
		return this.targets.has(id);
	}

	/**
	 * Gets the number of registered targets
	 */
	getTargetCount(): number {
		return this.targets.size;
	}

	/**
	 * Clears all targets and timers
	 */
	clear(): void {
		// Clear all debounce timers
		this.debounceTimers.forEach(timer => clearTimeout(timer));
		this.debounceTimers.clear();

		// Clear targets
		this.targets.clear();

		// Clear listeners
		this.syncListeners.clear();
	}
}

/**
 * Utility functions for creating sync filters
 */
export class SyncFilters {
	/**
	 * Creates a filter that only allows specific change types
	 */
	static changeTypes(...types: EditorStateChange['type'][]): (change: EditorStateChange) => boolean {
		return (change) => types.includes(change.type);
	}

	/**
	 * Creates a filter that excludes specific change types
	 */
	static excludeChangeTypes(...types: EditorStateChange['type'][]): (change: EditorStateChange) => boolean {
		return (change) => !types.includes(change.type);
	}

	/**
	 * Creates a filter that only allows changes from specific editors
	 */
	static fromEditors(...editorIds: string[]): (change: EditorStateChange) => boolean {
		return (change) => editorIds.includes(change.editorId);
	}

	/**
	 * Creates a filter that excludes changes from specific editors
	 */
	static excludeEditors(...editorIds: string[]): (change: EditorStateChange) => boolean {
		return (change) => !editorIds.includes(change.editorId);
	}

	/**
	 * Creates a filter that only allows changes within a time window
	 */
	static timeWindow(windowMs: number): (change: EditorStateChange) => boolean {
		return (change) => {
			const now = new Date().getTime();
			const changeTime = change.timestamp.getTime();
			return (now - changeTime) <= windowMs;
		};
	}

	/**
	 * Combines multiple filters with AND logic
	 */
	static and(...filters: ((change: EditorStateChange) => boolean)[]): (change: EditorStateChange) => boolean {
		return (change) => filters.every(filter => filter(change));
	}

	/**
	 * Combines multiple filters with OR logic
	 */
	static or(...filters: ((change: EditorStateChange) => boolean)[]): (change: EditorStateChange) => boolean {
		return (change) => filters.some(filter => filter(change));
	}

	/**
	 * Negates a filter
	 */
	static not(filter: (change: EditorStateChange) => boolean): (change: EditorStateChange) => boolean {
		return (change) => !filter(change);
	}
}
