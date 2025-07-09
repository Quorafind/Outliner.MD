import { Editor, App } from "obsidian";
import { foldable } from "@codemirror/language";
import { getIndent } from "./utils";
import { SelectionAnnotation } from "../cm/SelectionController";

/**
 * Shared event handlers for editor operations
 * These functions handle common editor operations across different editor types
 *
 * @deprecated Use the new event handler system from editor-components/event-handlers
 */

export interface EditorEventContext {
	editor: Editor;
	app: App;
	line: number;
	ch: number;
	lineText: string;
}

export function handleRegularEnter(
	editor: Editor,
	line: number,
	ch: number,
	lineText: string
): boolean {
	// Implementation moved from handleRegularEnter in keyDownHandler.ts
	if (lineText.startsWith("- ")) {
		editor.transaction({
			changes: [
				{
					text: "\n- ",
					from: { line, ch: ch },
				},
			],
			selection: {
				from: { line: line, ch: ch + 3 },
				to: { line: line, ch: ch + 3 },
			},
		});
		return true;
	}

	const prevLine = line > 0 ? editor.getLine(line - 1) : "";
	if (!lineText.trim() && /^(-|\*|\d+\.)(\s\[.\])?/g.test(prevLine.trim())) {
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
		return true;
	}

	if (
		/^\s+/g.test(lineText) &&
		!/^(-|\*|\d+\.)(\s\[.\])?/g.test(lineText.trim())
	) {
		const currentIndent = lineText.match(/^\s+/)?.[0] || "";

		editor.transaction({
			changes: [
				{
					text: `\n${currentIndent}`,
					from: { line, ch },
				},
			],
			selection: {
				from: { line: line + 1, ch: currentIndent.length },
				to: { line: line + 1, ch: currentIndent.length },
			},
		});
		return true;
	}

	return false;
}

export function handleShiftEnter(
	editor: Editor,
	line: number,
	lineText: string
): boolean {
	// Implementation moved from handleShiftEnter in keyDownHandler.ts
	const charOffset = editor.posToOffset({
		line,
		ch: editor.getLine(line).length,
	});
	const charLine = editor.cm.state.doc.lineAt(charOffset);

	if (
		/^\s+/g.test(charLine.text) &&
		!/^(-|\*|\d+\.)(\s\[.\])?/g.test(charLine.text.trimStart())
	) {
		const lineNum = charLine.number;

		for (let i = lineNum; i >= 1; i--) {
			const lineCursor = editor.cm.state.doc.line(i);
			const lineText = lineCursor.text;
			if (/^(-|\*|\d+\.)(\s\[.\])?/g.test(lineText.trimStart())) {
				const currentLine = editor.cm.state.doc.line(i);
				editor.cm.dispatch({
					selection: {
						head: currentLine.to,
						anchor: currentLine.to,
					},
					annotations: SelectionAnnotation.of("arrow.up.selection"),
				});
				return true;
			}
		}
	} else if (/^(-|\*|\d+\.)(\s\[.\])?/g.test(charLine.text.trimStart())) {
		const startLineNum = charLine.number;
		let foundValidLine = false;

		for (let i = startLineNum + 1; i < editor.cm.state.doc.lines; i++) {
			const line = editor.cm.state.doc.line(i);
			const lineText = line.text;

			// Check for indented lines not starting with list markers
			if (
				/^\s+/.test(lineText) &&
				!/^(-|\*|\d+\.)\s/.test(lineText.trimStart())
			) {
				foundValidLine = true;
			} else {
				// When we find a line that doesn't match our criteria
				if (foundValidLine) {
					const currentLine = editor.cm.state.doc.line(i - 1);
					editor.cm.dispatch({
						selection: {
							head: currentLine.to,
							anchor: currentLine.to,
						},
						annotations:
							SelectionAnnotation.of("arrow.up.selection"),
					});
					return true;
				}
				return false;
			}
		}

		if (foundValidLine) {
			const lastLine = editor.cm.state.doc.line(
				editor.cm.state.doc.lines - 1
			);
			editor.cm.dispatch({
				selection: {
					head: lastLine.to,
					anchor: lastLine.to,
				},
			});
			return true;
		}
	}

	return false;
}

export function handleDelete(editor: Editor): boolean {
	const { line, ch } = editor.getCursor();
	const lineText = editor.getLine(line);
	const lineFrom = editor.posToOffset({ line, ch: 0 });
	const lineTo = editor.posToOffset({ line: line + 1, ch: 0 }) - 1;

	const foldRange = foldable(editor.cm.state, lineFrom, lineTo);

	if (
		/^(\s*?)((-|\*|\d+\.)(\s\[.\])?)\s/g.test(lineText) &&
		/^((-|\*|\d+\.)(\s\[.\])?)$/g.test(lineText.trim())
	) {
		if (line === 0) {
			return true;
		}

		if (foldRange) {
			return true;
		}

		const range = (window as any).app.plugins
			.getPlugin("obsidian-zoom")
			?.getZoomRange(editor);
		if (range) {
			const firstLineInRange = range.from.line;
			if (firstLineInRange === line) {
				return true;
			}
		}

		editor.transaction({
			changes: [
				{
					text: "",
					from: {
						line: line - 1,
						ch: editor.getLine(line - 1).length,
					},
					to: { line, ch: ch },
				},
			],
		});
		return true;
	} else if (/^\s+$/g.test(lineText)) {
		editor.transaction({
			changes: [
				{
					text: "",
					from: {
						line: line - 1,
						ch: editor.getLine(line - 1).length,
					},
					to: { line, ch: ch },
				},
			],
		});
		return true;
	}

	return false;
}

export function handleIndent(
	editor: Editor,
	app: App,
	mod: boolean,
	shift: boolean
): boolean {
	if (shift) {
		const range = app.plugins
			.getPlugin("obsidian-zoom")
			?.getZoomRange(editor);

		if (range) {
			const firstLineInRange = range.from.line;
			const lastLineInRange = range.to.line;

			const spaceOnFirstLine = editor
				.getLine(firstLineInRange)
				?.match(/^\s*/)?.[0];
			const lastLineInRangeText = editor.getLine(lastLineInRange);
			const spaceOnLastLine = lastLineInRangeText?.match(/^\s*/)?.[0];
			const indentNewLine = getIndent(app);

			if (firstLineInRange === lastLineInRange) return true;

			if (
				spaceOnFirstLine === spaceOnLastLine ||
				spaceOnLastLine === spaceOnFirstLine + indentNewLine
			) {
				return true;
			}
		}
	}

	return false;
}

export function handleEnterWithZoom(
	editor: Editor,
	app: App,
	mod: boolean,
	shift: boolean
): boolean {
	if (!shift) {
		const { line } = editor.getCursor();
		const lineText = editor.getLine(line);

		const range = app.plugins
			.getPlugin("obsidian-zoom")
			?.getZoomRange(editor);
		const indentNewLine = getIndent(app);

		if (range) {
			const firstLineInRange = range.from.line;
			const lastLineInRange = range.to.line;
			const spaceOnFirstLine =
				editor.getLine(firstLineInRange)?.match(/^\s*/)?.[0] || "";
			const lastLineInRangeText = editor.getLine(lastLineInRange);

			const cursor = editor.getCursor();
			const currentLineText = editor.getLine(cursor.line);

			if (/^((-|\*|\d+\.)(\s\[.\])?)/g.test(currentLineText.trim())) {
				const spaceOnCurrentLine =
					currentLineText.match(/^\s*/)?.[0] || "";

				editor.transaction({
					changes: [
						{
							text: `\n${spaceOnCurrentLine}${
								spaceOnCurrentLine.length >
								spaceOnFirstLine.length
									? ""
									: indentNewLine
							}- `,
							from: {
								line: cursor.line,
								ch: cursor.ch || 0,
							},
						},
					],
					selection: {
						from: {
							line: cursor.line + 1,
							ch:
								2 +
								`${spaceOnCurrentLine}${
									spaceOnCurrentLine.length >
									spaceOnFirstLine.length
										? ""
										: indentNewLine
								}`.length,
						},
						to: {
							line: cursor.line + 1,
							ch:
								2 +
								`${spaceOnCurrentLine}${
									spaceOnCurrentLine.length >
									spaceOnFirstLine.length
										? ""
										: indentNewLine
								}`.length,
						},
					},
				});
				return true;
			}

			const spaceOnLastLine = lastLineInRangeText?.match(/^\s*/)?.[0];

			if (
				/^((-|\*|\d+\.)(\s\[.\])?)$/g.test(
					lastLineInRangeText.trim()
				) &&
				spaceOnLastLine === spaceOnFirstLine + indentNewLine
			) {
				editor.transaction({
					changes: [
						{
							text: `\n${spaceOnFirstLine}${indentNewLine}- `,
							from: {
								line: lastLineInRange,
								ch: lastLineInRangeText.length || 0,
							},
						},
					],
					selection: {
						from: {
							line: lastLineInRange + 1,
							ch:
								2 +
								`${spaceOnFirstLine}${indentNewLine}`.length,
						},
						to: {
							line: lastLineInRange + 1,
							ch:
								2 +
								`${spaceOnFirstLine}${indentNewLine}`.length,
						},
					},
				});
				return true;
			}
		}

		if (/^(-|\*|\d+\.)(\s\[.\])?/g.test(lineText.trim())) {
			const range = foldable(
				editor.cm.state,
				editor.posToOffset({
					line,
					ch: 0,
				}),
				editor.posToOffset({ line: line + 1, ch: 0 }) - 1
			);

			const indentNewLine = getIndent(app);
			const spaceBeforeStartLine = lineText.match(/^\s+/)?.[0] || "";

			if (range) {
				let foundValidLine = false;

				const startLineNum = editor.cm.state.doc.lineAt(
					range.from
				).number;
				for (
					let i = startLineNum + 1;
					i < editor.cm.state.doc.lines;
					i++
				) {
					const line = editor.cm.state.doc.line(i);
					const lineText = line.text;

					// Check for indented lines that aren't list items
					if (
						/^\s+/.test(lineText) &&
						!/^(-|\*|\d+\.)\s/.test(lineText.trimStart())
					) {
						foundValidLine = true;
					} else {
						// When we find a line that doesn't match our criteria and we've found at least one valid line
						if (foundValidLine) {
							const currentLine = editor.cm.state.doc.line(i - 1);
							if (currentLine.to === range.to) {
								editor.transaction({
									changes: [
										{
											text: `${spaceBeforeStartLine}- \n`,
											from: { line: i - 1, ch: 0 },
										},
									],
								});
								editor.cm.dispatch({
									selection: {
										head: line.from,
										anchor: line.from,
									},
								});
								return true;
							} else {
								editor.cm.dispatch({
									changes: {
										insert: `${spaceBeforeStartLine}${indentNewLine}- \n`,
										from: line.from,
									},
								});
								editor.cm.dispatch({
									selection: {
										head: line.from,
										anchor: line.from,
									},
								});
								return true;
							}
						}
						return false;
					}
				}
			}
		}
	}

	return false;
}
