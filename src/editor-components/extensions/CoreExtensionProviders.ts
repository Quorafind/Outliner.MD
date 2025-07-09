import { Extension, Prec } from "@codemirror/state";
import { keymap, EditorView } from "@codemirror/view";
import { indentWithTab } from "@codemirror/commands";
import { foldGutter, foldKeymap } from "@codemirror/language";
import { searchKeymap } from "@codemirror/search";
import { BaseExtensionProvider, ExtensionConfig } from "./ExtensionManager";
import { EditorType } from "../EditorTypes";

/**
 * Provider for basic editor functionality
 */
export class BasicEditorProvider extends BaseExtensionProvider {
	constructor() {
		super("basic-editor", 1000); // Very high priority
	}

	canProvide(config: ExtensionConfig): boolean {
		// Always provide basic functionality
		return true;
	}

	provide(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Basic editor view configuration
		extensions.push(
			EditorView.theme({
				"&": {
					fontSize: "inherit",
					fontFamily: "inherit",
				},
				".cm-content": {
					padding: "0",
					minHeight: "100px",
				},
				".cm-focused": {
					outline: "none",
				},
				".cm-editor": {
					borderRadius: "0",
				},
				".cm-scroller": {
					fontFamily: "inherit",
				},
			})
		);

		// Line wrapping
		extensions.push(EditorView.lineWrapping);

		return extensions;
	}
}

/**
 * Provider for keymap extensions
 */
export class KeymapProvider extends BaseExtensionProvider {
	constructor() {
		super("keymap", 900); // High priority
	}

	canProvide(config: ExtensionConfig): boolean {
		return true; // All editors need keymaps
	}

	provide(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Basic tab handling
		if (!config.readOnly) {
			extensions.push(Prec.high(keymap.of([indentWithTab])));
		}

		// Folding keymap if folding is supported
		if (this.hasCapability(config, "canFold")) {
			extensions.push(keymap.of(foldKeymap));
		}

		// Search keymap if search is supported
		if (this.hasCapability(config, "canSearch")) {
			extensions.push(keymap.of(searchKeymap));
		}

		return extensions;
	}
}

/**
 * Provider for folding functionality
 */
export class FoldingProvider extends BaseExtensionProvider {
	constructor() {
		super("folding", 800); // High priority
	}

	canProvide(config: ExtensionConfig): boolean {
		return this.hasCapability(config, "canFold");
	}

	provide(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Fold gutter
		extensions.push(
			foldGutter({
				openText: "▼",
				closedText: "▶",
			})
		);

		return extensions;
	}
}

/**
 * Provider for time format widget (Obsidian-specific)
 * Note: Widget file doesn't exist, so this provider returns empty extensions
 */
export class TimeFormatProvider extends BaseExtensionProvider {
	constructor() {
		super("time-format", 700); // Medium-high priority
	}

	canProvide(config: ExtensionConfig): boolean {
		return (
			this.hasCapability(config, "supportsTimeFormat") &&
			!config.disableTimeFormat
		);
	}

	provide(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Time format widget is not available - file doesn't exist
		console.warn("Time format widget not available: file doesn't exist");

		return extensions;
	}
}

/**
 * Provider for bullet menu functionality
 * Note: Widget file doesn't exist, so this provider returns empty extensions
 */
export class BulletMenuProvider extends BaseExtensionProvider {
	constructor() {
		super("bullet-menu", 600); // Medium priority
	}

	canProvide(config: ExtensionConfig): boolean {
		return (
			this.hasCapability(config, "supportsBulletMenu") && !config.readOnly
		);
	}

	provide(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Bullet menu widget is not available - file doesn't exist
		console.warn("Bullet menu widget not available: file doesn't exist");

		return extensions;
	}
}

/**
 * Provider for task group functionality
 * Note: Widget file doesn't exist, so this provider returns empty extensions
 */
export class TaskGroupProvider extends BaseExtensionProvider {
	constructor() {
		super("task-group", 500); // Medium priority
	}

	canProvide(config: ExtensionConfig): boolean {
		return this.hasCapability(config, "supportsTaskGroups");
	}

	provide(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Task group widget is not available - file doesn't exist
		console.warn("Task group widget not available: file doesn't exist");

		return extensions;
	}
}

/**
 * Provider for search highlighting
 * Note: Widget file doesn't exist, so this provider returns empty extensions
 */
export class SearchHighlightProvider extends BaseExtensionProvider {
	constructor() {
		super("search-highlight", 400); // Medium-low priority
	}

	canProvide(config: ExtensionConfig): boolean {
		return this.hasCapability(config, "canSearch");
	}

	provide(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Search highlight widget is not available - file doesn't exist
		console.warn(
			"Search highlight widget not available: file doesn't exist"
		);

		return extensions;
	}
}

/**
 * Provider for block ID functionality (embedded editors)
 * Note: Widget file doesn't exist, so this provider returns empty extensions
 */
export class BlockIdProvider extends BaseExtensionProvider {
	constructor() {
		super("block-id", 300); // Low-medium priority
	}

	canProvide(config: ExtensionConfig): boolean {
		return this.hasCapability(config, "supportsBlockId");
	}

	provide(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Block ID widget is not available - file doesn't exist
		console.warn("Block ID widget not available: file doesn't exist");

		return extensions;
	}
}

/**
 * Provider for read-only mode
 */
export class ReadOnlyProvider extends BaseExtensionProvider {
	constructor() {
		super("read-only", 200); // Low priority
	}

	canProvide(config: ExtensionConfig): boolean {
		return config.readOnly === true;
	}

	provide(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Read-only state
		extensions.push(EditorView.editable.of(false));

		// Read-only styling
		extensions.push(
			EditorView.theme({
				"&.cm-editor": {
					backgroundColor: "var(--background-secondary)",
					opacity: "0.8",
				},
				".cm-content": {
					cursor: "default",
				},
			})
		);

		return extensions;
	}
}

/**
 * Provider for editor type-specific styling
 */
export class EditorTypeStyleProvider extends BaseExtensionProvider {
	constructor() {
		super("editor-type-style", 100); // Low priority
	}

	canProvide(config: ExtensionConfig): boolean {
		return true; // All editors can have type-specific styling
	}

	provide(config: ExtensionConfig): Extension[] {
		const extensions: Extension[] = [];

		// Type-specific CSS classes
		const typeClass = `outliner-editor-${config.type}`;

		extensions.push(
			EditorView.theme({
				[`&.${typeClass}`]: {
					// Type-specific styles can be added here
				},
			})
		);

		// Add the CSS class to the editor
		extensions.push(
			EditorView.editorAttributes.of({
				class: typeClass,
			})
		);

		return extensions;
	}
}
