import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, EditorView } from "@codemirror/view";

// code mirror effect that you will use to define the effect you want (the decoration)

export interface SearchHighlightRange {
	from: number;
	to: number;
}

export const SearchHighlightEffect = StateEffect.define<SearchHighlightRange>();
export const ClearSearchHighlightEffect = StateEffect.define<void>();

// define a new field that will be attached to your view state as an extension, update will be called at each editor's change
export const SearchHighlight = StateField.define({
	create() {
		return Decoration.none;
	},
	update(value, transaction) {
		value = value.map(transaction.changes);

		for (const effect of transaction.effects) {
			if (effect.is(ClearSearchHighlightEffect)) {
				value = Decoration.none;
			}

			if (effect.is(SearchHighlightEffect)) {
				value = value.update({
					add: [
						SearchHighlightDecoration.range(effect.value.from, effect.value.to)
					], sort: true
				});
			}
		}

		return value;
	},
	provide: f => EditorView.decorations.from(f)
});


export const SearchHighlightDecoration = Decoration.mark({
	// attributes: {style: "background-color: red"}
	class: 'outliner-highlight'
});
