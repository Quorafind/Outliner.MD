import { EditorSelection, EditorState } from "@codemirror/state";

export const disableToDeleteBlockID = () => {
	return EditorState.transactionFilter.of((tr) => {

		if (tr.newSelection) {
			// Check if text before the cursor is a block ID based on \^[a-zA-Z0-9-]+
			const beforeCursor = tr.state.doc.sliceString(0, tr.newSelection.ranges[0].from);

			const blockIDRegex = /\^[a-zA-Z0-9-]+$/;
			const match = beforeCursor.match(blockIDRegex);

			const sel = tr.newSelection;
			// const foldableRange = foldable(tr.state, currentLine.from, currentLine.to);

			if (match) {
				const blockIDRange = match ? {
					from: tr.newSelection.ranges[0].from - match[0].length,
					to: tr.newSelection.ranges[0].from
				} : null;

				if (!blockIDRange) {
					return tr;
				}

				return [tr, {
					selection: EditorSelection.create(sel.ranges.map(
						r => EditorSelection.range(blockIDRange?.from, blockIDRange.from)), sel.mainIndex)
				}];
			}
		}

		// if (tr.selection) {
		// 	const blockIDRegex = /^\^[a-zA-Z0-9-]+/;
		// 	const afterCursor = tr.startState.doc.sliceString(tr.startState.selection?.ranges[0].from, tr.startState.doc.length);
		//
		// 	const afterMatch = afterCursor.match(blockIDRegex);
		//
		// 	const toRight = (tr.newSelection.ranges[0].from - tr.selection.ranges[0].from) > 0;
		//
		// 	if (afterMatch) {
		// 		const blockIDRange = afterMatch ? {
		// 			from: tr.startState.selection.ranges[0].from,
		// 			to: tr.startState.selection.ranges[0].from + afterMatch[0].length
		// 		} : null;
		//
		// 		const sel = tr.startState.selection;
		//
		// 		if (!blockIDRange) {
		// 			return tr;
		// 		}
		//
		// 		return [tr, {
		// 			selection: EditorSelection.create(sel.ranges.map(
		// 				r => EditorSelection.range(toRight ? blockIDRange?.to : blockIDRange.from, toRight ? blockIDRange.to : blockIDRange.)), sel.mainIndex)
		// 		}];
		// 	}
		// }

		return tr;
	});
};
