import { BaseEventHandler, EventHandlerContext, EventHandlerResult } from "./BaseEventHandler";
import { EditorType } from "../EditorTypes";
import { foldable } from "@codemirror/language";

/**
 * Base class for Tab/Indent event handlers
 */
export abstract class BaseIndentHandler extends BaseEventHandler {
	constructor(priority: number = 0) {
		super(priority);
	}

	/**
	 * Helper method to check if line is a list item
	 */
	protected isListItem(text: string): boolean {
		return /^(\s*)(-|\*|\d+\.)(\s\[.\])?/.test(text.trim());
	}

	/**
	 * Helper method to get current indentation level
	 */
	protected getIndentationLevel(text: string): number {
		const match = text.match(/^(\s*)/);
		return match ? match[1].length : 0;
	}

	/**
	 * Helper method to add indentation
	 */
	protected addIndentation(context: EventHandlerContext, spaces: number = 2): EventHandlerResult {
		const { editor, line, lineText } = context;
		const indent = " ".repeat(spaces);
		
		editor.transaction({
			changes: [
				{
					text: indent + lineText,
					from: { line, ch: 0 },
					to: { line, ch: lineText.length },
				},
			],
			selection: {
				from: { line, ch: spaces },
				to: { line, ch: spaces },
			},
		});
		
		return this.success();
	}

	/**
	 * Helper method to remove indentation
	 */
	protected removeIndentation(context: EventHandlerContext, spaces: number = 2): EventHandlerResult {
		const { editor, line, lineText } = context;
		const currentIndent = this.getIndentationLevel(lineText);
		
		if (currentIndent === 0) {
			return this.fail(); // No indentation to remove
		}
		
		const removeSpaces = Math.min(spaces, currentIndent);
		const newText = lineText.slice(removeSpaces);
		
		editor.transaction({
			changes: [
				{
					text: newText,
					from: { line, ch: 0 },
					to: { line, ch: lineText.length },
				},
			],
			selection: {
				from: { line, ch: Math.max(0, context.ch - removeSpaces) },
				to: { line, ch: Math.max(0, context.ch - removeSpaces) },
			},
		});
		
		return this.success();
	}
}

/**
 * Handler for Tab key presses (increase indentation)
 */
export class TabIndentHandler extends BaseIndentHandler {
	constructor() {
		super(100); // High priority
	}

	canHandle(context: EventHandlerContext): boolean {
		return super.canHandle(context) && !context.shift;
	}

	handle(context: EventHandlerContext): EventHandlerResult {
		const { editor, line, ch, lineText } = context;

		// Handle selection indentation
		if (editor.somethingSelected()) {
			return this.handleSelectionIndent(context);
		}

		// Handle list item indentation
		if (this.isListItem(lineText)) {
			return this.addIndentation(context);
		}

		// Handle regular line indentation
		if (ch === 0 || lineText.slice(0, ch).trim() === "") {
			return this.addIndentation(context);
		}

		// Default tab behavior (insert tab character)
		editor.transaction({
			changes: [
				{
					text: "  ", // Use 2 spaces instead of tab
					from: { line, ch },
				},
			],
			selection: {
				from: { line, ch: ch + 2 },
				to: { line, ch: ch + 2 },
			},
		});

		return this.success();
	}

	/**
	 * Handle indentation of selected text
	 */
	private handleSelectionIndent(context: EventHandlerContext): EventHandlerResult {
		const { editor } = context;
		const selection = editor.getSelection();
		const lines = selection.split('\n');
		
		const indentedLines = lines.map(line => {
			if (line.trim().length > 0) {
				return "  " + line; // Add 2 spaces
			}
			return line; // Keep empty lines as is
		});
		
		editor.replaceSelection(indentedLines.join('\n'));
		return this.success();
	}
}

/**
 * Handler for Shift+Tab key presses (decrease indentation)
 */
export class ShiftTabIndentHandler extends BaseIndentHandler {
	constructor() {
		super(90); // High priority, but lower than regular tab
	}

	canHandle(context: EventHandlerContext): boolean {
		return super.canHandle(context) && context.shift === true;
	}

	handle(context: EventHandlerContext): EventHandlerResult {
		const { editor } = context;

		// Handle selection unindentation
		if (editor.somethingSelected()) {
			return this.handleSelectionUnindent(context);
		}

		// Handle regular line unindentation
		return this.removeIndentation(context);
	}

	/**
	 * Handle unindentation of selected text
	 */
	private handleSelectionUnindent(context: EventHandlerContext): EventHandlerResult {
		const { editor } = context;
		const selection = editor.getSelection();
		const lines = selection.split('\n');
		
		const unindentedLines = lines.map(line => {
			if (line.startsWith("  ")) {
				return line.slice(2); // Remove 2 spaces
			} else if (line.startsWith(" ")) {
				return line.slice(1); // Remove 1 space
			}
			return line; // No indentation to remove
		});
		
		editor.replaceSelection(unindentedLines.join('\n'));
		return this.success();
	}
}

/**
 * Handler for Mod+Tab (folding functionality)
 */
export class ModTabFoldHandler extends BaseIndentHandler {
	constructor() {
		super(80); // Lower priority than regular indent handlers
	}

	canHandle(context: EventHandlerContext): boolean {
		return super.canHandle(context) && context.mod === true;
	}

	handle(context: EventHandlerContext): EventHandlerResult {
		const { editor, line } = context;

		// Get foldable range at current line
		const pos = editor.posToOffset({ line, ch: 0 });
		const foldableRange = foldable(editor.cm.state, pos, pos);

		if (foldableRange) {
			// For now, just mark as successful without actually folding
			// TODO: Implement proper folding using foldEffect from @codemirror/language
			return this.success();
		}

		return this.fail();
	}

	protected getSupportedEditorTypes(): EditorType[] {
		// Folding is primarily for outliner and task group editors
		return [EditorType.OUTLINER, EditorType.TASK_GROUP];
	}
}

/**
 * Handler for smart indentation based on context
 */
export class SmartIndentHandler extends BaseIndentHandler {
	constructor() {
		super(50); // Medium priority
	}

	handle(context: EventHandlerContext): EventHandlerResult {
		const { editor, line, lineText } = context;

		// Smart indentation for list items
		if (this.isListItem(lineText)) {
			return this.handleListItemSmartIndent(context);
		}

		// Smart indentation for code blocks
		if (this.isInCodeBlock(context)) {
			return this.handleCodeBlockIndent(context);
		}

		return this.fail();
	}

	/**
	 * Handle smart indentation for list items
	 */
	private handleListItemSmartIndent(context: EventHandlerContext): EventHandlerResult {
		const { editor, line } = context;

		// Look at previous line to determine appropriate indentation
		if (line > 0) {
			const prevLine = editor.getLine(line - 1);
			const prevIndent = this.getIndentationLevel(prevLine);
			
			if (this.isListItem(prevLine)) {
				// Match previous list item indentation
				const currentIndent = this.getIndentationLevel(context.lineText);
				const targetIndent = prevIndent;
				
				if (currentIndent !== targetIndent) {
					const diff = targetIndent - currentIndent;
					if (diff > 0) {
						return this.addIndentation(context, diff);
					} else {
						return this.removeIndentation(context, -diff);
					}
				}
			}
		}

		return this.fail();
	}

	/**
	 * Handle indentation in code blocks
	 */
	private handleCodeBlockIndent(context: EventHandlerContext): EventHandlerResult {
		// Add 4 spaces for code blocks
		return this.addIndentation(context, 4);
	}

	/**
	 * Check if cursor is in a code block
	 */
	private isInCodeBlock(context: EventHandlerContext): boolean {
		const { editor, line } = context;
		
		// Simple check for code blocks (between ``` markers)
		let inCodeBlock = false;
		for (let i = 0; i <= line; i++) {
			const lineText = editor.getLine(i);
			if (lineText.trim().startsWith("```")) {
				inCodeBlock = !inCodeBlock;
			}
		}
		
		return inCodeBlock;
	}
}
