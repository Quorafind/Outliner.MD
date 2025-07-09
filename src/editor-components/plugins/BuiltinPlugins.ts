import { Extension } from "@codemirror/state";
import { EditorType } from "../EditorTypes";
import { ExtensionConfig } from "../extensions/ExtensionManager";
import { BaseEditorPlugin, PluginMetadata } from "./EditorPluginSystem";

/**
 * Search highlighting plugin
 */
export class SearchHighlightPlugin extends BaseEditorPlugin {
	constructor() {
		const metadata: PluginMetadata = {
			id: "search-highlight",
			name: "Search Highlight",
			version: "1.0.0",
			description: "Provides search highlighting functionality for editors",
			author: "Outliner View",
			tags: ["search", "highlight", "ui"],
		};

		super(metadata, {
			enabled: true,
			priority: 100,
			settings: {
				highlightColor: "#ffff00",
				caseSensitive: false,
				wholeWord: false,
			},
		});
	}

	isCompatible(config: ExtensionConfig): boolean {
		// Compatible with all editor types that support search
		return this.hasCapability(config, "canSearch");
	}

	createExtensions(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Only add search highlighting if the capability is enabled
		if (this.hasCapability(config, "canSearch")) {
			// Import and add search highlighting extension
			// This would typically import from ../cm/SearchHighlight
			// extensions.push(searchHighlightExtension(this.config.settings));
		}

		return extensions;
	}

	getSettingsSchema(): Record<string, any> {
		return {
			highlightColor: {
				type: "string",
				default: "#ffff00",
				description: "Color for search highlights",
			},
			caseSensitive: {
				type: "boolean",
				default: false,
				description: "Whether search should be case sensitive",
			},
			wholeWord: {
				type: "boolean",
				default: false,
				description: "Whether to match whole words only",
			},
		};
	}

	validateSettings(settings: Record<string, any>): boolean {
		// Validate color format
		if (settings.highlightColor && typeof settings.highlightColor !== "string") {
			return false;
		}

		// Validate boolean settings
		if (settings.caseSensitive !== undefined && typeof settings.caseSensitive !== "boolean") {
			return false;
		}

		if (settings.wholeWord !== undefined && typeof settings.wholeWord !== "boolean") {
			return false;
		}

		return true;
	}
}

/**
 * Bullet menu plugin
 */
export class BulletMenuPlugin extends BaseEditorPlugin {
	constructor() {
		const metadata: PluginMetadata = {
			id: "bullet-menu",
			name: "Bullet Menu",
			version: "1.0.0",
			description: "Provides bullet menu functionality for outliner editors",
			author: "Outliner View",
			tags: ["bullet", "menu", "outliner"],
		};

		super(metadata, {
			enabled: true,
			priority: 200,
			settings: {
				showOnHover: true,
				autoHide: true,
				menuItems: ["indent", "outdent", "delete", "add"],
			},
		});
	}

	isCompatible(config: ExtensionConfig): boolean {
		// Only compatible with outliner editors that support bullet operations
		return (
			this.supportsEditorType(config, [EditorType.OUTLINER]) &&
			this.hasCapability(config, "canIndent")
		);
	}

	createExtensions(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Only add bullet menu for compatible editors
		if (this.isCompatible(config)) {
			// Import and add bullet menu extension
			// This would typically import from ../components/BulletMenu
			// extensions.push(bulletMenuExtension(this.config.settings));
		}

		return extensions;
	}

	getSettingsSchema(): Record<string, any> {
		return {
			showOnHover: {
				type: "boolean",
				default: true,
				description: "Show menu on bullet hover",
			},
			autoHide: {
				type: "boolean",
				default: true,
				description: "Auto-hide menu when not in use",
			},
			menuItems: {
				type: "array",
				items: { type: "string" },
				default: ["indent", "outdent", "delete", "add"],
				description: "Available menu items",
			},
		};
	}
}

/**
 * Task group plugin
 */
export class TaskGroupPlugin extends BaseEditorPlugin {
	constructor() {
		const metadata: PluginMetadata = {
			id: "task-group",
			name: "Task Group",
			version: "1.0.0",
			description: "Provides task grouping functionality for task editors",
			author: "Outliner View",
			tags: ["task", "group", "organization"],
		};

		super(metadata, {
			enabled: true,
			priority: 150,
			settings: {
				autoGroup: true,
				groupByStatus: true,
				groupByPriority: false,
				showGroupHeaders: true,
			},
		});
	}

	isCompatible(config: ExtensionConfig): boolean {
		// Only compatible with task group editors
		return this.supportsEditorType(config, [EditorType.TASK_GROUP]);
	}

	createExtensions(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Only add task grouping for task group editors
		if (this.isCompatible(config)) {
			// Import and add task group extension
			// This would typically import from ../components/task-group
			// extensions.push(taskGroupExtension(this.config.settings));
		}

		return extensions;
	}

	getSettingsSchema(): Record<string, any> {
		return {
			autoGroup: {
				type: "boolean",
				default: true,
				description: "Automatically group tasks",
			},
			groupByStatus: {
				type: "boolean",
				default: true,
				description: "Group tasks by completion status",
			},
			groupByPriority: {
				type: "boolean",
				default: false,
				description: "Group tasks by priority",
			},
			showGroupHeaders: {
				type: "boolean",
				default: true,
				description: "Show headers for task groups",
			},
		};
	}
}

/**
 * Date rendering plugin
 */
export class DateRenderPlugin extends BaseEditorPlugin {
	constructor() {
		const metadata: PluginMetadata = {
			id: "date-render",
			name: "Date Renderer",
			version: "1.0.0",
			description: "Provides date rendering functionality for editors",
			author: "Outliner View",
			tags: ["date", "time", "formatting"],
		};

		super(metadata, {
			enabled: true,
			priority: 50,
			settings: {
				dateFormat: "YYYY-MM-DD",
				timeFormat: "HH:mm",
				showRelativeDates: true,
				highlightToday: true,
			},
		});
	}

	isCompatible(config: ExtensionConfig): boolean {
		// Compatible with editors that support time formatting
		return this.hasCapability(config, "supportsTimeFormat") && !config.disableTimeFormat;
	}

	createExtensions(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Only add date rendering if time format is supported and not disabled
		if (this.isCompatible(config)) {
			// Import and add date rendering extension
			// This would typically import from ../cm/DateRender
			// extensions.push(dateRenderExtension(this.config.settings));
		}

		return extensions;
	}

	getSettingsSchema(): Record<string, any> {
		return {
			dateFormat: {
				type: "string",
				default: "YYYY-MM-DD",
				description: "Date format string",
			},
			timeFormat: {
				type: "string",
				default: "HH:mm",
				description: "Time format string",
			},
			showRelativeDates: {
				type: "boolean",
				default: true,
				description: "Show relative dates (e.g., 'today', 'yesterday')",
			},
			highlightToday: {
				type: "boolean",
				default: true,
				description: "Highlight today's date",
			},
		};
	}
}

/**
 * Placeholder plugin
 */
export class PlaceholderPlugin extends BaseEditorPlugin {
	constructor() {
		const metadata: PluginMetadata = {
			id: "placeholder",
			name: "Placeholder",
			version: "1.0.0",
			description: "Provides placeholder text for empty editors",
			author: "Outliner View",
			tags: ["placeholder", "ui", "empty"],
		};

		super(metadata, {
			enabled: true,
			priority: 10,
			settings: {
				text: "Start typing...",
				showWhenFocused: false,
				style: "italic",
			},
		});
	}

	isCompatible(config: ExtensionConfig): boolean {
		// Compatible with all editor types
		return true;
	}

	createExtensions(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Add placeholder extension for all editors
		// Import and add placeholder extension
		// This would typically import from ../cm/Placeholder
		// extensions.push(placeholderExtension(this.config.settings));

		return extensions;
	}

	getSettingsSchema(): Record<string, any> {
		return {
			text: {
				type: "string",
				default: "Start typing...",
				description: "Placeholder text to display",
			},
			showWhenFocused: {
				type: "boolean",
				default: false,
				description: "Show placeholder even when editor is focused",
			},
			style: {
				type: "string",
				enum: ["normal", "italic", "bold"],
				default: "italic",
				description: "Style for placeholder text",
			},
		};
	}
}

/**
 * Factory function to create all builtin plugins
 */
export function createBuiltinPlugins(): BaseEditorPlugin[] {
	return [
		new SearchHighlightPlugin(),
		new BulletMenuPlugin(),
		new TaskGroupPlugin(),
		new DateRenderPlugin(),
		new PlaceholderPlugin(),
	];
}

/**
 * Registers all builtin plugins with the given plugin manager
 */
export async function registerBuiltinPlugins(
	pluginManager: import("./EditorPluginSystem").EditorPluginManager
): Promise<void> {
	const plugins = createBuiltinPlugins();

	for (const plugin of plugins) {
		try {
			await pluginManager.registerPlugin(plugin);
		} catch (error) {
			console.error(`Failed to register builtin plugin ${plugin.metadata.id}:`, error);
		}
	}
}
