import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { EditorState, Extension, StateEffect, StateField } from "@codemirror/state";
import { rangeSetToArray } from "./utils";

export interface ZoomInRange {
	from: number;
	to: number;
}

export type ZoomInStateEffect = StateEffect<ZoomInRange>;
export const zoomInRangesEffect = StateEffect.define<{ ranges: Array<{ from: number, to: number }> }>();
export const zoomInEffect = StateEffect.define<ZoomInRange>();

export const zoomOutEffect = StateEffect.define<void>();

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

				console.log(visibleRanges);

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
		}

		return value;
	},

	provide: (zoomStateField) => EditorView.decorations.from(zoomStateField),
});


export class KeepOnlyZoomedContentVisible {
	constructor() {
	}

	public getExtension(): Extension {
		return zoomStateField;
	}

	public calculateHiddenContentRanges(state: EditorState) {
		return rangeSetToArray(state.field(zoomStateField));
	}

	public calculateVisibleContentRange(state: EditorState) {
		const hidden = this.calculateHiddenContentRanges(state);

		if (hidden.length === 1) {
			const [a] = hidden;

			if (a.from === 0) {
				return {from: a.to + 1, to: state.doc.length};
			} else {
				return {from: 0, to: a.from - 1};
			}
		}

		if (hidden.length === 2) {
			const [a, b] = hidden;

			return {from: a.to + 1, to: b.from - 1};
		}

		return null;
	}

	public keepOnlyZoomedContentVisible(
		view: EditorView,
		from: number,
		to: number,
		options: { scrollIntoView?: boolean } = {}
	) {
		const {scrollIntoView} = {...{scrollIntoView: true}, ...options};

		const effect = zoomInEffect.of({from, to});

		view.dispatch({
			effects: [effect],
		});

		if (scrollIntoView) {
			view.dispatch({
				effects: [
					EditorView.scrollIntoView(view.state.selection.main, {
						y: "start",
					}),
				],
			});
		}
	}

	public keepRangesVisible(view: EditorView, ranges: ZoomInRange[]) {
		console.log(ranges);
		view.dispatch({
			effects: [zoomInRangesEffect.of({ranges})],
		});
	}

	public showAllContent(view: EditorView) {
		view.dispatch({effects: [zoomOutEffect.of()]});
		view.dispatch({
			effects: [
				EditorView.scrollIntoView(view.state.selection.main, {
					y: "center",
				}),
			],
		});
	}
}
