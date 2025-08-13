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

		private dropAsChild: boolean = false;
		private static readonly INDENT_STEP_PX: number = 24;


	constructor(plugin: OutlinerViewPlugin) {
		super();
		this.plugin = plugin;
	}

	onload() {
		super.onload();
		this.plugin.registerEditorExtension([DragNDropHandler, this.registerEditorEvents()]);
		this.createTargetLine();
		this.registerDragEvents();
	}

	private registerDragEvents() {
		this.plugin.registerDomEvent(window, 'dragover', this.onDragOver.bind(this));
		this.plugin.registerDomEvent(window, 'dragend', this.onDragEnd.bind(this));
	}

	private registerEditorEvents() {
		return EditorView.domEventHandlers({
			mouseenter: this.handleEditorMouseEnter.bind(this),
			mouseleave: this.handleEditorMouseLeave.bind(this),
			dragover: this.handleEditorDragOver.bind(this),
			dragenter: this.handleEditorDragEnter.bind(this),
			drop: this.handleEditorDrop.bind(this)
		});
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

		const editorRect = this.currentEditorView.dom.getBoundingClientRect();
		const lastLineDomInfo = this.getLastLineDomInfo();
		const relativeY = e.clientY - editorRect.top;

		if (relativeY <= 5) {
			this.handleFirstLineDragOver(editorRect);
		} else if (lastLineDomInfo && relativeY >= lastLineDomInfo.rect.bottom - editorRect.top - 5) {
			this.handleLastLineDragOver(editorRect, lastLineDomInfo);
		} else {
			this.handleMiddleLineDragOver(e);
		}
	}

	private getLastLineDomInfo() {
		if (!this.currentEditorView) return null;

		const doc = this.currentEditorView.state.doc;
		const lastPos = doc.length;
		const domInfo = this.currentEditorView.domAtPos(lastPos);
		const lastLineEl = domInfo.node.nodeType === Node.TEXT_NODE
			? domInfo.node.parentElement
			: domInfo.node;

		if (!lastLineEl || !(lastLineEl instanceof Element)) return null;

		const rect = lastLineEl.getBoundingClientRect();

		return {element: lastLineEl, rect};
	}

	private updateLineRects() {
		if (!this.currentEditorView) return;
		this.firstLineRect = this.currentEditorView.coordsAtPos(0);
		const lastLinePos = this.currentEditorView.state.doc.length - 1;
		this.lastLineRect = this.currentEditorView.coordsAtPos(lastLinePos);
	}

	private handleFirstLineDragOver(editorRect: DOMRect) {
		const firstLineStart = this.currentEditorView!.state.doc.line(1).from;
		const firstLineRect = this.currentEditorView!.coordsAtPos(firstLineStart);
		if (firstLineRect) {
			this.moveTargetLine(
				{top: editorRect.top, left: firstLineRect.left, height: 0},
				this.currentEditorView!.contentDOM.clientWidth,
				false
			);
		}
	}

	private handleLastLineDragOver(editorRect: DOMRect, lastLineDomInfo: { element: Element, rect: DOMRect }) {
		const {rect} = lastLineDomInfo;
		const editorContent = this.currentEditorView!.contentDOM;

		const left = rect.left; // 使用内容区域的左边界
		const top = rect.bottom; // 确保不超过内容区域

		this.moveTargetLine(
			{top, left, height: rect.height},
			editorContent.clientWidth,
			true
		);
	}

	private handleMiddleLineDragOver(e: DragEvent) {
		const pos = this.currentEditorView!.posAtCoords({x: e.clientX, y: e.clientY});
		if (pos === null) return;

		const line = this.currentEditorView!.state.doc.lineAt(pos);
		const lineStart = line.from;

		// 决定是兄弟还是子节点：以“去掉空白缩进后的内容起点”为基准
		const lineText = line.text;
		const spacesLength = (lineText.match(/^\s*/)?.[0] ?? '').length;
		const contentStartPos = lineStart + spacesLength;
		const contentStartRect = this.currentEditorView!.coordsAtPos(contentStartPos);
		if (!contentStartRect) return;
		const contentLeft = contentStartRect.left;
		this.dropAsChild = e.clientX - contentLeft > DragDropManager.INDENT_STEP_PX;

		if (pos > this.prevFrom && pos < this.prevTo) {
			this.hideTargetLine();
		} else {
			this.moveTargetLine(contentStartRect, this.currentEditorView!.contentDOM.clientWidth, false);
		}
	}

	private handleDragOverPosition(e: DragEvent, currentPos: number) {
		if (!this.currentEditorView) return;

		const doc = this.currentEditorView.state.doc;
		const isBeforeFirstLine = currentPos === 0;
		const isAfterLastLine = currentPos === doc.length;

		if (isBeforeFirstLine && this.firstLineRect) {
			this.moveTargetLine(this.firstLineRect, this.currentEditorView.contentDOM.clientWidth, false);
		} else if (isAfterLastLine && this.lastLineRect) {
			this.moveTargetLine(this.lastLineRect, this.currentEditorView.contentDOM.clientWidth, true);
		} else {
			const line = doc.lineAt(currentPos);
			const lineStart = line.from;

			if (currentPos > this.prevFrom && currentPos < this.prevTo) {
				this.hideTargetLine();
			} else {
				this.moveTargetLine(this.currentEditorView.coordsAtPos(lineStart) as Rect, this.currentEditorView.contentDOM.clientWidth, false);
			}
		}
	}

	private moveTargetLine(rect: { top: number, left: number, height?: number }, width: number, bottom: boolean) {
		if (!rect || !width || !this.isDragging || !this.targetLineEl) return;

		let left = rect.left;
		const top = bottom ? rect.top : rect.top - 2;

		// 根据 dropAsChild 偏移指示线，给出“子节点/兄弟节点”的视觉提示
		if (this.dropAsChild) {
			left += DragDropManager.INDENT_STEP_PX;
			this.targetLineEl.addClass('as-child');
		} else {
			this.targetLineEl.removeClass('as-child');
		}

		this.targetLineEl.style.width = `${width}px`;
		this.targetLineEl.style.transform = `translate(${left}px, ${top}px)`;
		this.targetLineEl.style.display = 'block';
	}

	private handleEditorDragEnter(e: DragEvent, editorView: EditorView) {
		if (!this.isDragging) return;
		this.currentEditorView = editorView;
		this.isInsideEditor = true;
		this.dropAsChild = false;
		this.targetLineEl?.show();
	}

	private handleEditorDrop(e: DragEvent, editorView: EditorView) {
		if (!this.isDragging) return;
		this.currentEditorView = editorView;
		this.handleDrop(e);
		this.cleanupDrag();
	}


	async handleDragStart(event: DragEvent, from: number, to: number, view: EditorState) {
		event.stopPropagation();

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
		this.dropAsChild = false;
		this.targetLineEl?.removeClass('as-child');
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

		const dropLinePos = this.currentEditorView.posAtCoords({x: dropLineRect.left, y: dropLineRect.bottom});

		if (dropLinePos === null) return;
		const editor = this.getEditorFromState(this.currentEditorView.state);
		const initEditor = this.getEditorFromState(this.initEditorView!.state);

		if (!editor || !initEditor) return;
		// Determine whether drop happens in the same EditorView instance
		const isSameEditorView = this.currentEditorView === this.initEditorView;

		let dropPos: EditorPosition = editor.offsetToPos(dropLinePos - 1);

		// If the drop position is inside the original selection in the same editor, do nothing to avoid no-op/duplication
		if (isSameEditorView && dropLinePos >= this.prevFrom && dropLinePos <= this.prevTo) return;
		// Additionally, if it's the same line as selection end, treat as no-op (legacy behavior)
		if (isSameEditorView && editor.offsetToPos(this.prevTo).line === editor.offsetToPos(dropLinePos).line) return;

		// If dropping below the original selection in the same editor, adjust for removed lines
		let targetLineNum = dropPos.line;
		if (isSameEditorView && editor.offsetToPos(this.prevFrom).line < editor.offsetToPos(dropLinePos).line) {
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

		// Use original dropLinePos for insertion; when applying multiple changes in one transaction,
		// positions are interpreted in the original document coordinates.
		this.handleNormalDrop(editor, dropLinePos, targetLineNum, isSameEditorView);
		this.cleanupDrag();
	}

	handleCtrlDrop(editor: Editor, dropLinePos: number, targetLineNum: number, isSameEditor: boolean) {

	}

	handleAltDrop(editor: Editor, dropLinePos: number, targetLineNum: number, isSameEditor: boolean) {

	}

	handleNormalDrop(editor: Editor, insertOffset: number, targetLineNum: number, isSameEditor: boolean) {
		if (!this.currentEditorView) return;
		let adjustedText = this.adjustIndentation(this.initContent, editor.getLine(targetLineNum));

		// Determine if we need to add newlines (不再在 adjustedText 内添加/去除额外换行)
		let insertPrefix = '';
		let insertSuffix = '';

		// If not dropping at the start of a line, add a newline suffix (把拖拽块与当前行断开)
		if (insertOffset > editor.posToOffset({
			line: targetLineNum,
			ch: 0
		}) && insertOffset !== editor.getValue().length) {
			insertSuffix = '\n';
		}

		// If not dropping at the end of a line, add a newline prefix（把插入块置于独立行）
		if ((insertOffset < editor.posToOffset({
			line: targetLineNum,
			ch: editor.getLine(targetLineNum).length
		})) || insertOffset === editor.getValue().length) {
			insertPrefix = '\n';
		}

		// Combine the adjusted text with necessary newlines
		const finalInsertText = insertPrefix + adjustedText + insertSuffix;

		if (!isSameEditor) {
			this.currentEditorView.dispatch({
				changes: {
					from: insertOffset,
					to: insertOffset,
					insert: finalInsertText,
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
					from: insertOffset,
					to: insertOffset,
					insert: finalInsertText,
				}]
				});
			}
		}
					insert: finalInsertText,
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

		const getIndentLevelFromStr = (indentStr: string): number => {
			const tabs = (indentStr.match(/^\t*/)?.[0] ?? '').length;
			if (tabs > 0) return tabs;
			const spaces = (indentStr.match(/^ */)?.[0] ?? '').length;
			return Math.floor(spaces / tabSize);
		};

		const getIndentStr = (line: string): string => line.match(/^[\t ]*/)?.[0] ?? '';

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

		const parentIndentLevel = getIndentLevelFromStr(getIndentStr(parentLine));
		const firstLineIndentStr = getIndentStr(lines[0] ?? '');
		const firstLineIndentLevel = getIndentLevelFromStr(firstLineIndentStr);

		const shouldIndent = parentLine.trim() !== "" &&
			(parentIndentLevel > 0 || isMarkdownListItem(parentLine.trim()));

		const targetIndentLevel = shouldIndent ? (parentIndentLevel + 1) : 0;

		const adjustLine = (line: string, index: number): string => {
			// 处理最后一个空行：保持空行原样，不改变缩进
			if (line.trim() === "" && (index === lines.length - 1)) {
				return line;
			}

			const currentIndentStr = getIndentStr(line);
			const currentIndentLevel = getIndentLevelFromStr(currentIndentStr);
			let newIndentLevel: number;

			if (index === 0) {
				newIndentLevel = targetIndentLevel;
			} else {
				const relativeIndentLevel = currentIndentLevel - firstLineIndentLevel;
				newIndentLevel = Math.max(0, targetIndentLevel + relativeIndentLevel);
			}

			// 去除原有的前导缩进，再按新层级添加缩进，避免双重缩进
			const content = line.slice(currentIndentStr.length);
			return createIndent(newIndentLevel) + content;
		};

		// 这里不额外添加前导换行，交由调用方根据插入位置决定是否加换行
		return lines.map(adjustLine).join('\n');
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

	unload() {
		super.unload();
		console.log('unloading drag drop manager');
		if (this.dragHandlerEl) this.dragHandlerEl.detach();
		if (this.targetLineEl) this.targetLineEl.detach();

	}
}


class DragNDropHandlerWidget extends WidgetType {
	dragHandlerContainerEl: HTMLSpanElement | undefined;
	plugin: OutlinerViewPlugin | undefined;

	constructor(
		readonly app: App,
		readonly view: EditorState,
		readonly from: number,
		readonly to: number,
	) {
		super();
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

		// Safely check if the plugin exists
		this.plugin = this.getPlugin();

		if (this.plugin && this.plugin.dragDropManager) {
			const {plugin} = this;
			this.plugin.registerDomEvent(this.dragHandlerContainerEl, 'dragstart', (e: DragEvent) => {
				if (plugin.dragDropManager) {
					plugin.dragDropManager.handleDragStart(e, this.from, this.to, this.view);
				}
			});


		}

		return this.dragHandlerContainerEl;
	}

	private getPlugin(): OutlinerViewPlugin | undefined {
		try {
			return this.view.field(pluginInfoField)?.plugin;
		} catch (error) {
			console.warn('pluginInfoField is not present in the state', error);
			return undefined;
		}
	}
}

const AVAILABLE_CLASS_LIST = ['hmd-callout', 'math-block', 'hmd-codeblock', 'quote'];

export const DragNDropHandler = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(value, tr) {
		// Map existing decorations through document changes first
		value = value.map(tr.changes);

		// Performance: if this transaction didn't change the document, reuse existing decorations.
		// But ensure initial render still occurs when decorations are empty.
		const isEmpty = value === Decoration.none;
		if (!tr.docChanged && !isEmpty) {
			return value;
		}

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

				if (i === tr.state.doc.lines) {
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
