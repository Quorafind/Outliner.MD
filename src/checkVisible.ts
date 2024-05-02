import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";

export interface ZoomInRange {
	from: number;
	to: number;
}

export type ZoomInStateEffect = StateEffect<ZoomInRange>;
export const zoomInRangesEffect = StateEffect.define<{ ranges: Array<{ from: number, to: number }> }>();

export const hideRangesEffect = StateEffect.define<{ ranges: Array<{ from: number, to: number }> }>();
export const zoomInEffect = StateEffect.define<ZoomInRange>();

export const zoomOutEffect = StateEffect.define<void>();

export const zoomWithHideIndentEffect = StateEffect.define<{ range: { from: number, to: number }, indent: string }>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isZoomInEffect(e: StateEffect<any>): e is ZoomInStateEffect {
	return e.is(zoomInEffect);
}

const zoomMarkHidden = Decoration.replace({block: true});

export const zoomStateField = StateField.define<DecorationSet>({
	create: () => {
		return Decoration.none;
	},

	update: (value, tr) => {
		value = value.map(tr.changes);

		for (const e of tr.effects) {
			if (e.is(zoomInEffect)) {
				value = value.update({filter: () => false});

				if (e.value.from > 0) {
					value = value.update({
						add: [zoomMarkHidden.range(0, e.value.from - 1)],
					});
				}

				if (e.value.to < tr.newDoc.length) {
					value = value.update({
						add: [zoomMarkHidden.range(e.value.to + 1, tr.newDoc.length)],
					});
				}
			}

			if (e.is(hideRangesEffect)) {
				value = value.update({filter: () => false});


				let totalLength = tr.state.doc.length;

				e.value.ranges.forEach(range => {
					value = value.update({
						add: [zoomMarkHidden.range(range.from, range.to)]
					});
				});
			}

			if (e.is(zoomOutEffect)) {
				value = value.update({filter: () => false});
			}

			if (e.is(zoomInRangesEffect)) {
				value = value.update({filter: () => false});

				let totalLength = tr.state.doc.length;
				let visibleRanges = e.value.ranges;
				visibleRanges.sort((a, b) => a.from - b.from);
				let hiddenRanges = [];
				let lastVisibleEnd = 0;

				visibleRanges.forEach(range => {
					if (range.from > lastVisibleEnd + 1) {
						// If there is a gap between the last visible range and the current range,
						// that gap is a hidden range
						hiddenRanges.push({from: lastVisibleEnd, to: range.from});
					}
					// Update the end of the last visible range
					lastVisibleEnd = Math.max(lastVisibleEnd, range.to);
				});

				if (lastVisibleEnd < totalLength) {
					hiddenRanges.push({from: lastVisibleEnd, to: totalLength});
				}

				console.log(hiddenRanges);

				hiddenRanges.forEach((range) => {
					value = value.update({
						add: [zoomMarkHidden.range(range.from === 0 ? range.from : range.from + 1, range.to === totalLength ? range.to : range.to - 1)],
					});
				});
			}

			if (e.is(zoomWithHideIndentEffect)) {
				// value = value.update({filter: () => false});
				const {range, indent} = e.value;

				const firstLine = tr.state.doc.lineAt(range.from);
				const lastLine = tr.state.doc.lineAt(range.to);

				for (let i = firstLine.number; i <= lastLine.number; i++) {
					const line = tr.state.doc.line(i);
					value = value.update({
						add: [zoomMarkHidden.range(line.from, line.from + indent.length)]
					});
				}
			}
		}

		return value;
	},

	provide: (zoomStateField) => EditorView.decorations.from(zoomStateField),
});


