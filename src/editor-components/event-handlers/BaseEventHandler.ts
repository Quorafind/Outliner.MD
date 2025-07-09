import { Editor, App } from "obsidian";
import { EditorType } from "../EditorTypes";

/**
 * Context information passed to event handlers
 */
export interface EventHandlerContext {
	editor: Editor;
	app: App;
	line: number;
	ch: number;
	lineText: string;
	editorType: EditorType;
	mod?: boolean;
	shift?: boolean;
}

/**
 * Result of an event handler execution
 */
export interface EventHandlerResult {
	handled: boolean;
	preventDefault?: boolean;
	stopPropagation?: boolean;
	data?: any;
}

/**
 * Base interface for all event handlers
 */
export interface IEventHandler {
	/**
	 * The priority of this handler (higher numbers execute first)
	 */
	priority: number;

	/**
	 * Whether this handler can handle the given context
	 */
	canHandle(context: EventHandlerContext): boolean;

	/**
	 * Handles the event
	 */
	handle(context: EventHandlerContext): EventHandlerResult;
}

/**
 * Abstract base class for event handlers
 */
export abstract class BaseEventHandler implements IEventHandler {
	public priority: number = 0;

	constructor(priority: number = 0) {
		this.priority = priority;
	}

	/**
	 * Default implementation checks if the editor type matches
	 */
	canHandle(context: EventHandlerContext): boolean {
		return this.getSupportedEditorTypes().includes(context.editorType);
	}

	/**
	 * Abstract method to handle the event
	 */
	abstract handle(context: EventHandlerContext): EventHandlerResult;

	/**
	 * Gets the editor types this handler supports
	 */
	protected getSupportedEditorTypes(): EditorType[] {
		return [EditorType.EMBEDDED, EditorType.OUTLINER, EditorType.TASK_GROUP];
	}

	/**
	 * Helper method to create a successful result
	 */
	protected success(data?: any): EventHandlerResult {
		return {
			handled: true,
			preventDefault: true,
			data,
		};
	}

	/**
	 * Helper method to create a failed result
	 */
	protected fail(data?: any): EventHandlerResult {
		return {
			handled: false,
			data,
		};
	}

	/**
	 * Helper method to create a passthrough result
	 */
	protected passthrough(data?: any): EventHandlerResult {
		return {
			handled: false,
			preventDefault: false,
			data,
		};
	}
}

/**
 * Composite event handler that manages multiple handlers
 */
export class CompositeEventHandler implements IEventHandler {
	public priority: number = 0;
	private handlers: IEventHandler[] = [];

	constructor(priority: number = 0) {
		this.priority = priority;
	}

	/**
	 * Adds a handler to the composite
	 */
	addHandler(handler: IEventHandler): void {
		this.handlers.push(handler);
		// Sort by priority (highest first)
		this.handlers.sort((a, b) => b.priority - a.priority);
	}

	/**
	 * Removes a handler from the composite
	 */
	removeHandler(handler: IEventHandler): boolean {
		const index = this.handlers.indexOf(handler);
		if (index !== -1) {
			this.handlers.splice(index, 1);
			return true;
		}
		return false;
	}

	/**
	 * Checks if any handler can handle the context
	 */
	canHandle(context: EventHandlerContext): boolean {
		return this.handlers.some(handler => handler.canHandle(context));
	}

	/**
	 * Executes handlers in priority order until one handles the event
	 */
	handle(context: EventHandlerContext): EventHandlerResult {
		for (const handler of this.handlers) {
			if (handler.canHandle(context)) {
				const result = handler.handle(context);
				if (result.handled) {
					return result;
				}
			}
		}

		return {
			handled: false,
		};
	}

	/**
	 * Gets all registered handlers
	 */
	getHandlers(): IEventHandler[] {
		return [...this.handlers];
	}

	/**
	 * Clears all handlers
	 */
	clear(): void {
		this.handlers = [];
	}
}

/**
 * Event handler registry for managing global handlers
 */
export class EventHandlerRegistry {
	private handlers = new Map<string, CompositeEventHandler>();

	/**
	 * Registers a handler for a specific event type
	 */
	register(eventType: string, handler: IEventHandler): void {
		if (!this.handlers.has(eventType)) {
			this.handlers.set(eventType, new CompositeEventHandler());
		}
		this.handlers.get(eventType)!.addHandler(handler);
	}

	/**
	 * Unregisters a handler for a specific event type
	 */
	unregister(eventType: string, handler: IEventHandler): boolean {
		const composite = this.handlers.get(eventType);
		if (composite) {
			return composite.removeHandler(handler);
		}
		return false;
	}

	/**
	 * Gets the composite handler for an event type
	 */
	getHandler(eventType: string): CompositeEventHandler | undefined {
		return this.handlers.get(eventType);
	}

	/**
	 * Handles an event using the registered handlers
	 */
	handle(eventType: string, context: EventHandlerContext): EventHandlerResult {
		const handler = this.handlers.get(eventType);
		if (handler && handler.canHandle(context)) {
			return handler.handle(context);
		}
		return { handled: false };
	}

	/**
	 * Gets all registered event types
	 */
	getEventTypes(): string[] {
		return Array.from(this.handlers.keys());
	}

	/**
	 * Clears all handlers for an event type
	 */
	clear(eventType?: string): void {
		if (eventType) {
			this.handlers.delete(eventType);
		} else {
			this.handlers.clear();
		}
	}
}

/**
 * Default event handler registry
 */
export const defaultEventHandlerRegistry = new EventHandlerRegistry();
