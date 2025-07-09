import { Editor, Component, App, TFile } from "obsidian";
import { EditorType, BaseEditorConfig } from "../EditorTypes";

/**
 * Editor lifecycle states
 */
export enum EditorLifecycleState {
	CREATED = "created",
	INITIALIZING = "initializing",
	INITIALIZED = "initialized",
	ACTIVE = "active",
	UPDATING = "updating",
	DESTROYING = "destroying",
	DESTROYED = "destroyed",
	ERROR = "error",
}

/**
 * Editor lifecycle events
 */
export interface EditorLifecycleEvents {
	onStateChange?: (state: EditorLifecycleState, editor: Editor) => void;
	onCreated?: (editor: Editor) => void;
	onInitialized?: (editor: Editor) => void;
	onActivated?: (editor: Editor) => void;
	onUpdated?: (editor: Editor, changes: any) => void;
	onDestroying?: (editor: Editor) => void;
	onDestroyed?: (editorId: string) => void;
	onError?: (error: Error, editor?: Editor) => void;
}

/**
 * Editor instance metadata
 */
export interface EditorInstance {
	id: string;
	editor: Editor;
	component: Component;
	config: BaseEditorConfig;
	state: EditorLifecycleState;
	created: Date;
	lastUpdated: Date;
	updateRange?: (range: { from: number; to: number }) => void;
	metadata?: any;
}

/**
 * Lifecycle manager for editors
 */
export class EditorLifecycleManager {
	private instances = new Map<string, EditorInstance>();
	private events: EditorLifecycleEvents = {};
	private nextId = 1;

	/**
	 * Sets lifecycle event handlers
	 */
	setEventHandlers(events: EditorLifecycleEvents): void {
		this.events = { ...this.events, ...events };
	}

	/**
	 * Generates a unique editor ID
	 */
	private generateId(): string {
		return `editor-${Date.now()}-${this.nextId++}`;
	}

	/**
	 * Changes the state of an editor instance
	 */
	private changeState(instance: EditorInstance, newState: EditorLifecycleState): void {
		const oldState = instance.state;
		instance.state = newState;
		instance.lastUpdated = new Date();

		// Emit state change event
		if (this.events.onStateChange) {
			try {
				this.events.onStateChange(newState, instance.editor);
			} catch (error) {
				console.error("Error in onStateChange handler:", error);
			}
		}

		// Emit specific lifecycle events
		this.emitLifecycleEvent(newState, instance);
	}

	/**
	 * Emits specific lifecycle events
	 */
	private emitLifecycleEvent(state: EditorLifecycleState, instance: EditorInstance): void {
		try {
			switch (state) {
				case EditorLifecycleState.CREATED:
					this.events.onCreated?.(instance.editor);
					break;
				case EditorLifecycleState.INITIALIZED:
					this.events.onInitialized?.(instance.editor);
					break;
				case EditorLifecycleState.ACTIVE:
					this.events.onActivated?.(instance.editor);
					break;
				case EditorLifecycleState.DESTROYING:
					this.events.onDestroying?.(instance.editor);
					break;
				case EditorLifecycleState.DESTROYED:
					this.events.onDestroyed?.(instance.id);
					break;
			}
		} catch (error) {
			console.error(`Error in lifecycle event handler for ${state}:`, error);
			this.handleError(error, instance.editor);
		}
	}

	/**
	 * Handles errors in the lifecycle
	 */
	private handleError(error: Error, editor?: Editor): void {
		if (this.events.onError) {
			try {
				this.events.onError(error, editor);
			} catch (handlerError) {
				console.error("Error in error handler:", handlerError);
			}
		} else {
			console.error("Editor lifecycle error:", error);
		}
	}

	/**
	 * Creates a new editor instance
	 */
	createEditor(
		editor: Editor,
		component: Component,
		config: BaseEditorConfig,
		updateRange?: (range: { from: number; to: number }) => void,
		metadata?: any
	): string {
		const id = this.generateId();
		const now = new Date();

		const instance: EditorInstance = {
			id,
			editor,
			component,
			config,
			state: EditorLifecycleState.CREATED,
			created: now,
			lastUpdated: now,
			updateRange,
			metadata,
		};

		this.instances.set(id, instance);
		this.changeState(instance, EditorLifecycleState.CREATED);

		return id;
	}

	/**
	 * Initializes an editor instance
	 */
	async initializeEditor(id: string): Promise<void> {
		const instance = this.instances.get(id);
		if (!instance) {
			throw new Error(`Editor instance not found: ${id}`);
		}

		try {
			this.changeState(instance, EditorLifecycleState.INITIALIZING);

			// Perform initialization logic here
			// This could include setting up event listeners, loading data, etc.
			await this.performInitialization(instance);

			this.changeState(instance, EditorLifecycleState.INITIALIZED);
		} catch (error) {
			this.changeState(instance, EditorLifecycleState.ERROR);
			this.handleError(error as Error, instance.editor);
			throw error;
		}
	}

	/**
	 * Performs the actual initialization logic
	 */
	private async performInitialization(instance: EditorInstance): Promise<void> {
		// Add the component as a child if it's not already added
		if (instance.component && !instance.component._loaded) {
			// This would typically be done by the parent component
			// instance.component.load();
		}

		// Set up any additional initialization logic here
		// For example, loading file content, setting up event listeners, etc.
	}

	/**
	 * Activates an editor instance
	 */
	activateEditor(id: string): void {
		const instance = this.instances.get(id);
		if (!instance) {
			throw new Error(`Editor instance not found: ${id}`);
		}

		if (instance.state !== EditorLifecycleState.INITIALIZED) {
			throw new Error(`Editor must be initialized before activation: ${id}`);
		}

		this.changeState(instance, EditorLifecycleState.ACTIVE);
	}

	/**
	 * Updates an editor instance
	 */
	updateEditor(id: string, changes: any): void {
		const instance = this.instances.get(id);
		if (!instance) {
			throw new Error(`Editor instance not found: ${id}`);
		}

		try {
			const oldState = instance.state;
			this.changeState(instance, EditorLifecycleState.UPDATING);

			// Emit update event
			if (this.events.onUpdated) {
				this.events.onUpdated(instance.editor, changes);
			}

			// Restore previous state
			this.changeState(instance, oldState);
		} catch (error) {
			this.changeState(instance, EditorLifecycleState.ERROR);
			this.handleError(error as Error, instance.editor);
		}
	}

	/**
	 * Destroys an editor instance
	 */
	async destroyEditor(id: string): Promise<void> {
		const instance = this.instances.get(id);
		if (!instance) {
			return; // Already destroyed or never existed
		}

		try {
			this.changeState(instance, EditorLifecycleState.DESTROYING);

			// Perform cleanup
			await this.performCleanup(instance);

			// Remove from instances
			this.instances.delete(id);

			this.changeState(instance, EditorLifecycleState.DESTROYED);
		} catch (error) {
			this.handleError(error as Error, instance.editor);
		}
	}

	/**
	 * Performs cleanup for an editor instance
	 */
	private async performCleanup(instance: EditorInstance): Promise<void> {
		// Unload the component if it's loaded
		if (instance.component && instance.component._loaded) {
			instance.component.unload();
		}

		// Additional cleanup logic can be added here
	}

	/**
	 * Gets an editor instance by ID
	 */
	getInstance(id: string): EditorInstance | undefined {
		return this.instances.get(id);
	}

	/**
	 * Gets all editor instances
	 */
	getAllInstances(): EditorInstance[] {
		return Array.from(this.instances.values());
	}

	/**
	 * Gets instances by state
	 */
	getInstancesByState(state: EditorLifecycleState): EditorInstance[] {
		return this.getAllInstances().filter(instance => instance.state === state);
	}

	/**
	 * Gets instances by editor type
	 */
	getInstancesByType(type: EditorType): EditorInstance[] {
		return this.getAllInstances().filter(instance => instance.config.type === type);
	}

	/**
	 * Checks if an editor instance exists
	 */
	hasInstance(id: string): boolean {
		return this.instances.has(id);
	}

	/**
	 * Gets the count of instances
	 */
	getInstanceCount(): number {
		return this.instances.size;
	}

	/**
	 * Destroys all editor instances
	 */
	async destroyAll(): Promise<void> {
		const ids = Array.from(this.instances.keys());
		await Promise.all(ids.map(id => this.destroyEditor(id)));
	}

	/**
	 * Gets lifecycle statistics
	 */
	getStatistics(): {
		total: number;
		byState: Record<EditorLifecycleState, number>;
		byType: Record<EditorType, number>;
	} {
		const instances = this.getAllInstances();
		const byState: Record<EditorLifecycleState, number> = {} as any;
		const byType: Record<EditorType, number> = {} as any;

		// Initialize counters
		Object.values(EditorLifecycleState).forEach(state => {
			byState[state] = 0;
		});
		Object.values(EditorType).forEach(type => {
			byType[type] = 0;
		});

		// Count instances
		instances.forEach(instance => {
			byState[instance.state]++;
			if (instance.config.type) {
				byType[instance.config.type]++;
			}
		});

		return {
			total: instances.length,
			byState,
			byType,
		};
	}
}

/**
 * Default lifecycle manager instance
 */
export const defaultLifecycleManager = new EditorLifecycleManager();
