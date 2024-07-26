import {
	Decoration,
	type DecorationSet,
	EditorView,
	MatchDecorator,
	type PluginSpec,
	type PluginValue,
	ViewPlugin,
	ViewUpdate,
	WidgetType
} from "@codemirror/view";
import { editorInfoField, editorLivePreviewField, Keymap } from "obsidian";

interface DecoSpec {
	widget?: SectionLine;
}

class SectionLine extends WidgetType {
	error: boolean = false;

	constructor(
		public readonly view: EditorView,
		public readonly from: number,
		public readonly to: number,
		public readonly name: string
	) {
		super();

	}

	eq(widget: WidgetType): boolean {
		return (widget as SectionLine).from === this.from && (widget as SectionLine).to === this.to;
	}

	toDOM(): HTMLElement {
		const lineEl = createEl("div", {
			cls: "omd-section-line",
			text: this.name,
			attr: {
				dir: "ltr",
			}
		}, (el) => {

			el.createEl("hr", {
				attr: {
					'aria-label': 'Section ' + this.name,
				}
			});
		});

		lineEl.onclick = (e) => {
			if (Keymap.isModEvent(e)) {
				e.preventDefault();
				const app = this.view.state.field(editorInfoField).app;
				if (app) {
					app.workspace.trigger("zoom-into-section", this.view, this.to + 1);
					return;
				}
			}
		};

		return lineEl;
	}
}

export function createSectionLineRender() {
	class InlineViewPluginValue implements PluginValue {
		public readonly view: EditorView;
		private readonly match = new MatchDecorator({
			regexp: /^%%SECTION{([^}]+)}%%$|^<!--section: ([^-]+)-->$/g,
			decorate: (add, from: number, to: number, match: RegExpExecArray, view: EditorView) => {
				const shouldRender = this.shouldRender(view, from, to);
				try {
					if (shouldRender && from !== to) {
						add(
							from,
							to,
							Decoration.replace({
								widget: new SectionLine(view, from, to, match[1] || match[2]),
								// block: true,
							}),
						);
					}
				} catch (e) {
					console.error(e);
				}
			},
		});
		decorations: DecorationSet = Decoration.none;

		constructor(view: EditorView) {
			this.view = view;
			this.updateDecorations(view);
		}

		update(update: ViewUpdate): void {
			this.updateDecorations(update.view, update);
		}

		destroy(): void {
			this.decorations = Decoration.none;
		}

		updateDecorations(view: EditorView, update?: ViewUpdate) {
			if (!update || this.decorations.size === 0) {
				this.decorations = this.match.createDeco(view);
			} else {
				this.decorations = this.match.updateDeco(update, this.decorations);
			}
		}

		isLivePreview(state: EditorView["state"]): boolean {
			return state.field(editorLivePreviewField);
		}

		shouldRender(view: EditorView, decorationFrom: number, decorationTo: number) {
			// const hide = view.state.field(zoomStateField);
			// let shouldHide = true;
			// hide.between(decorationFrom, decorationTo, (from, to) => {
			// 	shouldHide = false;
			// });
			//
			// if (!shouldHide) {
			// 	return false;
			// }

			const overlap = view.state.selection.ranges.some((r) => {
				if (r.from <= decorationFrom) {
					return r.to >= decorationFrom;
				} else {
					return r.from <= decorationTo;
				}
			});
			return !overlap && this.isLivePreview(view.state);
		}
	}

	const InlineViewPluginSpec: PluginSpec<InlineViewPluginValue> = {
		decorations: (plugin) => {
			// Update and return decorations for the CodeMirror view

			return plugin.decorations.update({
				filter: (rangeFrom: number, rangeTo: number, deco: Decoration) => {
					const widget = (deco.spec as DecoSpec).widget;
					if (widget && widget.error) {
						console.log("GOT WIDGET ERROR");
						return false;
					}
					// Check if the range is collapsed (cursor position)
					return (
						rangeFrom === rangeTo ||
						// Check if there are no overlapping selection ranges
						!plugin.view.state.selection.ranges.filter((selectionRange: { from: number; to: number; }) => {
							// Determine the start and end positions of the selection range
							const selectionStart = selectionRange.from;
							const selectionEnd = selectionRange.to;

							// Check if the selection range overlaps with the specified range
							if (selectionStart <= rangeFrom) {
								return selectionEnd >= rangeFrom; // Overlapping condition
							} else {
								return selectionStart <= rangeTo; // Overlapping condition
							}
						}).length
					);
				},
			});
		},
	};

	return ViewPlugin.fromClass(InlineViewPluginValue, InlineViewPluginSpec);
}
