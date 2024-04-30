import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { App, editorInfoField, ExtraButtonComponent, MarkdownView, Menu, Notice, View } from "obsidian";

class BulletMenuMarkerWidget extends WidgetType {
	bulletSpanEl: HTMLSpanElement;
	listSpanEl: HTMLSpanElement;
	menuButtonEl: HTMLButtonElement;

	constructor(
		readonly app: App,
		readonly view: EditorState,
		readonly from: number,
		readonly to: number,
	) {
		super();
	}

	eq(other: BulletMenuMarkerWidget) {
		return other.from === this.from && other.to === this.to && other.view === this.view;
	}

	toDOM() {
		this.bulletSpanEl = createEl('span', {
			cls: 'cm-bullet-menu-marker',
		});

		const componentEl = new ExtraButtonComponent(this.bulletSpanEl).setIcon('menu').onClick(() => {
			const menu = new Menu();
			const editor = this.view.field(editorInfoField).editor;
			const currentLine = this.view.doc.lineAt(this.from);
			const bulletStart = currentLine.text.match(/^\s*/)[0].length || 0;
			const bulletMarker = currentLine.text.trimStart().match(/^(-|\*|(\d{1,}\.))(\s(\[.\]))?/)[0];
			const bulletMarkerLength = currentLine.text.trimStart().match(/^(-|\*|(\d{1,}\.))(\s(\[.\]))?/)[0]?.length || 2;

			console.log(bulletMarker, bulletMarkerLength, currentLine.text.trimStart());

			menu.addItem((item) => {
				const subMenu = item.setIcon('corner-up-right').setTitle('Turn into').setSubmenu();

				subMenu.addItem((item) => {
					item.setIcon('list').setTitle('Bullet').onClick(() => {
						editor?.transaction({
							changes: [
								{
									from: {
										line: currentLine.number - 1,
										ch: bulletStart
									},
									to: {
										line: currentLine.number - 1,
										ch: bulletStart + bulletMarkerLength
									},
									text: '-'
								}
							],
							selection: {
								from: {
									line: currentLine.number - 1,
									ch: bulletStart + bulletMarkerLength + 1
								},
								to: {
									line: currentLine.number - 1,
									ch: bulletStart + bulletMarkerLength + 1
								}
							}
						});
					});
				});
				subMenu.addItem((item) => {
					item.setIcon('heading-1').setTitle('Heading 1').onClick(() => {
						editor?.transaction({
							changes: [
								{
									from: {
										line: currentLine.number - 1,
										ch: bulletStart
									},
									to: {
										line: currentLine.number - 1,
										ch: bulletStart + bulletMarkerLength
									},
									text: `${bulletMarker} #`
								}
							],
							selection: {
								from: {
									line: currentLine.number - 1,
									ch: bulletStart + bulletMarkerLength + 2
								},
								to: {
									line: currentLine.number - 1,
									ch: bulletStart + bulletMarkerLength + 2
								}
							}
						});
					});
				});
				subMenu.addItem((item) => {
					item.setIcon('heading-2').setTitle('Heading 2').onClick(() => {
						editor?.transaction({
							changes: [
								{
									from: {
										line: currentLine.number - 1,
										ch: bulletStart
									},
									to: {
										line: currentLine.number - 1,
										ch: bulletStart + bulletMarkerLength
									},
									text: `${bulletMarker} ##`
								}
							],
							selection: {
								from: {
									line: currentLine.number - 1,
									ch: bulletStart + bulletMarkerLength + 3
								},
								to: {
									line: currentLine.number - 1,
									ch: bulletStart + bulletMarkerLength + 3
								}
							}
						});
					});
				});
				subMenu.addItem((item) => {
					item.setIcon('list-checks').setTitle('To-do').onClick(() => {
						editor?.transaction({
							changes: [
								{
									from: {
										line: currentLine.number - 1,
										ch: bulletStart
									},
									to: {
										line: currentLine.number - 1,
										ch: bulletStart + bulletMarkerLength
									},
									text: `${bulletMarker.replace(/\[.\]/g, '').trim()} [ ]`
								}
							],
							selection: {
								from: {
									line: currentLine.number - 1,
									ch: bulletStart + bulletMarkerLength + 4
								},
								to: {
									line: currentLine.number - 1,
									ch: bulletStart + bulletMarkerLength + 4
								}
							}
						});
					});
				});
				subMenu.addItem((item) => {
					item.setIcon('pilcrow').setTitle('Paragraph').onClick(() => {
						editor?.transaction({
							changes: [
								{
									from: {
										line: currentLine.number - 1,
										ch: bulletStart
									},
									to: {
										line: currentLine.number - 1,
										ch: bulletStart + bulletMarkerLength
									},
									text: `${bulletMarker}`
								}
							],
							selection: {
								from: {
									line: currentLine.number - 1,
									ch: bulletStart + bulletMarkerLength + 1
								},
								to: {
									line: currentLine.number - 1,
									ch: bulletStart + bulletMarkerLength + 1
								}
							}
						});
					});
				});
				subMenu.addItem((item) => {
					item.setIcon('square-kanban').setTitle('Board').onClick(() => {
						new Notice('Not yet available');
					});
				});
			});

			menu.addSeparator();

			menu.addItem((item) => {
				item.setIcon('check').setTitle('Complete').onClick(() => {
					editor?.transaction({
						changes: [
							{
								from: {
									line: currentLine.number - 1,
									ch: bulletStart
								},
								to: {
									line: currentLine.number - 1,
									ch: bulletStart + bulletMarkerLength
								},
								text: `${bulletMarker.replace(/\[.\]/g, '').trim()} [x]`
							}
						],
						selection: {
							from: {
								line: currentLine.number - 1,
								ch: bulletStart + bulletMarkerLength + 4
							},
							to: {
								line: currentLine.number - 1,
								ch: bulletStart + bulletMarkerLength + 4
							}
						}
					});
				});
			});
			menu.addItem((item) => {
				item.setIcon('pencil').setTitle('Add note').onClick(() => {
					const currentLineIndent = currentLine.text.match(/^\s*/)?.[0];
					const currentLineEnd = currentLine.to;
					editor?.transaction({
						changes: [
							{
								from: {
									line: currentLine.number - 1,
									ch: currentLine.length
								},
								to: {
									line: currentLine.number - 1,
									ch: currentLine.length
								},
								text: `\n${currentLineIndent}${(' ').repeat(bulletMarker.length)}`
							}
						],
						selection: {
							from: {
								line: currentLine.number,
								ch: (currentLineIndent?.length || 0) + bulletMarker.length
							},
							to: {
								line: currentLine.number,
								ch: (currentLineIndent?.length || 0) + bulletMarker.length
							}
						}
					});
				});
			});
			menu.addItem((item) => {
				item.setIcon('calendar').setTitle('Add date').onClick(() => {
					new Notice('Not yet available');
				});
			});
			menu.addItem((item) => {
				item.setIcon('play').setTitle('Present').onClick(() => {
					new Notice('Not yet available');
				});
			});
			menu.addItem((item) => {
				item.setIcon('move-right').setTitle('Move to').onClick(() => {
					new Notice('Not yet available');
				});
			});

			const rect = this.bulletSpanEl.getBoundingClientRect();
			menu.showAtPosition({x: rect.left - 42, y: rect.bottom});
		});

		return this.bulletSpanEl;
	}

	ignoreEvent(event: Event) {
		if (event.type === 'mousedown' || event.type === 'mouseup' || event.type === 'click') {
			event.preventDefault();
			return true;
		}
		return false;
	}
}

export const BulletMenu = StateField.define<DecorationSet>({
	create() {
		return Decoration.none;
	},
	update(value, tr) {
		let builder = new RangeSetBuilder<Decoration>();

		const field = tr.state.field(editorInfoField);

		for (let i = 1; i <= tr.state.doc.lines; i++) {
			const line = tr.state.doc.line(i);
			const spacesLength = line.text.match(/^\s*/)[0].length; // 使用 \s* 匹配所有空白字符，包括空格和制表符

			if (spacesLength > 0) {
				// 如果存在空格或缩进，将 widget 添加在这些空格之后
				builder.add(line.from + spacesLength, line.from + spacesLength, Decoration.widget({
					widget: new BulletMenuMarkerWidget(field.app, tr.state, line.from + spacesLength, line.from + spacesLength),
					side: -1
				}));
			} else {
				// 如果没有空格或缩进，将 widget 添加在行的开始
				builder.add(line.from, line.from, Decoration.widget({
					widget: new BulletMenuMarkerWidget(field.app, tr.state, line.from, line.from),
					side: -1
				}));
			}
		}
		const dec = builder.finish();
		return dec;
	},
	provide: (f) => EditorView.decorations.from(f),
});
