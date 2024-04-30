import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { App, editorInfoField, ExtraButtonComponent, MarkdownFileInfo } from "obsidian";
import { getIndent } from "./utils";
import { getAPI } from "obsidian-dataview";
import { OutlinerEmbedEditor } from "./OutlinerEmbedEditor";
import OutlinerViewPlugin from "./main";

export const TaskGroupComponent = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(value, tr) {
		const editor = tr.state.field(editorInfoField);
		const app = editor.app;

		const builder = new RangeSetBuilder<Decoration>();
		const lastLineTo = tr.state.doc.line(tr.state.doc.lines).to;

		builder.add(lastLineTo, lastLineTo, Decoration.widget({
			widget: new TaskGroupWidget(app, editor,
				lastLineTo, lastLineTo, tr.state), side: 3, block: true
		}));
		const dec = builder.finish();
		return dec;
	},
	provide: (f) => EditorView.decorations.from(f),
});


class TaskGroupWidget extends WidgetType {
	constructor(readonly app: App, readonly editor: MarkdownFileInfo, public from: number, public to: number, readonly state: EditorState) {
		super();
	}

	eq(other: TaskGroupWidget) {
		return true;
	}

	toDOM() {
		const taskContainer = createEl('div', {
			cls: 'cm-task-group-container'
		});
		const marginSpan = taskContainer.createEl('span', {
			cls: 'cm-task-group-margin'
		});
		const span = taskContainer.createEl('span', {
			cls: 'cm-task-group'
		});

		const titleEl = span.createEl('span', {
			cls: 'cm-task-group-title',
			text: '📜 Task Group'
		});

		const groupComponent = new OutlinerEmbedEditor(this.app, span);
		groupComponent.onload();
		return taskContainer;
	}

	ignoreEvent(event: Event) {
		if (event.type === 'mousedown' || event.type === 'mouseup' || event.type === 'click') {
			event.preventDefault();
			return true;
		}
		return false;
	}
}
