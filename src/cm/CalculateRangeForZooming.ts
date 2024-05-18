import { EditorState } from "@codemirror/state";
import { foldable } from "@codemirror/language";
import { EditorView } from "@codemirror/view";
import { getSearchRanges } from "../utils/utils";

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

	public calculateRangesBasedOnType(view: EditorView, type: 'completed' | 'incompleted') {
		const state = view.state;
		const ranges: {
			from: number;
			to: number;
		}[] = [];
		for (let i = 1; i <= state.doc.lines; i++) {
			const line = state.doc.line(i);
			if (type === 'completed' && line.text.includes('[x]')) {
				ranges.push({from: line.from, to: line.to});
			}

			if (type === 'incompleted' && !line.text.includes('[x]')) {
				ranges.push({from: line.from, to: line.to});
			}
		}

		// const markdownFileInfo = view.state.field(editorInfoField);
		// const foldableRanges = markdownFileInfo.editor?.getAllFoldableLines();
		const finalRanges = ranges.map((range) => {
			return this.calculateRangeForZooming(state, range.from) || range;
		});

		return finalRanges;

	}

	public calculateRangesBasedOnSearch(view: EditorView, foldableRanges: {
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
				const startLine = view.state.doc.lineAt(containedRange.from);
				// Get fold ranges that start from the startLine;
				showedRanges.push({
					from: startLine.from,
					to: inFoldRanges.to
				});
			}
		}

		containedRanges.forEach((range) => {
			if (!showedRanges.some(r => r.from === range.from && r.to === range.to)) {
				showedRanges.push(range);
			}
		});

		return showedRanges;
	}
}
