import { Editor } from "obsidian";
import { getIndent } from "./utils";
import { SelectionAnnotation } from "../cm/SelectionController";
import { foldable } from "@codemirror/language";
import { EditorSelection } from "@codemirror/state";

export const handleShiftEnter = (editor: Editor, line: number, lineText: string): boolean => {
	const charOffset = editor.posToOffset({line, ch: 0});
	const charLine = editor.cm.state.doc.lineAt(charOffset);

	if (isIndentedNonListLine(charLine.text)) {
		return navigateToPreviousListItem(editor, charLine.number);
	}

	if (isListItem(charLine.text)) {
		return navigateToNextNonListItem(editor, charLine.number);
	}

	return false;
};

export const handleRegularEnter = (editor: Editor, line: number, ch: number, lineText: string): boolean => {
	const prevLine = line > 0 ? editor.getLine(line - 1) : "";
	// @ts-ignore
	const indentNewLine = getIndent(editor.app);

	if (lineText.startsWith("- ")) {
		insertNewListItem(editor, line, ch);
		return true;
	}

	if (!lineText.trim() && isListItem(prevLine.trim())) {
		insertNewListItemAtStart(editor, line);
		return true;
	}

	if (isIndentedNonListLine(lineText)) {
		insertNewLineWithIndent(editor, line, ch, lineText);
		return true;
	}

	if (isListItem(lineText.trim())) {
		return handleListItemEnter(editor, line, lineText, indentNewLine);
	}

	return false;
};

const isIndentedNonListLine = (text: string): boolean => {
	return /^\s+/g.test(text) && !isListItem(text.trim());
};

const isListItem = (text: string): boolean => {
	return /^(-|\*|\d+\.)(\s\[.\])?/g.test(text);
};

const navigateToPreviousListItem = (editor: Editor, startLine: number): boolean => {
	for (let i = startLine - 1; i >= 1; i--) {
		const lineText = editor.cm.state.doc.line(i).text;
		if (isListItem(lineText.trim())) {
			const currentLine = editor.cm.state.doc.line(i);
			editor.cm.dispatch({
				selection: EditorSelection.cursor(currentLine.to),
				annotations: [SelectionAnnotation.of('arrow.up.selection')],
			});
			return true;
		}
	}
	return false;
};

const navigateToNextNonListItem = (editor: Editor, startLine: number): boolean => {
	let foundValidLine = false;

	for (let i = startLine + 1; i <= editor.cm.state.doc.lines; i++) {
		const lineText = editor.cm.state.doc.line(i).text;

		if (isIndentedNonListLine(lineText)) {
			foundValidLine = true;
		} else if (foundValidLine) {
			const currentLine = editor.cm.state.doc.line(i - 1);
			editor.cm.dispatch({
				selection: EditorSelection.cursor(currentLine.to),
				annotations: [SelectionAnnotation.of('arrow.up.selection')],
			});
			return true;
		}
	}

	if (foundValidLine) {
		const lastLine = editor.cm.state.doc.line(editor.cm.state.doc.lines);
		editor.cm.dispatch({
			selection: {head: lastLine.to, anchor: lastLine.to},
		});
		return true;
	}

	return false;
};

const insertNewListItem = (editor: Editor, line: number, ch: number): void => {
	editor.transaction({
		changes: [{text: "\n- ", from: {line, ch}}],
		selection: {from: {line, ch: ch + 3}, to: {line, ch: ch + 3}}
	});
};

const insertNewListItemAtStart = (editor: Editor, line: number): void => {
	editor.transaction({
		changes: [{text: "- ", from: {line, ch: 0}}],
		selection: {from: {line, ch: 2}, to: {line, ch: 2}}
	});
};

const insertNewLineWithIndent = (editor: Editor, line: number, ch: number, lineText: string): void => {
	const currentIndent = lineText.match(/^\s+/)?.[0] || '';
	editor.transaction({
		changes: [{text: `\n${currentIndent}`, from: {line, ch}}],
		selection: {from: {line: line + 1, ch: currentIndent.length}, to: {line: line + 1, ch: currentIndent.length}}
	});
};

const handleListItemEnter = (editor: Editor, line: number, lineText: string, indentNewLine: string): boolean => {
	const range = foldable(editor.cm.state, editor.posToOffset({line, ch: 0}), editor.posToOffset({
		line: line + 1,
		ch: 0
	}) - 1);
	const spaceBeforeStartLine = lineText.match(/^\s+/)?.[0] || "";

	if (!range) return false;

	let foundValidLine = false;
	const startLineNum = editor.cm.state.doc.lineAt(range.from).number;

	for (let i = startLineNum + 1; i < editor.cm.state.doc.lines; i++) {
		const lineText = editor.cm.state.doc.line(i).text;

		if (isIndentedNonListLine(lineText)) {
			foundValidLine = true;
		} else if (foundValidLine) {
			return insertNewListItemAfterContent(editor, i, spaceBeforeStartLine, indentNewLine, range);
		}
	}

	return false;
};

const insertNewListItemAfterContent = (editor: Editor, lineNum: number, spaceBeforeStartLine: string, indentNewLine: string, range: any): boolean => {
	const currentLine = editor.cm.state.doc.line(lineNum - 1);
	const insertText = `${spaceBeforeStartLine}${currentLine.to === range.to ? '- \n' : `${indentNewLine}- \n`}`;

	editor.transaction({
		changes: [{text: insertText, from: {line: lineNum - 1, ch: 0}}]
	});

	editor.cm.dispatch({
		selection: {
			head: editor.cm.state.doc.line(lineNum).from,
			anchor: editor.cm.state.doc.line(lineNum).from,
		}
	});

	return true;
};
