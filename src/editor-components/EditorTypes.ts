import { App, TFile } from "obsidian";
import OutlinerViewPlugin from "../OutlinerViewIndex";
import { OutlinerEditorView } from "../OutlinerEditorView";

/**
 * Enhanced editor types with more specific categorization
 */
export enum EditorType {
	EMBEDDED = "embed",
	OUTLINER = "outliner",
	TASK_GROUP = "task-group",
}

/**
 * Editor capabilities that can be mixed and matched
 */
export interface EditorCapabilities {
	canSave: boolean;
	canEdit: boolean;
	canZoom: boolean;
	canFold: boolean;
	canIndent: boolean;
	canSearch: boolean;
	canDragDrop: boolean;
	supportsTimeFormat: boolean;
	supportsBlockId: boolean;
	supportsBulletMenu: boolean;
	supportsTaskGroups: boolean;
}

/**
 * Editor behavior configuration
 */
export interface EditorBehavior {
	autoSave: boolean;
	autoFold: boolean;
	preserveSelection: boolean;
	syncWithFile: boolean;
	syncScroll: boolean;
	groupTasks: boolean;
	enableVim: boolean;
	enableEmacs: boolean;
	// Performance optimizations
	lazyLoading: boolean;
	virtualScrolling: boolean;
	debounceUpdates: boolean;
	// Accessibility features
	screenReaderSupport: boolean;
	keyboardNavigation: boolean;
	highContrast: boolean;
}

/**
 * Editor appearance configuration
 */
export interface EditorAppearance {
	showLineNumbers: boolean;
	showFoldGutter: boolean;
	showBulletPoints: boolean;
	highlightActiveLine: boolean;
	theme?: string;
	fontSize?: number;
	fontFamily?: string;
}

/**
 * Base editor metadata
 */
export interface EditorMetadata {
	id: string;
	type: EditorType;
	created: Date;
	lastModified: Date;
	version: string;
	capabilities: EditorCapabilities;
	behavior: EditorBehavior;
	appearance: EditorAppearance;
}

/**
 * Editor event handlers with strong typing
 */
export interface EditorEventHandlers {
	onSave?: (file: TFile, data: string) => void | Promise<void>;
	onChange?: (
		update: import("@codemirror/view").ViewUpdate,
		path?: string
	) => void;
	onFocus?: () => void;
	onBlur?: () => void;
	onDestroy?: () => void;
	onError?: (error: Error) => void;
}

/**
 * Base configuration for all editor types
 */
export interface BaseEditorConfig {
	// Required fields
	app: App;
	containerEl: HTMLElement;

	// Optional common fields
	file?: TFile;
	subpath?: string;
	targetRange?: { from: number; to: number };
	path?: string;
	data?: string;
	plugin?: OutlinerViewPlugin;
	view?: OutlinerEditorView;
	readOnly?: boolean;

	// Configuration objects
	capabilities?: Partial<EditorCapabilities>;
	behavior?: Partial<EditorBehavior>;
	appearance?: Partial<EditorAppearance>;
	eventHandlers?: EditorEventHandlers;

	// Legacy fields for backward compatibility
	foldByDefault?: boolean;
	disableTimeFormat?: boolean;
	sourcePath?: string;
	type?: EditorType;
	onSave?: (file: TFile, data: string) => void;
	onChange?: (update: any, path?: string) => void;

	// CodeMirror extensions
	customExtensions?: import("@codemirror/state").Extension[];
}

/**
 * Configuration specific to embedded editors
 */
export interface EmbeddedEditorConfig extends BaseEditorConfig {
	type: EditorType.EMBEDDED;
	file: TFile; // Required for embedded editors
	capabilities?: Partial<EditorCapabilities> & {
		canSave: true;
		canEdit: true;
		supportsBlockId: true;
	};
}

/**
 * Configuration specific to outliner editors
 */
export interface OutlinerEditorConfig extends BaseEditorConfig {
	type: EditorType.OUTLINER;
	view: OutlinerEditorView; // Required for outliner editors
	capabilities?: Partial<EditorCapabilities> & {
		canSearch: true;
		canFold: true;
		supportsBulletMenu: true;
		supportsTaskGroups: true;
	};
}

/**
 * Configuration specific to task group editors
 */
export interface TaskGroupEditorConfig extends BaseEditorConfig {
	type: EditorType.TASK_GROUP;
	file: TFile; // Required for task group editors
	capabilities?: Partial<EditorCapabilities> & {
		canSave: true;
		canEdit: true;
		canFold: true;
		supportsTaskGroups: true;
	};
}

/**
 * Union type for all editor configurations
 */
export type EditorConfig =
	| EmbeddedEditorConfig
	| OutlinerEditorConfig
	| TaskGroupEditorConfig;

/**
 * Default capabilities for each editor type
 */
export const DEFAULT_CAPABILITIES: Record<EditorType, EditorCapabilities> = {
	[EditorType.EMBEDDED]: {
		canSave: true,
		canEdit: true,
		canZoom: true,
		canFold: false,
		canIndent: false,
		canSearch: false,
		canDragDrop: false,
		supportsTimeFormat: true,
		supportsBlockId: true,
		supportsBulletMenu: false,
		supportsTaskGroups: false,
	},
	[EditorType.OUTLINER]: {
		canSave: true,
		canEdit: true,
		canZoom: true,
		canFold: true,
		canIndent: true,
		canSearch: true,
		canDragDrop: true,
		supportsTimeFormat: true,
		supportsBlockId: false,
		supportsBulletMenu: true,
		supportsTaskGroups: true,
	},
	[EditorType.TASK_GROUP]: {
		canSave: true,
		canEdit: true,
		canZoom: false,
		canFold: true,
		canIndent: true,
		canSearch: false,
		canDragDrop: false,
		supportsTimeFormat: true,
		supportsBlockId: false,
		supportsBulletMenu: false,
		supportsTaskGroups: true,
	},
};

/**
 * Default behavior for each editor type
 */
export const DEFAULT_BEHAVIOR: Record<EditorType, EditorBehavior> = {
	[EditorType.EMBEDDED]: {
		autoSave: true,
		autoFold: false,
		preserveSelection: true,
		syncWithFile: true,
		syncScroll: false,
		groupTasks: false,
		enableVim: false,
		enableEmacs: false,
		lazyLoading: false,
		virtualScrolling: false,
		debounceUpdates: false,
		screenReaderSupport: false,
		keyboardNavigation: true,
		highContrast: false,
	},
	[EditorType.OUTLINER]: {
		autoSave: true,
		autoFold: true,
		preserveSelection: true,
		syncWithFile: true,
		syncScroll: true,
		groupTasks: false,
		enableVim: false,
		enableEmacs: false,
		lazyLoading: false,
		virtualScrolling: false,
		debounceUpdates: true,
		screenReaderSupport: false,
		keyboardNavigation: true,
		highContrast: false,
	},
	[EditorType.TASK_GROUP]: {
		autoSave: true,
		autoFold: true,
		preserveSelection: false,
		syncWithFile: true,
		syncScroll: false,
		groupTasks: true,
		enableVim: false,
		enableEmacs: false,
		lazyLoading: false,
		virtualScrolling: false,
		debounceUpdates: false,
		screenReaderSupport: false,
		keyboardNavigation: true,
		highContrast: false,
	},
};

/**
 * Default appearance for all editor types
 */
export const DEFAULT_APPEARANCE: EditorAppearance = {
	showLineNumbers: false,
	showFoldGutter: true,
	showBulletPoints: true,
	highlightActiveLine: true,
};

/**
 * Type guards for editor configurations
 */
export class EditorTypeGuards {
	/**
	 * Type guard to check if config is for embedded editor
	 */
	static isEmbeddedConfig(
		config: BaseEditorConfig
	): config is EmbeddedEditorConfig {
		return config.type === EditorType.EMBEDDED && !!config.file;
	}

	/**
	 * Type guard to check if config is for outliner editor
	 */
	static isOutlinerConfig(
		config: BaseEditorConfig
	): config is OutlinerEditorConfig {
		return config.type === EditorType.OUTLINER && !!config.view;
	}

	/**
	 * Type guard to check if config is for task group editor
	 */
	static isTaskGroupConfig(
		config: BaseEditorConfig
	): config is TaskGroupEditorConfig {
		return config.type === EditorType.TASK_GROUP && !!config.file;
	}

	/**
	 * Validates that a configuration matches its declared type
	 */
	static validateConfigType(config: BaseEditorConfig): boolean {
		if (!config.type) return false;

		switch (config.type) {
			case EditorType.EMBEDDED:
				return this.isEmbeddedConfig(config);
			case EditorType.OUTLINER:
				return this.isOutlinerConfig(config);
			case EditorType.TASK_GROUP:
				return this.isTaskGroupConfig(config);
			default:
				return false;
		}
	}

	/**
	 * Checks if an editor type supports a specific capability
	 */
	static supportsCapability(
		type: EditorType,
		capability: keyof EditorCapabilities
	): boolean {
		return DEFAULT_CAPABILITIES[type][capability];
	}
}

/**
 * Utility functions for working with editor types
 */
export class EditorTypeUtils {
	/**
	 * Gets the default capabilities for an editor type
	 */
	static getDefaultCapabilities(type: EditorType): EditorCapabilities {
		return { ...DEFAULT_CAPABILITIES[type] };
	}

	/**
	 * Gets the default behavior for an editor type
	 */
	static getDefaultBehavior(type: EditorType): EditorBehavior {
		return { ...DEFAULT_BEHAVIOR[type] };
	}

	/**
	 * Gets the default appearance settings
	 */
	static getDefaultAppearance(): EditorAppearance {
		return { ...DEFAULT_APPEARANCE };
	}

	/**
	 * Merges capabilities with defaults
	 */
	static mergeCapabilities(
		type: EditorType,
		overrides: Partial<EditorCapabilities> = {}
	): EditorCapabilities {
		return {
			...this.getDefaultCapabilities(type),
			...overrides,
		};
	}

	/**
	 * Merges behavior with defaults
	 */
	static mergeBehavior(
		type: EditorType,
		overrides: Partial<EditorBehavior> = {}
	): EditorBehavior {
		return {
			...this.getDefaultBehavior(type),
			...overrides,
		};
	}

	/**
	 * Merges appearance with defaults
	 */
	static mergeAppearance(
		overrides: Partial<EditorAppearance> = {}
	): EditorAppearance {
		return {
			...this.getDefaultAppearance(),
			...overrides,
		};
	}

	/**
	 * Creates a complete editor metadata object
	 */
	static createMetadata(
		type: EditorType,
		overrides: Partial<EditorMetadata> = {}
	): EditorMetadata {
		const now = new Date();
		return {
			id: `editor-${type}-${Date.now()}`,
			type,
			created: now,
			lastModified: now,
			version: "1.0.0",
			capabilities: this.getDefaultCapabilities(type),
			behavior: this.getDefaultBehavior(type),
			appearance: this.getDefaultAppearance(),
			...overrides,
		};
	}
}
