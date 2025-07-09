import { TFile } from "obsidian";
import { EditorStateSnapshot } from "./EditorStateManager";

/**
 * Storage backend interface
 */
export interface StorageBackend {
	save(key: string, data: any): Promise<void>;
	load(key: string): Promise<any>;
	remove(key: string): Promise<void>;
	exists(key: string): Promise<boolean>;
	list(): Promise<string[]>;
	clear(): Promise<void>;
}

/**
 * Local storage backend
 */
export class LocalStorageBackend implements StorageBackend {
	async save(key: string, data: any): Promise<void> {
		try {
			localStorage.setItem(key, JSON.stringify(data));
		} catch (error) {
			throw new Error(`Failed to save to localStorage: ${error}`);
		}
	}

	async load(key: string): Promise<any> {
		try {
			const data = localStorage.getItem(key);
			return data ? JSON.parse(data) : null;
		} catch (error) {
			throw new Error(`Failed to load from localStorage: ${error}`);
		}
	}

	async remove(key: string): Promise<void> {
		localStorage.removeItem(key);
	}

	async exists(key: string): Promise<boolean> {
		return localStorage.getItem(key) !== null;
	}

	async list(): Promise<string[]> {
		const keys: string[] = [];
		for (let i = 0; i < localStorage.length; i++) {
			const key = localStorage.key(i);
			if (key) keys.push(key);
		}
		return keys;
	}

	async clear(): Promise<void> {
		localStorage.clear();
	}
}

/**
 * File-based storage backend (for Obsidian vault storage)
 */
export class FileStorageBackend implements StorageBackend {
	private vault: any; // Obsidian Vault
	private basePath: string;

	constructor(vault: any, basePath: string = '.outliner-editor-states') {
		this.vault = vault;
		this.basePath = basePath;
	}

	async save(key: string, data: any): Promise<void> {
		try {
			const filePath = `${this.basePath}/${key}.json`;
			const content = JSON.stringify(data, null, 2);
			
			// Ensure directory exists
			await this.ensureDirectory();
			
			// Save file
			await this.vault.adapter.write(filePath, content);
		} catch (error) {
			throw new Error(`Failed to save to file: ${error}`);
		}
	}

	async load(key: string): Promise<any> {
		try {
			const filePath = `${this.basePath}/${key}.json`;
			
			if (!(await this.exists(key))) {
				return null;
			}
			
			const content = await this.vault.adapter.read(filePath);
			return JSON.parse(content);
		} catch (error) {
			throw new Error(`Failed to load from file: ${error}`);
		}
	}

	async remove(key: string): Promise<void> {
		try {
			const filePath = `${this.basePath}/${key}.json`;
			if (await this.exists(key)) {
				await this.vault.adapter.remove(filePath);
			}
		} catch (error) {
			throw new Error(`Failed to remove file: ${error}`);
		}
	}

	async exists(key: string): Promise<boolean> {
		try {
			const filePath = `${this.basePath}/${key}.json`;
			return await this.vault.adapter.exists(filePath);
		} catch (error) {
			return false;
		}
	}

	async list(): Promise<string[]> {
		try {
			if (!(await this.vault.adapter.exists(this.basePath))) {
				return [];
			}
			
			const files = await this.vault.adapter.list(this.basePath);
			return files.files
				.filter((file: string) => file.endsWith('.json'))
				.map((file: string) => file.replace('.json', ''));
		} catch (error) {
			return [];
		}
	}

	async clear(): Promise<void> {
		try {
			const keys = await this.list();
			await Promise.all(keys.map(key => this.remove(key)));
		} catch (error) {
			throw new Error(`Failed to clear files: ${error}`);
		}
	}

	private async ensureDirectory(): Promise<void> {
		if (!(await this.vault.adapter.exists(this.basePath))) {
			await this.vault.adapter.mkdir(this.basePath);
		}
	}
}

/**
 * State persistence manager
 */
export class StatePersistenceManager {
	private backend: StorageBackend;
	private keyPrefix: string;
	private autoSaveInterval?: NodeJS.Timeout;

	constructor(backend: StorageBackend, keyPrefix: string = 'editor-state') {
		this.backend = backend;
		this.keyPrefix = keyPrefix;
	}

	/**
	 * Saves editor state snapshots
	 */
	async saveSnapshots(editorId: string, snapshots: EditorStateSnapshot[]): Promise<void> {
		const key = this.getSnapshotsKey(editorId);
		const data = {
			editorId,
			snapshots,
			timestamp: new Date().toISOString(),
			version: '1.0.0',
		};

		await this.backend.save(key, data);
	}

	/**
	 * Loads editor state snapshots
	 */
	async loadSnapshots(editorId: string): Promise<EditorStateSnapshot[]> {
		const key = this.getSnapshotsKey(editorId);
		const data = await this.backend.load(key);
		
		if (!data || !data.snapshots) {
			return [];
		}

		// Convert timestamp strings back to Date objects
		return data.snapshots.map((snapshot: any) => ({
			...snapshot,
			timestamp: new Date(snapshot.timestamp),
		}));
	}

	/**
	 * Saves editor metadata
	 */
	async saveMetadata(editorId: string, metadata: Record<string, any>): Promise<void> {
		const key = this.getMetadataKey(editorId);
		const data = {
			editorId,
			metadata,
			timestamp: new Date().toISOString(),
		};

		await this.backend.save(key, data);
	}

	/**
	 * Loads editor metadata
	 */
	async loadMetadata(editorId: string): Promise<Record<string, any>> {
		const key = this.getMetadataKey(editorId);
		const data = await this.backend.load(key);
		
		return data?.metadata || {};
	}

	/**
	 * Saves current snapshot index
	 */
	async saveCurrentIndex(editorId: string, index: number): Promise<void> {
		const key = this.getIndexKey(editorId);
		const data = {
			editorId,
			currentIndex: index,
			timestamp: new Date().toISOString(),
		};

		await this.backend.save(key, data);
	}

	/**
	 * Loads current snapshot index
	 */
	async loadCurrentIndex(editorId: string): Promise<number> {
		const key = this.getIndexKey(editorId);
		const data = await this.backend.load(key);
		
		return data?.currentIndex ?? -1;
	}

	/**
	 * Removes all data for an editor
	 */
	async removeEditor(editorId: string): Promise<void> {
		await Promise.all([
			this.backend.remove(this.getSnapshotsKey(editorId)),
			this.backend.remove(this.getMetadataKey(editorId)),
			this.backend.remove(this.getIndexKey(editorId)),
		]);
	}

	/**
	 * Lists all persisted editor IDs
	 */
	async listEditors(): Promise<string[]> {
		const keys = await this.backend.list();
		const editorIds = new Set<string>();

		keys.forEach(key => {
			if (key.startsWith(this.keyPrefix)) {
				const parts = key.split('-');
				if (parts.length >= 3) {
					// Extract editor ID from key format: prefix-editorId-type
					const editorId = parts.slice(2, -1).join('-');
					editorIds.add(editorId);
				}
			}
		});

		return Array.from(editorIds);
	}

	/**
	 * Checks if data exists for an editor
	 */
	async hasEditor(editorId: string): Promise<boolean> {
		return await this.backend.exists(this.getSnapshotsKey(editorId));
	}

	/**
	 * Clears all persisted data
	 */
	async clear(): Promise<void> {
		const keys = await this.backend.list();
		const editorKeys = keys.filter(key => key.startsWith(this.keyPrefix));
		
		await Promise.all(editorKeys.map(key => this.backend.remove(key)));
	}

	/**
	 * Starts auto-save functionality
	 */
	startAutoSave(intervalMs: number, getStateCallback: () => Map<string, EditorStateSnapshot[]>): void {
		if (this.autoSaveInterval) {
			clearInterval(this.autoSaveInterval);
		}

		this.autoSaveInterval = setInterval(async () => {
			try {
				const states = getStateCallback();
				await Promise.all(
					Array.from(states.entries()).map(([editorId, snapshots]) =>
						this.saveSnapshots(editorId, snapshots)
					)
				);
			} catch (error) {
				console.error('Auto-save failed:', error);
			}
		}, intervalMs);
	}

	/**
	 * Stops auto-save functionality
	 */
	stopAutoSave(): void {
		if (this.autoSaveInterval) {
			clearInterval(this.autoSaveInterval);
			this.autoSaveInterval = undefined;
		}
	}

	/**
	 * Gets the storage backend
	 */
	getBackend(): StorageBackend {
		return this.backend;
	}

	/**
	 * Sets a new storage backend
	 */
	setBackend(backend: StorageBackend): void {
		this.backend = backend;
	}

	/**
	 * Gets snapshots storage key
	 */
	private getSnapshotsKey(editorId: string): string {
		return `${this.keyPrefix}-${editorId}-snapshots`;
	}

	/**
	 * Gets metadata storage key
	 */
	private getMetadataKey(editorId: string): string {
		return `${this.keyPrefix}-${editorId}-metadata`;
	}

	/**
	 * Gets index storage key
	 */
	private getIndexKey(editorId: string): string {
		return `${this.keyPrefix}-${editorId}-index`;
	}
}

/**
 * Creates a default persistence manager with localStorage backend
 */
export function createLocalPersistenceManager(keyPrefix?: string): StatePersistenceManager {
	return new StatePersistenceManager(new LocalStorageBackend(), keyPrefix);
}

/**
 * Creates a persistence manager with file storage backend
 */
export function createFilePersistenceManager(vault: any, basePath?: string, keyPrefix?: string): StatePersistenceManager {
	return new StatePersistenceManager(new FileStorageBackend(vault, basePath), keyPrefix);
}
