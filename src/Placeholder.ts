import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { RangeSetBuilder, StateField } from "@codemirror/state";


// const placeholderLine = Decoration.line({
// 	attributes: {'data-ph': `Type "/" for commands`},
// 	class: 'outliner-editor-placeholder',
// });

class PlaceholderWidget extends WidgetType {
	constructor(public from: number, public to: number) {
		super();
	}

	eq(other: PlaceholderWidget) {
		return true;
	}

	toDOM() {
		const div = createEl('div', {
			cls: 'cm-placeholder',
			attr: {'data-ph': `Type "/" for commands`},
		});
		return div;
	}
}

export const placeholder = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(value, tr) {
		// const editor = tr.state.field(editorInfoField);
		const builder = new RangeSetBuilder<Decoration>();
		const cursor = tr.state.selection.main.head;
		const lineAtCursor = tr.state.doc.lineAt(cursor);
		const spaceBeforeBullet = lineAtCursor.text?.match(/^\s*/)?.[0] || '';

		if (lineAtCursor.text?.trim() === '-') builder.add(lineAtCursor.from + spaceBeforeBullet?.length + 2, lineAtCursor.from + spaceBeforeBullet?.length + 2, Decoration.widget({
			widget: new PlaceholderWidget(lineAtCursor.from + spaceBeforeBullet?.length + 2, lineAtCursor.from + spaceBeforeBullet?.length + 2),
			side: 0,
		}));
		const dec = builder.finish();
		return dec;
	},
	provide: (f) => EditorView.decorations.from(f),
});
