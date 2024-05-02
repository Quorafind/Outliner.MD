import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, MatchDecorator, WidgetType } from "@codemirror/view";
import { App, editorInfoField, MarkdownFileInfo } from "obsidian";
import { OutlinerEmbedEditor } from "./OutlinerEmbedEditor";


export const BlockEmbedComponent = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(value, tr) {
		const editor = tr.state.field(editorInfoField);
		const app = editor.app;

		const builder = new RangeSetBuilder<Decoration>();
		const lastLineTo = tr.state.doc.line(tr.state.doc.lines).to;

		builder.add(lastLineTo, lastLineTo, Decoration.widget({
			widget: new BlockEmbedWidget(app, editor,
				lastLineTo, lastLineTo, tr.state), side: 3, block: true
		}));

		const matchDecorator = new MatchDecorator({
			regexp: /\+\[\[\]\]/g,
		});
		const dec = builder.finish();
		return dec;
	},
	provide: (f) => EditorView.decorations.from(f),
});


class BlockEmbedWidget extends WidgetType {
	constructor(readonly app: App, readonly editor: MarkdownFileInfo, public from: number, public to: number, readonly state: EditorState) {
		super();
	}

	eq(other: BlockEmbedWidget) {
		return true;
	}

	toDOM() {
		const blockEmbedEl = createEl('div', {
			cls: 'cm-task-group-container'
		});

		const groupComponent = new BlockEmbedEditor(this.app, blockEmbedEl);
		groupComponent.onload();
		return blockEmbedEl;
	}

	ignoreEvent(event: Event) {
		if (event.type === 'mousedown' || event.type === 'mouseup' || event.type === 'click') {
			event.preventDefault();
			return true;
		}
		return false;
	}
}
