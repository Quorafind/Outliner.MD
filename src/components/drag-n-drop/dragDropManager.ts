import {
	App,
	Component, editorEditorField,
	editorInfoField,
	EditorPosition, ExtraButtonComponent,
	MarkdownRenderer, Menu, MenuItem, moment, Notice,
	requireApiVersion,
	setIcon
} from "obsidian";
import OutlinerViewPlugin from "../../OutlinerViewIndex";
import { Decoration, type DecorationSet, EditorView, Rect, WidgetType } from "@codemirror/view";
import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import { foldable } from "@codemirror/language";
import "../../less/drag-n-drop.less";
import { BulletMenu } from "../BulletMenu";
import { EmbeddableMarkdownEditor } from "../../editor-components/MarkdownEditor";
import { pluginInfoField, setPluginEffect } from "../../cm/pluginInfo";

interface FoldRange {
	from: number;
	to: number;
}

export class DragDropManager extends Component {
	private plugin: OutlinerViewPlugin;

	private dragHandlerEl: HTMLElement;

	private isInsideEditor: boolean;
	private selectionRange: FoldRange | null;
	private currentEditorView: EditorView | null;

	private ghostEl: HTMLElement | null = null;
	private targetLineEl: HTMLElement | null = null;
	private isDragging: boolean = false;

	private initEditorView: EditorView | null = null;
	private initContent: string = "";

	private prevFrom: number = 0;
	private prevTo: number = 0;
	private firstLineRect: Rect | null = null;
	private lastLineRect: Rect | null = null;

	private focusLine: number | null = null;

	constructor(plugin: OutlinerViewPlugin) {
		super();
		this.plugin = plugin;
	}

	onload() {
		super.onload();
		this.plugin.registerEditorExtension([DragNDropHandler, pluginInfoField.init((state) => ({plugin: this.plugin}))]);
		this.createTargetLine();
		this.registerDragEvents();

		this.plugin.registerEditorExtension(
			EditorView.domEventHandlers({
				mouseenter: (e: MouseEvent, editorView: EditorView) => {
					this.currentEditorView = editorView;
				},
				mouseleave: (e: MouseEvent, editorView: EditorView) => {
					this.hideTargetLine();
				},
				dragover: (e: DragEvent, editorView: EditorView) => {
					if (!this.isDragging) return;
					this.currentEditorView = editorView;
					this.firstLineRect = this.currentEditorView.coordsAtPos(0, 1);
					this.lastLineRect = this.currentEditorView.coordsAtPos(this.currentEditorView.state.doc.length, -1);

					const currentPos = this.currentEditorView.posAtCoords({x: e.clientX, y: e.clientY});
					if (!currentPos) return;
					const newLine = this.currentEditorView.state.doc.lineAt(currentPos).number;
					if (this.focusLine === newLine) return;

					this.focusLine = newLine;

					if (this.firstLineRect && e.clientY < this.firstLineRect?.top) {
						this.moveTargetLine(this.currentEditorView.coordsAtPos(1, undefined), this.currentEditorView.contentDOM.innerWidth, false);
						return;
					}

					if (this.lastLineRect && e.clientY > this.lastLineRect.bottom) {
						this.moveTargetLine(this.lastLineRect, this.currentEditorView.contentDOM.innerWidth, true);
						return;
					}

					// Calculate the current position of the mouse
					// If targetline is inside the selection range, hide it
					// Otherwise move the targetline to the nearest position
					const linePos = this.currentEditorView.posAtCoords({x: e.clientX, y: e.clientY});
					if (!linePos) return;
					const lineStart = this.currentEditorView.state.doc.lineAt(linePos).from;

					if (!linePos) return;
					if (linePos && linePos > this.prevFrom && linePos < this.prevTo) return;

					this.moveTargetLine(this.currentEditorView.coordsAtPos(lineStart, undefined), this.currentEditorView.contentDOM.innerWidth, false);
				},
				dragenter: (e: DragEvent, editorView: EditorView) => {
					console.log("drag enter");
					if (!this.isDragging) return;
					this.currentEditorView = editorView;
					this.isInsideEditor = true;
					this.targetLineEl?.show();
				},
				drop: (e: DragEvent, editorView: EditorView) => {
					if (!this.isDragging) return;

					this.currentEditorView = editorView;
					this.handleDrop(e);
					this.cleanupDrag();
				}
			})
		);
	}

	private registerDragEvents() {
		this.registerDomEvent(window, 'dragover', this.onDragOver.bind(this));
		this.registerDomEvent(window, 'dragend', this.onDragEnd.bind(this));
	}

	async handleDragStart(event: DragEvent, from: number, to: number, view: EditorState) {
		this.isDragging = true;

		const editorView = view.field(editorEditorField);
		this.currentEditorView = editorView;
		this.initEditorView = editorView;

		this.currentEditorView.focus();

		await this.createGhostElement(event, view, from);

		if (event.dataTransfer) {
			const emptyImage = document.createElement('div');
			emptyImage.style.display = 'none';
			document.body.appendChild(emptyImage);

			event.dataTransfer.setDragImage(emptyImage, 0, 0);

			setTimeout(() => {
				document.body.removeChild(emptyImage);
			}, 0);
		}
	}

	private onDragOver(event: DragEvent) {
		if (!this.isDragging) return;
		// Prevent default to allow drop
		event.preventDefault();

		// Update cursor style
		if (event.dataTransfer) event.dataTransfer.dropEffect = 'move';
		this.updateGhostPosition(event);
	}

	private onDragLeave(event: DragEvent) {
		if (!this.isDragging) return;

		if (event.clientY <= 0 || event.clientY >= window.innerHeight ||
			event.clientX <= 0 || event.clientX >= window.innerWidth) {
			this.hideTargetLine();
		}
	}

	private onDrop(event: DragEvent) {

		console.log("drop");
		if (!this.isDragging) return;

		this.handleDrop(event);
		this.cleanupDrag();
	}

	private onDragEnd() {
		console.log("drag end");
		if (!this.isDragging) return;
		this.cleanupDrag();
	}

	private cleanupDrag() {
		this.isDragging = false;

		if (this.ghostEl) {
			this.ghostEl.remove();
			this.ghostEl = null;
		}
		this.hideTargetLine();
	}

	hideTargetLine() {
		this.targetLineEl?.hide();

	}

	private isValidDragTarget(target: HTMLElement): boolean {
		return target.hasClass('cm-drag-handler-container');

	}

	createTargetLine() {
		if (this.targetLineEl) this.targetLineEl.detach();

		this.targetLineEl = (requireApiVersion("0.15.0") ? activeDocument : document)?.body.createEl("div", {cls: "drag-target-line"});
		this.targetLineEl.hide();
	}

	async createGhostElement(event: DragEvent, view: EditorState, from: number) {
		if (this.ghostEl) this.ghostEl.detach();

		const foldRange = this.calculateRangeForTransform(view, from);
		const line = view.doc.lineAt(from);

		if (!foldRange) {
			this.prevFrom = line.from;
			this.prevTo = line.to === view.doc.length ? line.to : line.to + 1;
		} else {
			this.prevFrom = foldRange.from;
			this.prevTo = foldRange.to === view.doc.length ? foldRange.to : foldRange.to + 1;
		}

		this.initContent = view.doc.sliceString(this.prevFrom, this.prevTo);

		this.isDragging = true;

		this.ghostEl = (requireApiVersion("0.15.0") ? activeDocument : document)?.body.createEl("div", {cls: "drag-ghost-element"});
		const iconEl = this.ghostEl.createEl("div", {cls: "drag-ghost-icon"});
		setIcon(iconEl, "grip-vertical");
		iconEl.style.float = "left";

		const contentEl = this.ghostEl.createEl("div", {cls: "drag-ghost-content"});
		contentEl.style.float = "right";

		await MarkdownRenderer.render(this.plugin.app, this.initContent.trim(), contentEl, "", this);
	}

	getEditorFromState(state: EditorState) {
		return state.field(editorInfoField).editor;
	}

	initDragManager(editorView: EditorView) {
		editorView.dispatch({
			effects: [
				setPluginEffect.of(this.plugin)
			]
		});
	}

	handleDrop(event: DragEvent) {
		if (!this.currentEditorView) return;
		event.preventDefault();

		const dropLineRect = this.targetLineEl?.getBoundingClientRect();
		if (!dropLineRect) return;

		const dropLinePos = this.currentEditorView.posAtCoords({x: dropLineRect.left, y: dropLineRect.top});

		if (dropLinePos === null) return;
		const editor = this.getEditorFromState(this.currentEditorView.state);
		const initEditor = this.getEditorFromState(this.initEditorView!.state);

		if (!editor || !initEditor) return;
		const notSameEditor = editor.getValue() !== initEditor.getValue();

		if (!editor) return;

		const dropLineText = this.currentEditorView.state.doc.lineAt(dropLinePos);
		let dropPos: EditorPosition = editor.offsetToPos(dropLinePos - 1);

		// If the drop position is near the selection range, do nothing.
		if (!notSameEditor && editor.offsetToPos(this.prevTo).line === editor.offsetToPos(dropLinePos).line) return;

		// If the number of rows put down is greater than the original number of rows,
		// then the original number of rows should be subtracted accordingly
		let targetLineNum = dropPos.line;
		if (!notSameEditor && editor.offsetToPos(this.prevFrom).line < editor.offsetToPos(dropLinePos).line) {
			const lineNum = editor.offsetToPos(this.prevTo).line - editor.offsetToPos(this.prevFrom).line + 1;
			dropPos = {
				line: dropPos.line - lineNum,
				ch: 0,
			};
			if (lineNum === 1) targetLineNum = dropPos.line;
			if (lineNum > 1) targetLineNum = dropPos.line + lineNum - 1;
		} else {
			targetLineNum = dropPos.line;
		}

		const bulletLineRegex = new RegExp("[\\t|\\s]+([-*+]|\\d+\\.)\\s");
		let adjustedText = this.initContent;

		if (bulletLineRegex.test(this.initContent)) adjustedText = this.adjustIndentation(this.initContent, editor.getLine(targetLineNum));
		// Move the lines to the drop position

		if (notSameEditor) {
			this.currentEditorView.dispatch({
				changes: {
					from: dropLinePos,
					to: dropLinePos,
					insert: adjustedText,
				}
			});

			if (this.initEditorView) {
				this.initEditorView.dispatch({
					changes: {
						from: this.prevFrom,
						to: this.prevTo,
						insert: "",
					}
				});
			}
		} else {

			this.currentEditorView.dispatch({
				changes: [{
					from: this.prevFrom,
					to: this.prevTo,
					insert: "",
				}, {
					from: dropLinePos,
					to: dropLinePos,
					insert: adjustedText,
				}]
			});
		}


		this.cleanupDrag();
	}

	shouldReplaceToken(text: string): string | undefined {
		const beginWithTab = text.startsWith('\t');
		const beginWithSpace = text.startsWith(' ');
		if (!beginWithSpace && !beginWithTab) {
			return undefined;
		}
		return text.match(/^\s*/g)?.[0];
	}

	adjustIndentation(foldText: string, parentLine: string) {
		const textArray = foldText.split('\n');
		const tabSize = this.plugin.app.vault.getConfig("tabSize");
		let level: number;
		let isBullet: boolean = false;

		const bulletLineRegex = new RegExp("^([\\t|\\s]+)?([-*+]|\\d+\\.)\\s");
		if (!bulletLineRegex.test(parentLine)) level = 0;
		else {
			isBullet = true;
			const indent = parentLine.match(/^\s*/g)?.[0];
			if (!indent) level = 0;
			else if (!indent.length) level = 0;
			else level = indent.length / tabSize;
		}

		const firstLine = textArray[0];
		if (!firstLine) return foldText;
		const firstLineIndent = this.shouldReplaceToken(firstLine);
		if (!firstLineIndent) return foldText;
		const firstLineIndentLevel = firstLineIndent.length / tabSize;

		let indentRegex;
		let adjustedText: string = "";
		if (firstLineIndentLevel <= level) {
			return foldText;
		}

		if (level === 0) {
			indentRegex = isBullet ? new RegExp(`^[\\t|\\s]{${(firstLineIndentLevel - 1) * tabSize}}`) : new RegExp(`^[\\t|\\s]{${firstLineIndentLevel * tabSize}}`);
			for (let i = 0; i < textArray.length; i++) {
				if (i === textArray.length - 1) adjustedText += textArray[i].replace(indentRegex, "");
				else adjustedText += textArray[i].replace(indentRegex, "") + "\n";
			}
			return adjustedText;
		} else {
			let levelDiff = firstLineIndentLevel - level;
			if ((firstLineIndentLevel - level) >= 1 && isBullet) {
				levelDiff = levelDiff - 1;
			}

			indentRegex = new RegExp(`^[\\t|\\s]{${(levelDiff) * tabSize}}`);
			for (let i = 0; i < textArray.length; i++) {
				if (i === textArray.length - 1) adjustedText += textArray[i].replace(indentRegex, "");
				else adjustedText += textArray[i].replace(indentRegex, "") + "\n";
			}
			return adjustedText;
		}
	}

	moveTargetLine(domRect: any, width: number, bottom?: boolean) {
		if (!domRect || !width || !this.isDragging) return;

		const left = domRect.left;
		const top = bottom ? (domRect.top + domRect.height) : domRect.top;

		if (!this.targetLineEl) return;

		this.targetLineEl.style.width = width + "px";
		this.targetLineEl.style.transform = `translate(${left}px, ${top}px)`;
		this.targetLineEl.style.display = 'block';
	}

	updateGhostPosition(event: DragEvent) {
		if (!this.ghostEl) return;
		if (!this.isDragging) return;

		this.ghostEl.style.transform = `translate(${event.clientX - 12}px, ${event.clientY - 12}px)`;
	}

	calculateRangeForTransform(state: EditorState, pos: number) {
		const line = state.doc.lineAt(pos);
		const foldRange = foldable(state, line.from, line.to);

		if (!foldRange) {
			return null;
		}

		return {from: line.from, to: foldRange.to};
	}

	onunload() {
		if (this.dragHandlerEl) this.dragHandlerEl.detach();
		if (this.targetLineEl) this.targetLineEl.detach();
	}
}


class DragNDropHandlerWidget extends WidgetType {
	dragHandlerContainerEl: HTMLSpanElement | undefined;
	plugin: OutlinerViewPlugin | undefined;

	dragManager: DragDropManager;

	constructor(
		readonly app: App,
		readonly view: EditorState,
		readonly from: number,
		readonly to: number,
	) {
		super();

		if (view.field(pluginInfoField)?.plugin) {
			this.plugin = view.field(pluginInfoField)?.plugin;
		}
	}

	eq(other: DragNDropHandlerWidget) {
		return other.from === this.from && other.to === this.to && other.view === this.view;
	}

	toDOM() {
		this.dragHandlerContainerEl = createEl('span', {
			cls: 'cm-drag-handler-container',
			attr: {
				draggable: 'true'
			}
		});

		this.dragHandlerContainerEl.createEl('span', {
			cls: 'clickable-icon',
		}, (o) => {
			setIcon(o, 'grip-vertical');
		});

		// const button = new ExtraButtonComponent(this.dragHandlerContainerEl).setIcon('grip-vertical');
		if (!this.plugin) return this.dragHandlerContainerEl;

		this.plugin.registerDomEvent(this.dragHandlerContainerEl, 'dragstart', (e: DragEvent) => {
			if (this.plugin && this.plugin.dragDropManager) {
				this.plugin.dragDropManager.handleDragStart(e, this.from, this.to, this.view);
			}
		});

		return this.dragHandlerContainerEl;
	}
}

export const DragNDropHandler = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(value, tr) {
		const builder = new RangeSetBuilder<Decoration>();

		const field = tr.state.field(editorInfoField);

		for (let i = 1; i <= tr.state.doc.lines; i++) {
			const line = tr.state.doc.line(i);
			// if (!(/^(-|\*|\d+\.)(\s(\[.\]))?/g.test(line.text.trimStart()))) continue;
			if (!line.text.trim()) continue;
			const spacesLength = line.text.match(/^\s*/)![0].length; // 使用 \s* 匹配所有空白字符，包括空格和制表符

			if (spacesLength > 0) {
				// 如果存在空格或缩进，将 widget 添加在这些空格之后
				builder.add(line.from + spacesLength, line.from + spacesLength, Decoration.widget({
					widget: new DragNDropHandlerWidget(field.app, tr.state, line.from + spacesLength, line.from + spacesLength),
					side: -1
				}));
			} else {
				// 如果没有空格或缩进，将 widget 添加在行的开始
				builder.add(line.from, line.from, Decoration.widget({
					widget: new DragNDropHandlerWidget(field.app, tr.state, line.from, line.from),
					side: -1
				}));
			}
		}
		const dec = builder.finish();
		return dec;
	},
	provide: (f) => EditorView.decorations.from(f),
});
