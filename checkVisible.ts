import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";

export interface ZoomInRange {
	from: number;
	to: number;
}

export type ZoomInStateEffect = StateEffect<ZoomInRange>;

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
		}

		return value;
	},

	provide: (zoomStateField) => EditorView.decorations.from(zoomStateField),
});
