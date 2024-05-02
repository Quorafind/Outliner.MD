import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { RangeSetBuilder, StateField } from "@codemirror/state";
import { editorInfoField } from "obsidian";

const blankBulletLine = Decoration.mark({
	attributes: {class: 'cm-blank-bullet-line'},
	// class: 'cm-blank-bullet-line',
});

export const bulletBulletLineWidget = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(value, tr) {
		const builder = new RangeSetBuilder<Decoration>();
		// const wholeDoc = tr.state.doc.toString();
		for (let i = 1; i <= tr.state.doc.lines; i++) {
			const line = tr.state.doc.line(i);
			if (/^(-|\*|(\d{1,}\.))(\s(\[.\]))?$/g.test(line.text.trim())) {
				builder.add(line.from, line.to, blankBulletLine);
			}
		}

		// if (wholeDoc?.length == 0) builder.add(firstLine.from, firstLine.from, placeholderLine);
		const dec = builder.finish();
		return dec;
	},
	provide: (f) => EditorView.decorations.from(f),
});
