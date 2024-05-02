import { Annotation, EditorSelection, EditorState } from "@codemirror/state";
import { foldable } from "@codemirror/language";
import { Editor } from "obsidian";

export const SelectionAnnotation = Annotation.define<string>();

export const selectionController = () => {
	return EditorState.transactionFilter.of((tr) => {
		const currentSelection = tr.state.selection.main;
		const currentLine = tr.state.doc.lineAt(currentSelection.from);

		console.log('currentSelection', currentSelection.from, currentSelection.to, currentLine.text);

		if (tr.annotation(SelectionAnnotation) === 'arrow.up.selection') {
			console.log('arrow.up.selection', currentSelection.from, currentSelection.to, currentLine.text);
			return tr;
		}

		if (!(/^\s*(-|\*|\d{1,}\.)(\s\[.\])?\s/.test(currentLine.text))) return tr;

		const currentFirstMark = currentLine.text.match(/^\s*(-|\*|\d{1,}\.)(\s\[.\])?\s/)![0];

		const lastLine = tr.state.doc.lineAt(currentSelection.to);
		// if (lastLine.number !== currentLine.number) return tr;

		const allowedFrom = currentLine.from + currentFirstMark.length;
		const allowedTo = (lastLine.number !== currentLine.number) ? lastLine.to : currentLine.to;

		let sel = tr.newSelection;
		const foldableRange = foldable(tr.state, currentLine.from, currentLine.to);

		if (foldableRange && currentLine?.number !== lastLine.number) {
			return [tr, {
				selection: EditorSelection.create(sel.ranges.map(
					r => EditorSelection.range(foldableRange.to, foldableRange.from - currentLine.length)), sel.mainIndex)
			}];
		}

		if (!sel.ranges.some(({from, to}) => from < allowedFrom || to > allowedTo))
			return tr;
		let clip = (n: number) => Math.min(Math.max(n, allowedFrom), allowedTo);


		// console.log(sel.ranges.map(r => r.from, r => r.to), allowedFrom, allowedTo, sel.ranges.map(r => clip(r.from), r => clip(r.to)));

		return [tr, {
			selection: EditorSelection.create(sel.ranges.map(
				r => EditorSelection.range(clip(r.anchor), clip(r.head))), sel.mainIndex)
		}];
	});
};
