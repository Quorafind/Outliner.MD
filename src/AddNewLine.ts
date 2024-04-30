import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import {
	App,
	editorInfoField,
	ExtraButtonComponent,
	MarkdownFileInfo,
} from "obsidian";
import { getIndent } from "./utils";

export const AddNewLineBtn = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(value, tr) {
		const editor = tr.state.field(editorInfoField);

		const builder = new RangeSetBuilder<Decoration>();
		const firstLine = tr.state.doc.line(tr.state.doc.lines).to;

		builder.add(firstLine, firstLine, Decoration.widget({
			widget: new ButtonWidget(app, editor,
				firstLine, firstLine, tr.state), side: 2, block: true
		}));
		const dec = builder.finish();
		return dec;
	},
	provide: (f) => EditorView.decorations.from(f),
});


class ButtonWidget extends WidgetType {
	constructor(readonly app: App, readonly editor: MarkdownFileInfo, public from: number, public to: number, readonly state: EditorState) {
		super();
	}

	eq(other: ButtonWidget) {
		return true;
	}

	toDOM() {
		const button = createEl('div', {
			cls: 'cm-newline-button'
		});
		new ExtraButtonComponent(button).setIcon('plus').onClick(() => {
			const lastLine = this.editor.editor?.lastLine();
			const range = this.app.plugins.getPlugin('obsidian-zoom')?.getZoomRange(this.editor.editor);
			// const editor = this.app.workspace.activeEditor;
			// const range2 = getZoomRange(editor?.editor?.cm.viewState.state);
			// console.log(range, range2, this.app.workspace.activeEditor, getZoomRange(editor?.editor?.cm.state), editor?.editor?.cm.state.doc.toString());
			// console.log(range, this.editor.editor?.cm.state, this.editor.editor?.cm, this.editor);
			const indentNewLine = getIndent(this.app);
			if (range) {
				const firstLineInRange = range.from.line;
				const lastLineInRange = range.to.line;
				const spaceOnFirstLine = this.editor.editor?.getLine(firstLineInRange)?.match(/^\s*/)?.[0];
				const lastLineInRangeText = this.editor.editor?.getLine(lastLineInRange);

				this.editor.editor?.transaction({
					changes: [
						{
							text: `\n${spaceOnFirstLine}${indentNewLine}- `,
							from: {
								line: lastLineInRange,
								ch: lastLineInRangeText?.length || 0,
							}
						}
					],
					selection: {
						from: {
							line: lastLineInRange + 1,
							ch: 2 + (`${spaceOnFirstLine}${indentNewLine}`.length)
						},
						to: {
							line: lastLineInRange + 1,
							ch: 2 + (`${spaceOnFirstLine}${indentNewLine}`.length)
						}
					}
				});
				return;
			}

			if (lastLine === undefined) return;
			const lastLineText = this.editor.editor?.getLine(lastLine);

			this.editor.editor?.transaction({
				changes: [
					{
						text: '\n- ',
						from: {
							line: lastLine,
							ch: lastLineText?.length || 0,
						}
					}
				],
				selection: {
					from: {
						line: lastLine + 1,
						ch: 2
					},
					to: {
						line: lastLine + 1,
						ch: 2
					}
				}
			});
		});
		return button;
	}

	ignoreEvent(event: Event) {
		if (event.type === 'mousedown' || event.type === 'mouseup' || event.type === 'click') {
			event.preventDefault();
			this.editor.editor?.focus();
			return true;
		}
		return false;
	}
}




