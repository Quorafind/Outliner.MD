import { BaseEventHandler, EventHandlerContext, EventHandlerResult } from "./BaseEventHandler";
import { EditorType } from "../EditorTypes";

/**
 * Base class for Delete/Backspace event handlers
 */
export abstract class BaseDeleteHandler extends BaseEventHandler {
	constructor(priority: number = 0) {
		super(priority);
	}

	/**
	 * Helper method to check if cursor is at start of line
	 */
	protected isCursorAtStartOfLine(context: EventHandlerContext): boolean {
		return context.ch === 0;
	}

	/**
	 * Helper method to check if line is empty
	 */
	protected isLineEmpty(lineText: string): boolean {
		return lineText.trim().length === 0;
	}

	/**
	 * Helper method to check if line is a bullet point
	 */
	protected isBulletLine(lineText: string): boolean {
		return /^(\s*)(-|\*)\s*$/.test(lineText);
	}

	/**
	 * Helper method to check if line is a numbered list
	 */
	protected isNumberedListLine(lineText: string): boolean {
		return /^(\s*)\d+\.\s*$/.test(lineText);
	}

	/**
	 * Helper method to get line indentation
	 */
	protected getIndentation(lineText: string): string {
		const match = lineText.match(/^(\s*)/);
		return match ? match[1] : "";
	}
}

/**
 * Handler for Backspace key presses
 */
export class BackspaceHandler extends BaseDeleteHandler {
	constructor() {
		super(100); // High priority
	}

	handle(context: EventHandlerContext): EventHandlerResult {
		const { editor, line, ch, lineText } = context;

		// Handle backspace at start of line
		if (this.isCursorAtStartOfLine(context)) {
			return this.handleBackspaceAtStartOfLine(context);
		}

		// Handle backspace in bullet points
		if (this.isBulletLine(lineText) && ch === lineText.length) {
			return this.handleBackspaceInBulletPoint(context);
		}

		// Handle backspace in numbered lists
		if (this.isNumberedListLine(lineText) && ch === lineText.length) {
			return this.handleBackspaceInNumberedList(context);
		}

		return this.fail();
	}

	/**
	 * Handle backspace at the start of a line
	 */
	private handleBackspaceAtStartOfLine(context: EventHandlerContext): EventHandlerResult {
		const { editor, line, lineText } = context;

		if (line === 0) {
			return this.fail(); // Can't delete before first line
		}

		const prevLine = editor.getLine(line - 1);
		const prevLineLength = prevLine.length;

		// Merge current line with previous line
		editor.transaction({
			changes: [
				{
					text: lineText,
					from: { line: line - 1, ch: prevLineLength },
					to: { line: line, ch: lineText.length },
				},
			],
			selection: {
				from: { line: line - 1, ch: prevLineLength },
				to: { line: line - 1, ch: prevLineLength },
			},
		});

		return this.success();
	}

	/**
	 * Handle backspace in bullet point
	 */
	private handleBackspaceInBulletPoint(context: EventHandlerContext): EventHandlerResult {
		const { editor, line, lineText } = context;
		const indentation = this.getIndentation(lineText);

		if (indentation.length > 0) {
			// Reduce indentation
			const newIndentation = indentation.slice(0, -2); // Remove 2 spaces
			const newText = newIndentation + lineText.slice(indentation.length);
			
			editor.transaction({
				changes: [
					{
						text: newText,
						from: { line, ch: 0 },
						to: { line, ch: lineText.length },
					},
				],
				selection: {
					from: { line, ch: newText.length },
					to: { line, ch: newText.length },
				},
			});
		} else {
			// Remove bullet point entirely
			editor.transaction({
				changes: [
					{
						text: "",
						from: { line, ch: 0 },
						to: { line, ch: lineText.length },
					},
				],
				selection: {
					from: { line, ch: 0 },
					to: { line, ch: 0 },
				},
			});
		}

		return this.success();
	}

	/**
	 * Handle backspace in numbered list
	 */
	private handleBackspaceInNumberedList(context: EventHandlerContext): EventHandlerResult {
		const { editor, line, lineText } = context;
		const indentation = this.getIndentation(lineText);

		if (indentation.length > 0) {
			// Reduce indentation
			const newIndentation = indentation.slice(0, -2); // Remove 2 spaces
			const newText = newIndentation + lineText.slice(indentation.length);
			
			editor.transaction({
				changes: [
					{
						text: newText,
						from: { line, ch: 0 },
						to: { line, ch: lineText.length },
					},
				],
				selection: {
					from: { line, ch: newText.length },
					to: { line, ch: newText.length },
				},
			});
		} else {
			// Convert to bullet point
			const newText = "- ";
			
			editor.transaction({
				changes: [
					{
						text: newText,
						from: { line, ch: 0 },
						to: { line, ch: lineText.length },
					},
				],
				selection: {
					from: { line, ch: newText.length },
					to: { line, ch: newText.length },
				},
			});
		}

		return this.success();
	}
}

/**
 * Handler for Delete key presses
 */
export class DeleteHandler extends BaseDeleteHandler {
	constructor() {
		super(90); // High priority, but lower than backspace
	}

	handle(context: EventHandlerContext): EventHandlerResult {
		const { editor, line, ch, lineText } = context;

		// Handle delete at end of line
		if (ch === lineText.length) {
			return this.handleDeleteAtEndOfLine(context);
		}

		return this.fail();
	}

	/**
	 * Handle delete at the end of a line
	 */
	private handleDeleteAtEndOfLine(context: EventHandlerContext): EventHandlerResult {
		const { editor, line, ch } = context;
		const totalLines = editor.lineCount();

		if (line >= totalLines - 1) {
			return this.fail(); // Can't delete after last line
		}

		const nextLine = editor.getLine(line + 1);

		// Merge next line with current line
		editor.transaction({
			changes: [
				{
					text: nextLine,
					from: { line, ch },
					to: { line: line + 1, ch: nextLine.length },
				},
			],
			selection: {
				from: { line, ch },
				to: { line, ch },
			},
		});

		return this.success();
	}
}

/**
 * Handler for block ID deletion prevention (embedded editors)
 */
export class BlockIdProtectionHandler extends BaseDeleteHandler {
	constructor() {
		super(200); // Very high priority
	}

	canHandle(context: EventHandlerContext): boolean {
		// Only apply to embedded editors
		return context.editorType === EditorType.EMBEDDED;
	}

	handle(context: EventHandlerContext): EventHandlerResult {
		const { editor, line, ch, lineText } = context;

		// Check if we're trying to delete a block ID
		const blockIdRegex = /\s*\^[a-zA-Z0-9-]+\s*$/;
		
		// Check current line
		if (blockIdRegex.test(lineText.slice(ch))) {
			return this.success(); // Prevent deletion
		}

		// Check next line if at end of current line
		if (ch === lineText.length && line < editor.lineCount() - 1) {
			const nextLine = editor.getLine(line + 1);
			if (blockIdRegex.test(nextLine)) {
				return this.success(); // Prevent deletion
			}
		}

		return this.fail(); // Allow normal deletion
	}

	protected getSupportedEditorTypes(): EditorType[] {
		return [EditorType.EMBEDDED];
	}
}
