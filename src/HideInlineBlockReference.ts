import { Decoration, DecorationSet, EditorView } from "@codemirror/view";
import { RangeSetBuilder, StateField } from "@codemirror/state";

const markBulletHidden = Decoration.replace({block: true});

const hiddenRegex = /^(\s*)?((-|\*|(\d{1,}\.))(\s(\[.\]))?(\s*)?(!\[\[(.*)\]\]))/g;

export function hideInlineBlockReference() {
	// return ViewPlugin.fromClass(
	// 	class {
	// 		decorations: DecorationSet = Decoration.none;
	// 		decorator: MatchDecorator;
	//
	// 		constructor(public view: EditorView) {
	// 			this.decorator = new MatchDecorator({
	// 				regexp: /^(\s*)?((-|\*|(\d{1,}\.))(\s(\[.\]))?(\s*)?(\!\[\[(.*)\]\]))/g,
	// 				decoration: this.getDeco.bind(this),
	// 			});
	// 			this.decorations = this.decorator.createDeco(view);
	// 		}
	//
	// 		getDeco(match: RegExpExecArray, _view: EditorView, pos: number) {
	// 			console.log('match', match, pos);
	//
	// 			console.log(_view.state.doc.sliceString(pos + (match[1] || "").length, pos + (match[1] || "").length + match[2].length));
	//
	// 			const from = pos + (match[1] || "").length;
	// 			const to = pos + (match[1] || "").length + match[2].length;
	//
	// 			return markBulletHidden.range(from, to);
	// 		}
	//
	// 		update(update: ViewUpdate) {
	// 			if (!update.state.field(editorLivePreviewField)) {
	// 				this.decorations = Decoration.none;
	// 				return;
	// 			}
	//
	// 			this.decorations = this.decorator.updateDeco(update, this.decorations);
	// 		}
	// 	},
	// 	{
	// 		decorations: (v) => v.decorations,
	// 		provide: plugin => EditorView.atomicRanges.of(view => {
	// 			return view.plugin(plugin)?.decorations || Decoration.none;
	// 		})
	// 	}
	// );
	return StateField.define<DecorationSet>({
		create: () => {
			return Decoration.none;
		},

		update: (value, tr) => {
			const builder = new RangeSetBuilder<Decoration>();

			for (let i = 1; i <= tr.state.doc.lines; i++) {
				const line = tr.state.doc.line(i);

				const match = hiddenRegex.exec(line.text);
				if (match) {
					const from = line.from + (match[1] || "").length + 1;
					const to = line.from + (match[1] || "").length + match[2].length;
					builder.add(from, to, markBulletHidden);
				}
			}

			const dec = builder.finish();
			return dec;
		},

		provide: (zoomStateField) => EditorView.decorations.from(zoomStateField),
	});
}
