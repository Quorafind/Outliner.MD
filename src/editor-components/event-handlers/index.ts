/**
 * Editor Event Handler System
 * 
 * This module provides a modular, composable event handling system for editors.
 * Event handlers can be registered, prioritized, and combined to create complex
 * behavior patterns while maintaining clean separation of concerns.
 */

// Base event handler classes and interfaces
export {
	BaseEventHandler,
	CompositeEventHandler,
	EventHandlerRegistry,
	defaultEventHandlerRegistry
} from "./BaseEventHandler";

export type {
	IEventHandler,
	EventHandlerContext,
	EventHandlerResult
} from "./BaseEventHandler";

// Specific event handler implementations
export {
	BaseEnterHandler,
	RegularEnterHandler,
	ShiftEnterHandler,
	ModEnterHandler
} from "./EnterEventHandlers";

export {
	BaseDeleteHandler,
	BackspaceHandler,
	DeleteHandler,
	BlockIdProtectionHandler
} from "./DeleteEventHandlers";

export {
	BaseIndentHandler,
	TabIndentHandler,
	ShiftTabIndentHandler,
	ModTabFoldHandler,
	SmartIndentHandler
} from "./IndentEventHandlers";

// Event handler manager and utilities
export {
	EventHandlerManager,
	EventType,
	defaultEventHandlerManager,
	handleEnter,
	handleDelete,
	handleBackspace,
	handleTab,
	registerEventHandler,
	createEventHandlerManager
} from "./EventHandlerManager";

// Re-export editor types for convenience
export { EditorType } from "../EditorTypes";
