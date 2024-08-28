import {
	App,
	Component,
	Editor,
	editorEditorField,
	editorInfoField,
	EditorPosition,
	MarkdownRenderer,
	requireApiVersion,
	setIcon
} from "obsidian";
import OutlinerViewPlugin from "../../OutlinerViewIndex";
import { Decoration, type DecorationSet, EditorView, Rect, WidgetType } from "@codemirror/view";
import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import { foldable, syntaxTree, tokenClassNodeProp } from "@codemirror/language";
import "../../less/drag-n-drop.less";
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
		this.plugin.registerEditorExtension([DragNDropHandler]);
		this.createTargetLine();
		this.registerDragEvents();
		this.registerEditorEvents();
	}

	private registerDragEvents() {
		this.registerDomEvent(window, 'dragover', this.onDragOver.bind(this));
		this.registerDomEvent(window, 'dragend', this.onDragEnd.bind(this));
	}

	private registerEditorEvents() {
		this.plugin.registerEditorExtension(
			EditorView.domEventHandlers({
				mouseenter: this.handleEditorMouseEnter.bind(this),
				mouseleave: this.handleEditorMouseLeave.bind(this),
				dragover: this.handleEditorDragOver.bind(this),
				dragenter: this.handleEditorDragEnter.bind(this),
				drop: this.handleEditorDrop.bind(this)
			})
		);
	}

	private handleEditorMouseEnter(e: MouseEvent, editorView: EditorView) {
		this.currentEditorView = editorView;
	}

	private handleEditorMouseLeave(e: MouseEvent, editorView: EditorView) {
		this.hideTargetLine();
	}

	private handleEditorDragOver(e: DragEvent, editorView: EditorView) {
		if (!this.isDragging) return;

		this.currentEditorView = editorView;
		this.updateLineRects();

		const currentPos = this.currentEditorView.posAtCoords({x: e.clientX, y: e.clientY});
		if (!currentPos) return;

		const newLine = this.currentEditorView.state.doc.lineAt(currentPos).number;
		if (this.focusLine === newLine) return;

		this.focusLine = newLine;

		this.handleDragOverBoundaries(e);
		this.handleDragOverContent(e);
	}

	private updateLineRects() {
		if (!this.currentEditorView) return;
		this.firstLineRect = this.currentEditorView.coordsAtPos(0, 1);
		this.lastLineRect = this.currentEditorView.coordsAtPos(this.currentEditorView.state.doc.length, -1);
	}

	private handleDragOverBoundaries(e: DragEvent) {
		if (!this.currentEditorView) return;

		if (this.firstLineRect && e.clientY < this.firstLineRect.top) {
			this.moveTargetLine(this.currentEditorView.coordsAtPos(1, undefined), this.currentEditorView.contentDOM.innerWidth, false);
			return;
		}

		if (this.lastLineRect && e.clientY > this.lastLineRect.bottom) {
			this.moveTargetLine(this.lastLineRect, this.currentEditorView.contentDOM.innerWidth, true);
			return;
		}
	}

	private handleDragOverContent(e: DragEvent) {
		if (!this.currentEditorView) return;

		const linePos = this.currentEditorView.posAtCoords({x: e.clientX, y: e.clientY});
		if (!linePos) return;

		const lineStart = this.currentEditorView.state.doc.lineAt(linePos).from;

		if (linePos > this.prevFrom && linePos < this.prevTo) return;

		this.moveTargetLine(this.currentEditorView.coordsAtPos(lineStart, undefined), this.currentEditorView.contentDOM.innerWidth, false);
	}

	private handleEditorDragEnter(e: DragEvent, editorView: EditorView) {
		if (!this.isDragging) return;
		this.currentEditorView = editorView;
		this.isInsideEditor = true;
		this.targetLineEl?.show();
	}

	private handleEditorDrop(e: DragEvent, editorView: EditorView) {
		if (!this.isDragging) return;
		this.currentEditorView = editorView;
		this.handleDrop(e);
		this.cleanupDrag();
	}


	async handleDragStart(event: DragEvent, from: number, to: number, view: EditorState) {
		this.isDragging = true;

		const editorView = view.field(editorEditorField);
		this.currentEditorView = editorView;
		this.initEditorView = editorView;

		this.currentEditorView.focus();

		await this.createGhostElement(event, view, from, to);

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

	async createGhostElement(event: DragEvent, view: EditorState, from: number, to: number) {
		if (this.ghostEl) this.ghostEl.detach();

		const foldRange = this.calculateRangeForTransform(view, from);
		const line = view.doc.lineAt(from);

		if (!foldRange) {
			this.prevFrom = line.from;
			this.prevTo = line.to === view.doc.length ? line.to : (line.to < to ? to + 1 : line.to + 1);
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

		const contentEl = this.ghostEl.createEl("div", {cls: ["drag-ghost-content", "markdown-rendered"]});
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


		this.handleNormalDrop(editor, dropLinePos, targetLineNum, !notSameEditor);
		this.cleanupDrag();
	}

	handleCtrlDrop(editor: Editor, dropLinePos: number, targetLineNum: number, isSameEditor: boolean) {

	}

	handleAltDrop(editor: Editor, dropLinePos: number, targetLineNum: number, isSameEditor: boolean) {

	}

	handleNormalDrop(editor: Editor, dropLinePos: number, targetLineNum: number, isSameEditor: boolean) {
		if (!this.currentEditorView) return;
		const adjustedText = this.adjustIndentation(this.initContent, editor.getLine(targetLineNum));

		if (!isSameEditor) {
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
	}

	shouldReplaceToken(text: string): string | undefined {
		const beginWithTab = text.startsWith('\t');
		const beginWithSpace = text.startsWith(' ');
		if (!beginWithSpace && !beginWithTab) {
			return undefined;
		}
		return text.match(/^\s*/g)?.[0];
	}

	adjustIndentation(foldText: string, parentLine: string): string {
		const lines = foldText.split('\n');
		const tabSize = this.plugin.app.vault.getConfig("tabSize") as number;
		const useTab = this.plugin.app.vault.getConfig("useTab") as boolean;

		const getIndentLevel = (line: string): number => {
			const spaceMatch = line.match(/^ */)?.[0] ?? '';
			const tabMatch = line.match(/^\t*/)?.[0] ?? '';

			if (tabMatch.length > 0) {
				return tabMatch.length;
			} else {
				return Math.floor(spaceMatch.length / tabSize);
			}
		};

		const createIndent = (level: number): string => {
			if (useTab) {
				return '\t'.repeat(Math.max(0, level));
			} else {
				return ' '.repeat(Math.max(0, level * tabSize));
			}
		};

		const isMarkdownListItem = (line: string): boolean => {
			const trimmedLine = line.trim();
			return /^(\d+\.|-|\*)\s/.test(trimmedLine);
		};

		const parentIndentLevel = getIndentLevel(parentLine);
		const firstLineIndentLevel = getIndentLevel(lines[0]);

		const shouldIndent = parentLine.trim() !== "" &&
			(parentIndentLevel > 0 || isMarkdownListItem(parentLine.trim()));

		const targetIndentLevel = shouldIndent ? (parentIndentLevel + 1) : 0;

		const adjustLine = (line: string, index: number): string => {
			// 处理最后一个空行
			if (line.trim() === "" && (index === lines.length - 1)) {
				return line;
			}

			const currentIndentLevel = getIndentLevel(line);
			let newIndentLevel: number;

			if (index === 0) {
				newIndentLevel = targetIndentLevel;
			} else {
				const relativeIndentLevel = currentIndentLevel - firstLineIndentLevel;
				newIndentLevel = Math.max(0, targetIndentLevel + relativeIndentLevel);
			}

			return createIndent(newIndentLevel) + line;
		};

		return lines.map(adjustLine).join('\n');
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

const AVAILABLE_CLASS_LIST = ['hmd-callout', 'math', 'hmd-codeblock', 'quote'];

export const DragNDropHandler = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(value, tr) {
		const builder = new RangeSetBuilder<Decoration>();
		const field = tr.state.field(editorInfoField);

		let inSpecialBlock = false;
		let previousLineEnd = 0;
		let specialBlockStartLine = 0;
		let currentType: string[] = [];

		let isSpecialBlockStart = false;

		for (let i = 1; i <= tr.state.doc.lines; i++) {
			const line = tr.state.doc.line(i);
			const syntaxNode = syntaxTree(tr.state).resolveInner(line.from + 1);
			const nodeProps = syntaxNode.type.prop(tokenClassNodeProp)?.split(' ') ?? [];

			if (nodeProps.includes('hmd-frontmatter')) continue;
			if (isSpecialBlockStart) {
				isSpecialBlockStart = false;
			}

			if ((nodeProps.length === 0 || (currentType !== nodeProps && currentType.includes('hmd-codeblock') && !nodeProps.includes('hmd-codeblock')) || i === tr.state.doc.lines) && currentType.length > 0) {

				if (inSpecialBlock) {
					const blockStart = tr.state.doc.line(specialBlockStartLine).from;
					const widgetPosition = (currentType.includes('quote') || currentType.includes('hmd-codeblock')) && !currentType.includes('hmd-callout') ? blockStart : blockStart - 1;

					inSpecialBlock = false;

					builder.add(
						widgetPosition,
						widgetPosition,
						Decoration.widget({
							widget: new DragNDropHandlerWidget(field.app, tr.state, blockStart, line.to),
							side: -1,
							inlineOrder: true,
						})
					);
				}

				currentType = [];
			}

			if (!line.text.trim()) {
				previousLineEnd = line.to;
				continue;
			}

			const spacesLength = line.text.match(/^\s*/)![0].length;

			// 检查是否进入或离开特殊区块
			isSpecialBlockStart = AVAILABLE_CLASS_LIST.some(cls => nodeProps.includes(cls)) && !inSpecialBlock;

			console.log(isSpecialBlockStart, nodeProps);
			if (isSpecialBlockStart) {
				inSpecialBlock = true;
			} else if (inSpecialBlock && (!AVAILABLE_CLASS_LIST.some(cls => nodeProps.includes(cls)))) {
				inSpecialBlock = false;
			}

			if (inSpecialBlock && AVAILABLE_CLASS_LIST.some(cls => nodeProps.includes(cls)) && !isSpecialBlockStart) continue;

			let widgetPosition, side;

			if (isSpecialBlockStart) {
				specialBlockStartLine = i;
				// 对于特殊区块的第一行，使用前一行的结束位置
				widgetPosition = (currentType.includes('quote') || currentType.includes('hmd-codeblock')) ? line.from : previousLineEnd;
				side = -1;
			} else {
				widgetPosition = line.from + spacesLength;
				side = -1;
			}

			if (inSpecialBlock) {
				currentType = nodeProps;
				continue;
			}

			builder.add(
				widgetPosition,
				widgetPosition,
				Decoration.widget({
					widget: new DragNDropHandlerWidget(field.app, tr.state, widgetPosition, line.to),
					side: side,
					inlineOrder: true,
				})
			);

			previousLineEnd = line.to;
		}

		return builder.finish();
	},
	provide: (f) => EditorView.decorations.from(f),
});
