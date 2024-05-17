import { EditorState, RangeSetBuilder, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView, WidgetType } from "@codemirror/view";
import { App, editorInfoField, ExtraButtonComponent, Menu, MenuItem, moment, Notice } from "obsidian";
import { EmbeddableMarkdownEditor } from "./MarkdownEditor";

class BulletMenuMarkerWidget extends WidgetType {
	bulletSpanEl: HTMLSpanElement | undefined;

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

		new ExtraButtonComponent(this.bulletSpanEl).setIcon('menu').onClick(() => {
			const menu = new Menu();
			const editor = this.view.field(editorInfoField).editor;
			const currentLine = this.view.doc.lineAt(this.from);
			const bulletStart = currentLine.text.match(/^\s*/)?.[0].length || 0;
			const bulletMarker = currentLine.text.trimStart().match(/^(-|\*|(\d{1,}\.))(\s(\[.\]))?/)?.[0] || '-';
			const bulletMarkerLength = currentLine.text.trimStart().match(/^(-|\*|(\d{1,}\.))(\s(\[.\]))?/)?.[0]?.length || 2;

			menu.addItem((item) => {
				// @ts-ignore
				const subMenu = item.setIcon('corner-up-right').setTitle('Turn into').setSubmenu() as Menu;

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
				subMenu.addItem((item: MenuItem) => {
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
					if ((/^(-|\*|\d+\.)(\s\[.\])?/g.test(currentLine.text.trimStart()))) {
						editor?.focus();
						editor?.transaction({
							selection: {
								from: {
									line: currentLine.number - 1,
									ch: currentLine.length - 1
								},
								to: {
									line: currentLine.number - 1,
									ch: currentLine.length - 1
								}
							}
						});
						const result = editor && (editor.editorComponent as EmbeddableMarkdownEditor).options.onEnter(editor.editorComponent, false, true);
						if (!result) {
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
										text: `\n${currentLine.text.match(/^\s*/)?.[0] || ''}${(' ').repeat(2)}`
									}
								],
							});

							editor?.transaction({
								selection: {
									from: {
										line: currentLine.number,
										ch: 0
									},
									to: {
										line: currentLine.number,
										ch: 0
									}
								}
							});
						}
					}

					// const currentLineIndent = currentLine.text.match(/^\s*/)?.[0];
					// const foldableRange = foldable(this.view, currentLine.from, currentLine.to);
					// let targetLine = currentLine.number;
					// if(foldableRange) {
					// 	// No bullet line until the end of the foldable range
					//
					// 	if ((/^(-|\*|\d+\.)(\s\[.\])?/g.test(currentLine.text.trimStart()))) {
					// 		const startLineNum = currentLine.number;
					// 		let foundValidLine = false;
					//
					// 		for (let i = startLineNum + 1; i < this.view.doc.lines; i++) {
					// 			const line = this.view.doc.line(i);
					// 			const lineText = line.text;
					//
					// 			// 检查行是否有缩进并且不以列表标记开始
					// 			if (/^\s+/.test(lineText) && !(/^(-|\*|\d+\.)\s/.test(lineText.trimStart()))) {
					// 				foundValidLine = true;
					// 			} else {
					// 				// 遇到不满足条件的行，检查是否已经遍历过至少一行
					// 				if (foundValidLine) {
					// 					targetLine = this.view.doc.line(i - 1).number;
					// 					break;
					// 				}
					// 			}
					// 		}
					// 	}
					//
					// 	if(targetLine !== currentLine.number) {
					// 		editor?.transaction({
					// 			selection: {
					// 				from: {
					// 					line: this.view.doc.line(targetLine - 1).number,
					// 					ch: (currentLineIndent?.length || 0) + 2
					// 				},
					// 				to: {
					// 					line: this.view.doc.line(targetLine- 1).number,
					// 					ch: (currentLineIndent?.length || 0) + 2
					// 				}
					// 			}
					// 		})
					//
					// 		const newCurrentLine = this.view.doc.line(targetLine);
					// 		if(newCurrentLine.text.trim()) {
					// 			editor?.transaction({
					// 				changes: [
					// 					{
					// 						from: {
					// 							line: targetLine - 1,
					// 							ch: newCurrentLine.length
					// 						},
					// 						to: {
					// 							line: targetLine - 1,
					// 							ch: newCurrentLine.length
					// 						},
					// 						text: `\n${currentLineIndent}${(' ').repeat(2)}`
					// 					}
					// 				],
					// 			});
					//
					// 			editor?.transaction({
					// 				selection: {
					// 					from: {
					// 						line: this.view.doc.line(targetLine).number,
					// 						ch: (currentLineIndent?.length || 0) + 2
					// 					},
					// 					to: {
					// 						line: this.view.doc.line(targetLine).number,
					// 						ch: (currentLineIndent?.length || 0) + 2
					// 					}
					// 				}
					// 			})
					// 		}
					//
					//
					// 	}
					//
					// 	return;
					// }
					//
					// new Notice(currentLine.number.toString());
					//
					// editor?.transaction({
					// 	changes: [
					// 		{
					// 			from: {
					// 				line: currentLine.number - 1,
					// 				ch: currentLine.length
					// 			},
					// 			to: {
					// 				line: currentLine.number - 1,
					// 				ch: currentLine.length
					// 			},
					// 			text: `\n${currentLineIndent}${(' ').repeat(2)}`
					// 		}
					// 	],
					// });
					// editor?.transaction({
					// 	selection: {
					// 		from: {
					// 			line: currentLine.number,
					// 			ch: currentLine.length
					// 		},
					// 		to: {
					// 			line: currentLine.number,
					// 			ch: currentLine.length
					// 		}
					// 	}
					// })


				});
			});
			menu.addItem((item) => {
				item.setIcon('calendar').setTitle('Add date').onClick(() => {
					const currentDate = moment().format('YYYY-MM-DD');
					const currentDateText = `📅 ${currentDate}`;

					editor?.transaction({
						changes: [
							{
								from: {
									line: currentLine.number - 1,
									ch: currentLine.length
								},
								text: ` ${currentDateText} `
							}
						],
						selection: {
							from: {
								line: currentLine.number,
								ch: currentLine.length
							},
							to: {
								line: currentLine.number,
								ch: currentLine.length
							}
						}
					});
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
			menu.addSeparator();
			menu.addItem((item) => {
				// @ts-ignore
				item.setIcon('trash').setTitle('Delete').setWarning(true).onClick(() => {
					// Delete current line
					editor?.transaction({
						changes: [
							{
								from: {
									line: currentLine.number - 1,
									ch: 0
								},
								to: {
									line: currentLine.number,
									ch: 0
								},
								text: ''
							}
						],
						selection: {
							from: {
								line: currentLine.number - 1,
								ch: 0
							},
							to: {
								line: currentLine.number - 1,
								ch: 0
							}
						}
					});
				});
			});

			if (!this.bulletSpanEl) return;
			const rect = this.bulletSpanEl?.getBoundingClientRect();
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
		const builder = new RangeSetBuilder<Decoration>();

		const field = tr.state.field(editorInfoField);

		for (let i = 1; i <= tr.state.doc.lines; i++) {
			const line = tr.state.doc.line(i);
			if (!(/^(-|\*|\d+\.)(\s(\[.\]))?/g.test(line.text.trimStart()))) continue;
			const spacesLength = line.text.match(/^\s*/)![0].length; // 使用 \s* 匹配所有空白字符，包括空格和制表符

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
