import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { StateEffect, StateField } from "@codemirror/state";
import { ExtraButtonComponent } from "obsidian";

export interface ZoomInRange {
	from: number;
	to: number;
	type?: 'part' | 'block' | 'whole' | 'heading';
	container?: HTMLElement;
}

export type ZoomInStateEffect = StateEffect<ZoomInRange>;
export const zoomInRangesEffect = StateEffect.define<{ ranges: Array<{ from: number, to: number }> }>();

export const hideRangesEffect = StateEffect.define<{ ranges: Array<{ from: number, to: number }> }>();
export const zoomInEffect = StateEffect.define<ZoomInRange>();

export const zoomOutEffect = StateEffect.define<void>();

export const zoomWithHideIndentEffect = StateEffect.define<{ range: { from: number, to: number }, indent: string }>();

export const hideFrontMatterEffect = StateEffect.define<{ range: { from: number, to: number } }>();

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function isZoomInEffect(e: StateEffect<any>): e is ZoomInStateEffect {
	return e.is(zoomInEffect);
}

const zoomMarkHidden = Decoration.replace({block: true});

export class EditWidget extends WidgetType {
	constructor(
		// public readonly container: HTMLElement,
		public readonly from: number,
		public readonly to: number,
	) {
		super();
	}

	eq(widget: WidgetType): boolean {
		return (widget as EditWidget).from === this.from && (widget as EditWidget).to === this.to;
	}

	toDOM(): HTMLElement {
		const el = createEl("span", {
			cls: 'cm-edit-button-container',
		});
		new ExtraButtonComponent(el).setIcon('pencil').onClick(() => {
			const embeddedContainer = el.closest('.internal-embed.is-loaded');

			// @ts-ignore
			if (embeddedContainer && embeddedContainer.cmView) {
				// @ts-ignore
				const widget = embeddedContainer.cmView.widget;

				(widget.editor as any).cm.focus();
				(widget.editor as any).cm.dispatch({
					selection: {
						head: widget.start,
						anchor: widget.end,
					},
					scrollIntoView: true
				});
				// ((widget.editor as any).editor as Editor).transaction({
				// 	selection: {
				// 		from: widget.start,
				// 		to: widget.end,
				// 	}
				// })
			}
			// console.log(embeddedContainer?.to);
		});

		return el;
	}
}

export const zoomStateField = StateField.define<DecorationSet>({
	create: () => {
		return Decoration.none;
	},

	update: (value, tr) => {
		// for (let i = 0; i < value.size; i++) {
		// 	const decoration = value.iter().value;
		// 	console.log(decoration);
		// }


		value = value.map(tr.changes);


		for (const e of tr.effects) {


			if (e.is(zoomInEffect)) {
				value = value.update({filter: () => false});


				// if(e.value.type === 'part') {
				// 	value = value.update({
				// 		add: [Decoration.mark({class: 'zoom-in-range'}).range(e.value.from - 1, e.value.to + 1)]
				// 	})
				// }


				if (e.value.type === 'part' && e.value.container) {
					value = value.update({
						add: [Decoration.widget({
							widget: new EditWidget(e.value.to + 1, e.value.to + 1),
							side: 1,
						}).range(
							e.value.to + 1,
							e.value.to + 1
						)]
					});
				}

				if (e.value.from > 0) {
					value = value.update({
						add: [e.value.type === 'part' ? Decoration.replace({
							block: true,
							inclusiveEnd: false,
						}).range(0, e.value.from - 1) : zoomMarkHidden.range(0, e.value.from - 1)],
					});
				}

				if (e.value.to < tr.newDoc.length) {
					value = value.update({
						add: [e.value.type === 'part' ? Decoration.replace({
							block: true,
							inclusiveStart: false,
						}).range(e.value.to + 1, tr.newDoc.length) : zoomMarkHidden.range(e.value.to + 1, tr.newDoc.length)],
					});
				}


			}

			if (e.is(hideRangesEffect)) {
				value = value.update({filter: () => false});


				// let totalLength = tr.state.doc.length;

				e.value.ranges.forEach(range => {
					value = value.update({
						add: [zoomMarkHidden.range(range.from, range.to)]
					});
				});
			}

			if (e.is(zoomOutEffect)) {
				value = value.update({filter: () => false});
			}

			if (e.is(zoomInRangesEffect)) {
				value = value.update({filter: () => false});

				const totalLength = tr.state.doc.length;
				const visibleRanges = e.value.ranges;
				visibleRanges.sort((a, b) => a.from - b.from);
				const hiddenRanges: {
					from: number;
					to: number;
				}[] = [];
				let lastVisibleEnd = 0;

				visibleRanges.forEach(range => {
					if (range.from > lastVisibleEnd + 1) {
						// If there is a gap between the last visible range and the current range,
						// that gap is a hidden range
						hiddenRanges.push({from: lastVisibleEnd, to: range.from});
					}
					// Update the end of the last visible range
					lastVisibleEnd = Math.max(lastVisibleEnd, range.to);
				});

				if (lastVisibleEnd < totalLength) {
					hiddenRanges.push({from: lastVisibleEnd, to: totalLength});
				}

				hiddenRanges.forEach((range) => {
					value = value.update({
						add: [zoomMarkHidden.range(range.from === 0 ? range.from : range.from + 1, range.to === totalLength ? range.to : range.to - 1)],
					});
				});
			}

			if (e.is(zoomWithHideIndentEffect)) {
				// value = value.update({filter: () => false});
				const {range, indent} = e.value;

				const firstLine = tr.state.doc.lineAt(range.from);
				const lastLine = tr.state.doc.lineAt(range.to);

				for (let i = firstLine.number; i <= lastLine.number; i++) {
					const line = tr.state.doc.line(i);
					value = value.update({
						add: [zoomMarkHidden.range(line.from, line.from + indent.length)]
					});
				}
			}

			if (e.is(hideFrontMatterEffect)) {
				value = value.update({filter: () => false});
				const {range} = e.value;
				value = value.update({
					add: [zoomMarkHidden.range(range.from, range.to)]
				});
			}
		}

		return value;
	},

	provide: (zoomStateField) => EditorView.decorations.from(zoomStateField),
});


