import { EditorState, RangeSet, RangeValue } from "@codemirror/state";
import { zoomStateField } from "./checkVisible";
import { foldable } from "@codemirror/language";
import { App } from "obsidian";
import { RegExpCursor } from "./regexp-cursor";
import { EditorView } from "@codemirror/view";
import { SearchHighlightDecoration, SearchHighlightEffect } from "./SearchHighlight";

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


export class CalculateRangeForZooming {
	public calculateRangeForZooming(state: EditorState, pos: number) {
		const line = state.doc.lineAt(pos);
		const foldRange = foldable(state, line.from, line.to);

		if (!foldRange && /^\s*([-*+]|\d+\.)\s+/.test(line.text)) {
			return {from: line.from, to: line.to};
		}

		if (!foldRange) {
			return null;
		}

		return {from: line.from, to: foldRange.to};
	}

	public calculateAllShowedContentRanges(view: EditorView, foldableRanges: {
		from: number;
		to: number
	}[], keyString: string) {
		// This will hold all the ranges that need to be shown
		const showedRanges: {
			from: number;
			to: number
		}[] = [];

		const containedRanges = getSearchRanges(view, keyString);

		// const addRangeToShow = (range: { from: number; to: number }) => {
		// 	const existing = showedRanges.some(r => r.from === range.from && r.to === range.to);
		// 	if (!existing) {
		// 		showedRanges.push(range);
		// 	}
		// };

		// Check each contained range against foldable ranges

		for (const containedRange of containedRanges) {
			console.log('foldedRanges', foldableRanges, containedRange.from, containedRange.to, view.state.doc.lineAt(containedRange.from).from);
			const inFoldRanges = foldableRanges.find(r => r.from === containedRange.to);
			const parentFoldRanges = foldableRanges.filter(r => r.from < containedRange.from && r.to >= containedRange.to);
			if (parentFoldRanges.length > 0) {
				const parentLines = parentFoldRanges.map(r => view.state.doc.lineAt(r.from));
				const visibleParentLines = parentLines.map((l) => {
					return {
						from: l.from,
						to: l.to
					};
				});
				showedRanges.push(...visibleParentLines);
			}

			if (inFoldRanges) {
				console.log('inFoldRanges', inFoldRanges);
				const startLine = view.state.doc.lineAt(containedRange.from);
				// Get fold ranges that start from the startLine;
				showedRanges.push({
					from: startLine.from,
					to: inFoldRanges.to
				});
			}
		}

		console.log(showedRanges);

		containedRanges.forEach((range) => {
			if (!showedRanges.some(r => r.from === range.from && r.to === range.to)) {
				showedRanges.push(range);
			}
		});

		return showedRanges;
	}
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


function getSearchRanges(view: EditorView, search: string) {
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
