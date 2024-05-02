import { EditorState, RangeSet, RangeValue } from "@codemirror/state";
import { App } from "obsidian";
import { RegExpCursor } from "./regexp-cursor";
import { EditorView } from "@codemirror/view";
import { SearchHighlightEffect } from "./SearchHighlight";

export function rangeSetToArray<T extends RangeValue>(
	rs: RangeSet<T>
): Array<{ from: number; to: number }> {
	const res = [];
	const i = rs.iter();
	while (i.value !== null) {
		res.push({from: i.from, to: i.to});
		i.next();
	}
	return res;
}


export function getIndent(app: App) {
	const useTab = app.vault.getConfig('useTab') === undefined || window.app.vault.getConfig('useTab') === true;
	const tabSize = useTab ? 1 : app.vault.getConfig('tabSize');

	// const removeNewLine = MemoContent.replace(/\n/g, '<br>');
	const indentNewLine = (useTab ? '\t' : ' ').repeat(tabSize);

	return indentNewLine;
}


function findParentRange(state: EditorState, position: number): { from: number; to: number } | null {
	// This function should return the fold range that includes the position but is not exactly at the position
	// Placeholder logic: Needs implementation based on actual folding logic used
	return null;
}

// function consolidateRanges(ranges: { from: number; to: number }[]): { from: number; to: number }[] {
// 	// Consolidate overlapping or contiguous ranges
// 	ranges.sort((a, b) => a.from - b.from);
// 	const consolidated = [];
//
// 	for (const range of ranges) {
// 		if (consolidated.length === 0 || consolidated[consolidated.length - 1].to < range.from - 1) {
// 			consolidated.push(range);
// 		} else {
// 			consolidated[consolidated.length - 1].to = Math.max(consolidated[consolidated.length - 1].to, range.to);
// 		}
// 	}
//
// 	return consolidated;
// }


export function getSearchRanges(view: EditorView, search: string) {
	const state = view.state;
	const searchCursor = new RegExpCursor(state.doc, search, {}, 0, state.doc.length);
	const ranges = [];

	while (!searchCursor.next().done) {
		let {from, to} = searchCursor.value;

		const bulletListVisibleLine = state.doc.lineAt(from);
		ranges.push({from: bulletListVisibleLine.from, to: bulletListVisibleLine.to});

		// console.log('from', from, 'to', to, bulletListVisibleLine.text, bulletListVisibleLine.from, bulletListVisibleLine.to);

		view.dispatch({
			effects: SearchHighlightEffect.of({
				from, to
			})
		});
	}

	return ranges;

}
