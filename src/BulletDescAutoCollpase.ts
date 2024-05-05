import { foldEffect, foldService, foldState, unfoldEffect } from "@codemirror/language";
import { Annotation, EditorSelection, EditorState, Extension, StateField } from "@codemirror/state";
import { zoomInEffect, zoomInRangesEffect, zoomOutEffect, zoomWithHideIndentEffect } from "./checkVisible";

export const FoldAnnotation = Annotation.define<string>();

function findMatchingFoldRange(state: EditorState, currentPos: number): { from: number, to: number } | null {
	const startStack: number[] = [];
	const endLine = state.doc.lines;

	const currentLine = state.doc.lineAt(currentPos);

	if(currentLine.number === 1) return null;
	const prevLine = state.doc.line(currentLine.number - 1);
	if(!(/^(-|\*|(\d{1,}\.))(\s(\[.\]))?/g.test(prevLine.text.trim()))) return null;

	startStack.push(currentLine.to);

	for (let i = currentLine.number; i <= endLine; i++) {
		const line = state.doc.line(i);

		if( (!(/^\s+/.test(line.text)) || i === endLine || /^(-|\*|(\d{1,}\.))(\s(\[.\]))?/g.test(line.text.trim()))) {
			const start = startStack.pop();

			if (start !== undefined) {
				return {from: start, to: line.from - 1};
			}
		}

	}

	return null;  // If no matching range is found, return null
}

export function getAllFoldableRanges(state: EditorState): { from: number, to: number }[] {
	const ranges: { from: number, to: number }[] = [];
	const startStack: number[] = [];

	for (let i = 1; i <= state.doc.lines; i++) {
		const line = state.doc.line(i);

		// Reset regular expressions

		if(/^\s+/.test(line.text) && !(/^(-|\*|(\d{1,}\.))(\s(\[.\]))?/g.test(line.text.trim()))) {
			// Check prev line if bullet line
			const prevLine = state.doc.line(i - 1);
			if (!prevLine) continue;
			if (!(/^(-|\*|(\d{1,}\.))(\s(\[.\]))?/g.test(prevLine.text.trim()))) continue;

			startStack.push(line.to);
		}

		if( (!(/^\s+/.test(line.text)) || i === state.doc.lines || /^(-|\*|(\d{1,}\.))(\s(\[.\]))?/g.test(line.text.trim()))) {
			const start = startStack.pop();
			if (start !== undefined && line.from - 1 !== start) {
				ranges.push({from: start, to: line.from - 1});
			}
		}
	}

	return ranges;
}

function foldServiceFunc(state: EditorState, lineStart: number, lineEnd: number): { from: number, to: number } | null {
	const range = findMatchingFoldRange(state, lineStart);
	// console.log('range', range);
	if (!range) return null;
	if (range.to <= range.from) return null;

	return range;
}

const foldRanges = StateField.define<{ from: number, to: number }[]>({
	create: (state) => {
		const ranges = getAllFoldableRanges(state);
		return ranges;
	},
	update(value, tr) {
		if (tr.docChanged) {
			return getAllFoldableRanges(tr.state);
		}
		return value;
	}
});

export const unfoldWhenSelect = () => {
	return EditorState.transactionFilter.of((tr) => {
		if (
			tr.effects.some((effect) => {
				return effect.is(unfoldEffect)
			})
		) {
			const ranges = tr.effects.map((effect) => {
				return effect.value;
			});

			const sel = tr.state.selection;

			if (ranges.length === 1) {
				return [
					tr,
					{
						selection: EditorSelection.create([
							EditorSelection.range(ranges[0].to, ranges[0].to)
						], sel.mainIndex)
					}
				];
			} else {
				return tr;
			}
		}

		if(tr.effects.some((effect)=> {
			return effect.is(zoomInEffect) || effect.is(zoomInRangesEffect) || effect.is(zoomWithHideIndentEffect);
		})) {
			const allFoldedRanges = getAllFoldableRanges(tr.state);
			const effects = allFoldedRanges.map((r) => {
				return unfoldEffect.of({
					from: r.from,
					to: r.to,
				});
			});
			return [tr, {effects, annotations: [FoldAnnotation.of('outliner.unfold')]}];
		}

		if(tr.effects.some((effect)=> {
			return effect.is(zoomOutEffect);
		})) {
			return tr;
		}

		const allFoldedRanges = getAllFoldableRanges(tr.state);

		const currentSelection = tr.state.selection;
		const range = allFoldedRanges.find((r) => {
			const currentLine = tr.state.doc.lineAt(currentSelection.main.from);
			const currentAnchorLine = tr.state.doc.lineAt(currentSelection.main.to);
			const rangeFromLine = tr.state.doc.lineAt(r.from);
			const rangeToLine = tr.state.doc.lineAt(r.to);
			return (currentLine.number >= rangeFromLine.number && currentLine.number <= rangeToLine.number) || (currentAnchorLine.number >= rangeFromLine.number && currentAnchorLine.number <= rangeToLine.number);
		});

		if(range) {
			if(tr.effects.some((effect)=> {
				return effect.is(foldEffect);
			})) {
				return [tr, {
					effects: [foldEffect.of(range)],
					annotations: [FoldAnnotation.of('outliner.fold')],
				}];
			}

			return [tr, {
				effects: [unfoldEffect.of(range)],
				annotations: [FoldAnnotation.of('outliner.unfold')],
			}];
		} else if(!tr.docChanged && tr.newSelection) {
			const allFoldedRanges = getAllFoldableRanges(tr.state);
			const effects = allFoldedRanges.map((r) => {
				return foldEffect.of({
					from: r.from,
					to: r.to,
				});
			});
			return [tr, {effects, annotations: [FoldAnnotation.of('outliner.fold')]}];
		}

		return tr;
	});
};

export const FoldingExtension: Extension = [
	// codeFolding({
	// 	// placeholderDOM(view, onclick) {
	// 	// 	const placeholder = createEl("span", {
	// 	// 		text: "...",
	// 	// 		cls: "cm-outliner-fold-placeholder",
	// 	// 	});
	// 	// 	placeholder.onclick = onclick;
	// 	// 	return placeholder;
	// 	// },
	// }),
	// UnfoldWhenSelect(),
	unfoldWhenSelect(),
	foldRanges,
	foldService.of(foldServiceFunc),
];
