import type { EditorState, Extension } from "@codemirror/state";
import { rangeSetToArray } from "./utils";
import { EditorView } from "@codemirror/view";
import { zoomInEffect, type ZoomInRange, zoomInRangesEffect, zoomOutEffect, zoomStateField } from "./checkVisible";

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

	public hideRanges(view: EditorView, ranges: ZoomInRange[]) {

	}

	public keepRangesVisible(view: EditorView, ranges: ZoomInRange[]) {
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
