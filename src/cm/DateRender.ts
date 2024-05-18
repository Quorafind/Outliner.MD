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
import { editorLivePreviewField } from "obsidian";
import DatePicker from "../ui/DatePicker.svelte";

interface DecoSpec {
	widget?: DateRenderWidget;
}

class DateRenderWidget extends WidgetType {
	error: boolean = false;
	component: DatePicker;

	constructor(
		public readonly view: EditorView,
		public readonly date: string,
		public readonly from: number,
		public readonly to: number,
		public readonly type: 'date' | 'time'
	) {
		super();
  
	}

	eq(widget: WidgetType): boolean {
		return (widget as DateRenderWidget).date === this.date && (widget as DateRenderWidget).from === this.from && (widget as DateRenderWidget).to === this.to;
	}

	toDOM(): HTMLElement {
		const el = createEl("span", {
			cls: 'cm-date-button-container',
		});

		this.component = new DatePicker({
			target: el, props: {
				date: this.date,
				type: this.type,
			}
		});

		// this.component = new DatePicker({
		// 	target: el, props: {}
		// });
		this.component.$on('select', (e: any) => {
			const {value} = e.detail;
			if (!value) return;

			this.view.dispatch({
				changes: {from: this.from, to: this.to, insert: value},
			});
		});

		return el;
	}
}

export function createDateRendererPlugin() {
	class InlineViewPluginValue implements PluginValue {
		public readonly view: EditorView;
		private readonly match = new MatchDecorator({
			regexp: /\b((?<date>\d{4}-\d{2}-\d{2})|(?<time>\d{2}:\d{2}(:\d{2})?))\b/g,
			decorate: (add, from: number, to: number, match: RegExpExecArray, view: EditorView) => {
				const shouldRender = this.shouldRender(view, from, to);
				try {
					if (shouldRender && from !== to) {
						if (match.groups?.date) {
							add(
								from,
								to,
								Decoration.replace({
									widget: new DateRenderWidget(view, match[1], from, to, 'date'),
								}),
							);
						} else if (match.groups?.time) {
							add(
								from,
								to,
								Decoration.replace({
									widget: new DateRenderWidget(view, match[1]?.length === 5 ? (match[1] + ':00') : match[1], from, to, 'time'),
								}),
							);
						}
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
