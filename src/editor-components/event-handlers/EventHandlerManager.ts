import { Editor, App } from "obsidian";
import { EditorType } from "../EditorTypes";
import { 
	EventHandlerContext, 
	EventHandlerResult, 
	EventHandlerRegistry, 
	defaultEventHandlerRegistry 
} from "./BaseEventHandler";

// Import all event handlers
import { RegularEnterHandler, ShiftEnterHandler, ModEnterHandler } from "./EnterEventHandlers";
import { BackspaceHandler, DeleteHandler, BlockIdProtectionHandler } from "./DeleteEventHandlers";
import { TabIndentHandler, ShiftTabIndentHandler, ModTabFoldHandler, SmartIndentHandler } from "./IndentEventHandlers";

/**
 * Event types supported by the system
 */
export enum EventType {
	ENTER = "enter",
	DELETE = "delete",
	BACKSPACE = "backspace",
	TAB = "tab",
	ARROW_UP = "arrow-up",
	ARROW_DOWN = "arrow-down",
	ARROW_LEFT = "arrow-left",
	ARROW_RIGHT = "arrow-right",
	ESCAPE = "escape",
	FOCUS = "focus",
	BLUR = "blur",
}

/**
 * Manager for editor event handlers
 */
export class EventHandlerManager {
	private registry: EventHandlerRegistry;

	constructor(registry?: EventHandlerRegistry) {
		this.registry = registry || defaultEventHandlerRegistry;
		this.initializeDefaultHandlers();
	}

	/**
	 * Initializes default event handlers
	 */
	private initializeDefaultHandlers(): void {
		// Enter key handlers
		this.registry.register(EventType.ENTER, new RegularEnterHandler());
		this.registry.register(EventType.ENTER, new ShiftEnterHandler());
		this.registry.register(EventType.ENTER, new ModEnterHandler());

		// Delete key handlers
		this.registry.register(EventType.BACKSPACE, new BackspaceHandler());
		this.registry.register(EventType.DELETE, new DeleteHandler());
		this.registry.register(EventType.DELETE, new BlockIdProtectionHandler());
		this.registry.register(EventType.BACKSPACE, new BlockIdProtectionHandler());

		// Tab key handlers
		this.registry.register(EventType.TAB, new TabIndentHandler());
		this.registry.register(EventType.TAB, new ShiftTabIndentHandler());
		this.registry.register(EventType.TAB, new ModTabFoldHandler());
		this.registry.register(EventType.TAB, new SmartIndentHandler());
	}

	/**
	 * Handles an Enter key event
	 */
	handleEnter(
		editor: Editor, 
		app: App, 
		editorType: EditorType, 
		mod: boolean = false, 
		shift: boolean = false
	): boolean {
		const cursor = editor.getCursor();
		const context: EventHandlerContext = {
			editor,
			app,
			line: cursor.line,
			ch: cursor.ch,
			lineText: editor.getLine(cursor.line),
			editorType,
			mod,
			shift,
		};

		const result = this.registry.handle(EventType.ENTER, context);
		return result.handled;
	}

	/**
	 * Handles a Delete key event
	 */
	handleDelete(editor: Editor, app: App, editorType: EditorType): boolean {
		const cursor = editor.getCursor();
		const context: EventHandlerContext = {
			editor,
			app,
			line: cursor.line,
			ch: cursor.ch,
			lineText: editor.getLine(cursor.line),
			editorType,
		};

		const result = this.registry.handle(EventType.DELETE, context);
		return result.handled;
	}

	/**
	 * Handles a Backspace key event
	 */
	handleBackspace(editor: Editor, app: App, editorType: EditorType): boolean {
		const cursor = editor.getCursor();
		const context: EventHandlerContext = {
			editor,
			app,
			line: cursor.line,
			ch: cursor.ch,
			lineText: editor.getLine(cursor.line),
			editorType,
		};

		const result = this.registry.handle(EventType.BACKSPACE, context);
		return result.handled;
	}

	/**
	 * Handles a Tab key event
	 */
	handleTab(
		editor: Editor, 
		app: App, 
		editorType: EditorType, 
		mod: boolean = false, 
		shift: boolean = false
	): boolean {
		const cursor = editor.getCursor();
		const context: EventHandlerContext = {
			editor,
			app,
			line: cursor.line,
			ch: cursor.ch,
			lineText: editor.getLine(cursor.line),
			editorType,
			mod,
			shift,
		};

		const result = this.registry.handle(EventType.TAB, context);
		return result.handled;
	}

	/**
	 * Generic event handler
	 */
	handleEvent(
		eventType: EventType,
		editor: Editor,
		app: App,
		editorType: EditorType,
		options: { mod?: boolean; shift?: boolean; alt?: boolean } = {}
	): boolean {
		const cursor = editor.getCursor();
		const context: EventHandlerContext = {
			editor,
			app,
			line: cursor.line,
			ch: cursor.ch,
			lineText: editor.getLine(cursor.line),
			editorType,
			...options,
		};

		const result = this.registry.handle(eventType.toString(), context);
		return result.handled;
	}

	/**
	 * Registers a custom event handler
	 */
	registerHandler(eventType: EventType, handler: any): void {
		this.registry.register(eventType.toString(), handler);
	}

	/**
	 * Unregisters an event handler
	 */
	unregisterHandler(eventType: EventType, handler: any): boolean {
		return this.registry.unregister(eventType.toString(), handler);
	}

	/**
	 * Gets all handlers for an event type
	 */
	getHandlers(eventType: EventType): any {
		return this.registry.getHandler(eventType.toString());
	}

	/**
	 * Clears all handlers for an event type
	 */
	clearHandlers(eventType?: EventType): void {
		this.registry.clear(eventType?.toString());
	}

	/**
	 * Gets the registry instance
	 */
	getRegistry(): EventHandlerRegistry {
		return this.registry;
	}
}

/**
 * Default event handler manager instance
 */
export const defaultEventHandlerManager = new EventHandlerManager();

/**
 * Convenience functions for common event handling
 */

/**
 * Handle Enter key press
 */
export function handleEnter(
	editor: Editor,
	app: App,
	editorType: EditorType,
	mod: boolean = false,
	shift: boolean = false
): boolean {
	return defaultEventHandlerManager.handleEnter(editor, app, editorType, mod, shift);
}

/**
 * Handle Delete key press
 */
export function handleDelete(editor: Editor, app: App, editorType: EditorType): boolean {
	return defaultEventHandlerManager.handleDelete(editor, app, editorType);
}

/**
 * Handle Backspace key press
 */
export function handleBackspace(editor: Editor, app: App, editorType: EditorType): boolean {
	return defaultEventHandlerManager.handleBackspace(editor, app, editorType);
}

/**
 * Handle Tab key press
 */
export function handleTab(
	editor: Editor,
	app: App,
	editorType: EditorType,
	mod: boolean = false,
	shift: boolean = false
): boolean {
	return defaultEventHandlerManager.handleTab(editor, app, editorType, mod, shift);
}

/**
 * Register a custom event handler
 */
export function registerEventHandler(eventType: EventType, handler: any): void {
	defaultEventHandlerManager.registerHandler(eventType, handler);
}

/**
 * Create a new event handler manager with custom configuration
 */
export function createEventHandlerManager(registry?: EventHandlerRegistry): EventHandlerManager {
	return new EventHandlerManager(registry);
}
