import {
	BaseEventHandler,
	EventHandlerContext,
	EventHandlerResult,
} from "./BaseEventHandler";
import { EditorType } from "../EditorTypes";
import { getIndent } from "../../utils/utils";
import { handleEnterWithZoom } from "../../utils/editorEventHandlers";

/**
 * Base class for Enter key event handlers
 */
export abstract class BaseEnterHandler extends BaseEventHandler {
	constructor(priority: number = 0) {
		super(priority);
	}

	/**
	 * Helper method to insert new list item
	 */
	protected insertNewListItem(
		context: EventHandlerContext
	): EventHandlerResult {
		const { editor, line, ch } = context;

		editor.transaction({
			changes: [
				{
					text: "\n- ",
					from: { line, ch },
				},
			],
			selection: {
				from: { line: line + 1, ch: 2 },
				to: { line: line + 1, ch: 2 },
			},
		});

		return this.success();
	}

	/**
	 * Helper method to insert new line with indent
	 */
	protected insertNewLineWithIndent(
		context: EventHandlerContext,
		indent: string
	): EventHandlerResult {
		const { editor, line, ch } = context;

		editor.transaction({
			changes: [
				{
					text: `\n${indent}`,
					from: { line, ch },
				},
			],
			selection: {
				from: { line: line + 1, ch: indent.length },
				to: { line: line + 1, ch: indent.length },
			},
		});

		return this.success();
	}

	/**
	 * Helper method to check if line is a list item
	 */
	protected isListItem(text: string): boolean {
		return /^(\s*)(-|\*|\d+\.)(\s\[.\])?/.test(text.trim());
	}

	/**
	 * Helper method to check if line is indented non-list line
	 */
	protected isIndentedNonListLine(text: string): boolean {
		return text.startsWith("  ") && !this.isListItem(text);
	}
}

/**
 * Handler for regular Enter key presses
 */
export class RegularEnterHandler extends BaseEnterHandler {
	constructor() {
		super(100); // High priority
	}

	canHandle(context: EventHandlerContext): boolean {
		return super.canHandle(context) && !context.shift && !context.mod;
	}

	handle(context: EventHandlerContext): EventHandlerResult {
		const { editor, line, ch, lineText } = context;

		// Handle bullet point continuation
		if (lineText.startsWith("- ")) {
			return this.insertNewListItem(context);
		}

		// Handle empty line after list item
		const prevLine = line > 0 ? editor.getLine(line - 1) : "";
		if (!lineText.trim() && this.isListItem(prevLine.trim())) {
			editor.transaction({
				changes: [
					{
						text: "- ",
						from: { line, ch: 0 },
					},
				],
				selection: {
					from: { line: line, ch: 2 },
					to: { line: line, ch: 2 },
				},
			});
			return this.success();
		}

		// Handle indented non-list lines
		if (this.isIndentedNonListLine(lineText)) {
			const indent = getIndent(context.app);
			return this.insertNewLineWithIndent(context, indent);
		}

		// Handle list item continuation
		if (this.isListItem(lineText.trim())) {
			const match = lineText.match(/^(\s*)(-|\*|\d+\.)(\s\[.\])?/);
			if (match) {
				const indent = match[1];
				const bullet = match[2];
				const checkbox = match[3] || "";

				editor.transaction({
					changes: [
						{
							text: `\n${indent}${bullet}${checkbox} `,
							from: { line, ch },
						},
					],
					selection: {
						from: {
							line: line + 1,
							ch:
								indent.length +
								bullet.length +
								checkbox.length +
								1,
						},
						to: {
							line: line + 1,
							ch:
								indent.length +
								bullet.length +
								checkbox.length +
								1,
						},
					},
				});
				return this.success();
			}
		}

		return this.fail();
	}
}

/**
 * Handler for Shift+Enter key presses
 */
export class ShiftEnterHandler extends BaseEnterHandler {
	constructor() {
		super(90); // High priority, but lower than regular enter
	}

	canHandle(context: EventHandlerContext): boolean {
		return super.canHandle(context) && context.shift === true;
	}

	handle(context: EventHandlerContext): EventHandlerResult {
		const { editor, line, lineText } = context;
		const charOffset = editor.posToOffset({ line, ch: 0 });
		const charLine = editor.cm.state.doc.lineAt(charOffset);

		if (this.isIndentedNonListLine(charLine.text)) {
			return this.navigateToPreviousListItem(editor, charLine.number);
		}

		if (this.isListItem(charLine.text)) {
			return this.navigateToNextNonListItem(editor, charLine.number);
		}

		return this.fail();
	}

	/**
	 * Navigate to previous list item
	 */
	private navigateToPreviousListItem(
		editor: any,
		lineNumber: number
	): EventHandlerResult {
		for (let i = lineNumber - 1; i >= 1; i--) {
			const line = editor.cm.state.doc.line(i);
			if (this.isListItem(line.text)) {
				editor.setCursor(editor.offsetToPos(line.to));
				return this.success();
			}
		}
		return this.fail();
	}

	/**
	 * Navigate to next non-list item
	 */
	private navigateToNextNonListItem(
		editor: any,
		lineNumber: number
	): EventHandlerResult {
		const totalLines = editor.cm.state.doc.lines;
		for (let i = lineNumber + 1; i <= totalLines; i++) {
			const line = editor.cm.state.doc.line(i);
			if (
				!this.isListItem(line.text) &&
				!this.isIndentedNonListLine(line.text)
			) {
				editor.setCursor(editor.offsetToPos(line.from));
				return this.success();
			}
		}
		return this.fail();
	}
}

/**
 * Handler for Mod+Enter key presses (zoom functionality)
 */
export class ModEnterHandler extends BaseEnterHandler {
	constructor() {
		super(80); // Lower priority than regular handlers
	}

	canHandle(context: EventHandlerContext): boolean {
		return super.canHandle(context) && context.mod === true;
	}

	handle(context: EventHandlerContext): EventHandlerResult {
		const { editor, app, mod, shift } = context;
		const handled = handleEnterWithZoom(
			editor,
			app,
			mod || false,
			shift || false
		);

		return handled ? this.success() : this.fail();
	}

	protected getSupportedEditorTypes(): EditorType[] {
		// Zoom functionality is primarily for outliner editors
		return [EditorType.OUTLINER];
	}
}
