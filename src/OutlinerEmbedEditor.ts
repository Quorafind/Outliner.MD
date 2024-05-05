import { App, Component, debounce, Editor, setIcon, TFile } from "obsidian";
import { EmbeddableMarkdownEditor } from "./embedEditor";
import { getIndent } from "./utils";
import { zoomInEffect, zoomWithHideIndentEffect } from "./checkVisible";
import { getAPI } from "obsidian-dataview";
import { foldable } from "@codemirror/language";
import { KeepOnlyZoomedContentVisible } from "./keepOnlyZoomedContentVisible";
import { CalculateRangeForZooming } from "./calculateRangeForZooming";
import { SelectionAnnotation } from "./SelectionController";


export class OutlinerEmbedEditor extends Component {
	app: App;
	editor: Editor | undefined;
	filePath: string | undefined;
	file: TFile | null | undefined;

	data: string | undefined;
	range: { from: number; to: number; } | undefined;

	calculateRangeForZooming = new CalculateRangeForZooming();
	KeepOnlyZoomedContentVisible = new KeepOnlyZoomedContentVisible();

	contentMap: Map<string, string> = new Map();
	editorMap: Map<string, Editor> = new Map();

	indexed: boolean = false;

	changedBySelf: boolean = false;

	editing: boolean = false;

	constructor(app: App, readonly containerEl: HTMLElement) {
		super();
		this.app = app;
	}

	async onload() {
		super.onload();
		this.initEditor();

		this.registerEvent(
			this.app.metadataCache.on("dataview:index-ready", () => {
					this.initEditor();
					console.log('index ready');
					this.indexed = true;
				}
			));

		this.registerEvent(
			this.app.metadataCache.on("dataview:metadata-change", (type: any, file: TFile, oldPath?: string | undefined) => {
					if (!this.indexed) return;

					this.debounceUpdateEditor(file, oldPath);
				}
			));
	}

	getDisplayText() {
		return this.file?.basename || 'Untitled';
	}

	getViewType() {
		return "outliner";
	}

	async onunload() {
		super.onunload();
	}

	requestSave = debounce(async (path: string, data: string) => {
		const file = this.app.vault.getFileByPath(path);
		if (file) {
			console.log('saving', path, data);
			this.editing = false;
			await this.app.vault.modify(file, data);
		}

	}, 3000);

	createEditor(container: HTMLElement, path: string, data: string, range: { from: number, to: number } | {
		from: number,
		to: number
	}[]) {
		const embedEditor = new EmbeddableMarkdownEditor(this.app, container, {
			// onEscape: (editor) => {
			// 	new Notice(`Escaped the editor: (${editor.initial_value})`);
			// 	this.removeChild(editor);
			// },
			onEnter: (editor, mod: boolean, shift: boolean) => {
				if (!shift) {
					const {line, ch} = (editor.editor as Editor).getCursor();
					const lineText = editor.editor.getLine(line);

					const range = this.app.plugins.getPlugin('obsidian-zoom')?.getZoomRange(editor.editor);
					// const range = getZoomRange(editorView.state);
					const indentNewLine = getIndent(this.app);

					if (range) {
						const firstLineInRange = range.from.line;
						const lastLineInRange = range.to.line;
						const spaceOnFirstLine = editor.editor.getLine(firstLineInRange)?.match(/^\s*/)?.[0];
						const lastLineInRangeText = editor.editor.getLine(lastLineInRange);

						const cursor = editor.editor.getCursor();
						const lineText = editor.editor.getLine(cursor.line);

						if (/^((-|\*|\d+\.)(\s\[.\])?)/g.test(lineText.trim())) {
							const currentLine = cursor.line;
							const currentLineText = editor.editor.getLine(currentLine);
							const spaceOnCurrentLine = currentLineText.match(/^\s*/)?.[0];

							editor.editor.transaction({
								changes: [
									{
										text: `\n${spaceOnCurrentLine}${spaceOnCurrentLine.length > spaceOnFirstLine.length ? '' : indentNewLine}- `,
										from: {
											line: cursor.line,
											ch: cursor.ch || 0,
										}
									}
								],
								selection: {
									from: {
										line: cursor.line + 1,
										ch: 2 + (`${spaceOnCurrentLine}${spaceOnCurrentLine.length > spaceOnFirstLine.length ? '' : indentNewLine}`.length)
									},
									to: {
										line: cursor.line + 1,
										ch: 2 + (`${spaceOnCurrentLine}${spaceOnCurrentLine.length > spaceOnFirstLine.length ? '' : indentNewLine}`.length)
									}
								}
							});
							return true;
						}

						const spaceOnLastLine = lastLineInRangeText?.match(/^\s*/)?.[0];

						if (/^((-|\*|\d+\.)(\s\[.\])?)$/g.test(lastLineInRangeText.trim()) && spaceOnLastLine === (spaceOnFirstLine + indentNewLine)) {
							editor.editor.transaction({
								changes: [
									{
										text: `\n${spaceOnFirstLine}${indentNewLine}- `,
										from: {
											line: lastLineInRange,
											ch: lastLineInRangeText.length || 0,
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
							return true;
						}
					}

					const prevLine  = line > 0 ? editor.editor.getLine(line - 1) : "";

					if (lineText.startsWith("- ")) {
						(editor.editor as Editor).transaction({
							changes: [
								{
									text: "\n- ",
									from: {line, ch: ch},
								}
							],
							selection: {
								from: {line: line, ch: ch + 3},
								to: {line: line, ch: ch + 3},
							}
						});
						return true;
					} else if (!lineText.trim() && (/^(-|\*|\d+\.)(\s\[.\])?/g.test(prevLine.trim()))) {
						(editor.editor as Editor).transaction({
							changes: [
								{
									text: "- ",
									from: {line, ch: 0},
								}
							],
							selection: {
								from: {line: line, ch: 2},
								to: {line: line, ch: 2},
							}
						});
						return true;
					} else if(/^\s+/g.test(lineText) && !(/^(-|\*|\d+\.)(\s\[.\])?/g.test(lineText.trim()))) {
						const currentIndent = lineText.match(/^\s+/)?.[0];

						(editor.editor as Editor).transaction({
							changes: [
								{
									text: `\n${currentIndent}`,
									from: {line, ch},
								}
							],
							selection: {
								from: {line: line + 1, ch: currentIndent.length},
								to: {line: line + 1, ch: currentIndent.length},
							}
						});
						return true;
					}

					if(/^(-|\*|\d+\.)(\s\[.\])?/g.test(lineText.trim())) {
						const range = foldable(editor.editor.cm.state, editor.editor.posToOffset({line, ch: 0}), editor.editor.posToOffset({line: line + 1, ch: 0}) - 1);
						const indentNewLine = getIndent(this.app);
						const spaceBeforeStartLine = lineText.match(/^\s+/)?.[0] || "";
						if (range) {
							let foundValidLine = false;

							const startLineNum = editor.editor.cm.state.doc.lineAt(range.from).number;
							for (let i = startLineNum + 1; i < (editor.editor as Editor).cm.state.doc.lines; i++) {
								const line = (editor.editor as Editor).cm.state.doc.line(i);
								const lineText = line.text;

								// 检查行是否有缩进并且不以列表标记开始
								if (/^\s+/.test(lineText) && !(/^(-|\*|\d+\.)\s/.test(lineText.trimStart()))) {
									foundValidLine = true;
								} else {
									// 遇到不满足条件的行，检查是否已经遍历过至少一行
									if (foundValidLine) {
										const currentLine = (editor.editor as Editor).cm.state.doc.line(i - 1);
										if(currentLine.to === range.to) {
											(editor.editor as Editor).transaction({
												changes: [
													{
														text: `${spaceBeforeStartLine}- \n`,
														from: {line: i - 1, ch: 0},
													}
												]
											});
											(editor.editor as Editor).cm.dispatch({
												selection: {
													head: line.from,
													anchor: line.from,
												}
											});
											return true;
										} else {
											(editor.editor as Editor).cm.dispatch({
												changes: {
													insert: `${spaceBeforeStartLine}${indentNewLine}- \n`,
													from: line.from,
												}
											});
											(editor.editor as Editor).cm.dispatch({
												selection: {
													head: line.from,
													anchor: line.from,
												}
											});
											return true;
										}


									}
									return false;
								}
							}
						}
						return false;
					}
				}
				if (shift) {
					const {line, ch} = (editor.editor as Editor).getCursor();
					const charOffset = (editor.editor as Editor).posToOffset({line, ch});
					const charLine = (editor.editor as Editor).cm.state.doc.lineAt(charOffset);

					if(/^\s+/g.test(charLine.text) && !(/^(-|\*|\d+\.)(\s\[.\])?/g.test(charLine.text.trimStart()))) {
						const lineNum = charLine.number;

						for(let i = lineNum; i >= 1; i--) {
							const lineCursor = (editor.editor as Editor).cm.state.doc.line(i);
							const lineText = lineCursor.text;
							if (/^(-|\*|\d+\.)(\s\[.\])?/g.test(lineText.trimStart())) {
								const currentLine = (editor.editor as Editor).cm.state.doc.line(i);
								console.log('currentLine', currentLine.text, currentLine.from, currentLine.to);
								(editor.editor as Editor).cm.dispatch({
									selection: {
										head: currentLine.to,
										anchor: currentLine.to,
									},
									annotations: SelectionAnnotation.of('arrow.up.selection'),
								});
								return true;
							}
						}
						// lineCursor.next();

						// console.log('lineNum', lineNum, lineCursor.done);
						// return false;
					} else if ((/^(-|\*|\d+\.)(\s\[.\])?/g.test(charLine.text.trimStart()))) {
						const startLineNum = charLine.number;
						let foundValidLine = false;

						for (let i = startLineNum + 1; i < (editor.editor as Editor).cm.state.doc.lines; i++) {
							const line = (editor.editor as Editor).cm.state.doc.line(i);
							const lineText = line.text;

							// 检查行是否有缩进并且不以列表标记开始
							if (/^\s+/.test(lineText) && !(/^(-|\*|\d+\.)\s/.test(lineText.trimStart()))) {
								foundValidLine = true;
							} else {
								// 遇到不满足条件的行，检查是否已经遍历过至少一行
								if (foundValidLine) {
									const currentLine = (editor.editor as Editor).cm.state.doc.line(i - 1);
									(editor.editor as Editor).cm.dispatch({
										selection: {
											head: currentLine.to,
											anchor: currentLine.to,
										},
										annotations: SelectionAnnotation.of('arrow.up.selection'),
									});
									return true;
								}
								return false;
							}
						}
						if (foundValidLine) {
							const lastLine = (editor.editor as Editor).cm.state.doc.line((editor.editor as Editor).cm.state.doc.lines - 1);
							(editor.editor as Editor).cm.dispatch({
								selection: {
									head: lastLine.to,
									anchor: lastLine.to,
								},
								// annotations: SelectionAnnotation.of('arrow.up.selection'),
							});
							return true;
						}

						return false;
					}
				}
				return false;
			},
			onDelete: (editor) => {
				const {line, ch} = (editor.editor as Editor).getCursor();
				const lineText = editor.editor.getLine(line);
				// const from = editor.editor.posToOffset({line, ch});
				const lineFrom = editor.editor.posToOffset({line, ch: 0});
				const lineTo = editor.editor.posToOffset({line: line + 1, ch: 0}) - 1;

				const foldRange = foldable(editor.editor.cm.state, lineFrom, lineTo);

				if (/^(\s*?)((-|\*|\d+\.)(\s\[.\])?)\s/g.test(lineText) && /^((-|\*|\d+\.)(\s\[.\])?)$/g.test(lineText.trim())) {
					if (line === 0) {
						return true;
					}

					if (foldRange) {
						return true;
					}


					const range = this.app.plugins.getPlugin('obsidian-zoom')?.getZoomRange(editor.editor);
					if (range) {
						const firstLineInRange = range.from.line;
						if (firstLineInRange === line) {
							return true;
						}
					}

					(editor.editor as Editor).transaction({
						changes: [
							{
								text: "",
								from: {line: line - 1, ch: editor.editor.getLine(line - 1).length},
								to: {line, ch: ch},
							}
						],
					});
					return true;
				} else if (/^\s+$/g.test(lineText)) {
					console.log('empty line', lineText);
					(editor.editor as Editor).transaction({
						changes: [
							{
								text: "",
								from: {line: line - 1, ch: editor.editor.getLine(line - 1).length},
								to: {line, ch: ch},
							}
						]
					});
					return true;
				}

				return false;
			},
			onIndent: (editor, mod: boolean, shift: boolean) => {
				if (shift) {
					const range = this.app.plugins.getPlugin('obsidian-zoom')?.getZoomRange(editor.editor);

					if (range) {
						const firstLineInRange = range.from.line;
						const lastLineInRange = range.to.line;

						console.log('range', range);
						const spaceOnFirstLine = editor.editor.getLine(firstLineInRange)?.match(/^\s*/)?.[0];
						const lastLineInRangeText = editor.editor.getLine(lastLineInRange);
						const spaceOnLastLine = lastLineInRangeText?.match(/^\s*/)?.[0];
						const indentNewLine = getIndent(this.app);

						if (firstLineInRange === lastLineInRange) return true;

						if (spaceOnFirstLine === spaceOnLastLine || (spaceOnLastLine === spaceOnFirstLine + indentNewLine)) {
							return true;
						}
					}
				}

				return false;
			},
			getDisplayText: () => this.getDisplayText(),
			getViewType: () => this.getViewType(),
			onChange: (update, path) => {
				// this.data = update.state.doc.toString();
				// this.requestSave();

				if (path) {
					if (!update.docChanged) return;
					if (this.contentMap.get(path) === update.state.doc.toString()) return;

					if (this.changedBySelf) {
						this.changedBySelf = false;
						return;
					}

					console.log('changed', "hello changed", update.state.doc.toString());

					this.editing = true;
					this.requestSave(path, update.state.doc.toString());
				}
			},
			type: 'embed',
			value: data || "",
			path: path,
			foldByDefault: true,
		});

		this.editorMap.set(path, embedEditor.editor);
		embedEditor.editor.getValue = () => {
			return data || "";
		};

		console.log(range);

		this.updateVisibleRange(embedEditor.editor, range);

		// @ts-expect-error - This is a private method
		return this.addChild(embedEditor);
	}

	zoomIn() {
		if (!this.editor || !this.range) return;
		const rangeForZooming = this.calculateRangeForZooming.calculateRangeForZooming(this.editor.cm.state, this.range.from);
		if (rangeForZooming) {
			this.editor.cm.dispatch({
				effects: zoomInEffect.of(rangeForZooming)
			});
		}
	}


	updateVisibleRange(editor: Editor, range: { from: number, to: number } | { from: number, to: number }[]) {
		console.log(range);

		if (Array.isArray(range)) {
			const wholeRanges = range.map((r) => {
				return (this.calculateRangeForZooming.calculateRangeForZooming(editor.cm.state, r.from) || {
					from: r.from,
					to: r.to
				});
			});
			this.KeepOnlyZoomedContentVisible.keepRangesVisible(editor.cm, wholeRanges);

			console.log('update ranges', wholeRanges);

			for (const r of wholeRanges) {
				const firstLine = editor.cm.state.doc.lineAt(r.from);
				const firstLineIndent = firstLine.text.match(/^\s*/)?.[0];

				if (firstLineIndent) {
					editor.cm.dispatch({
						effects: zoomWithHideIndentEffect.of({
							range: {
								from: r.from,
								to: r.to,
							},
							indent: firstLineIndent
						})
					});
				}
			}
		} else {
			const newRange = this.calculateRangeForZooming.calculateRangeForZooming(editor.cm.state, range.from);

			if (newRange) {
				editor.cm.dispatch({
					effects: [zoomInEffect.of(newRange)]
				});
				const firstLine = editor.cm.state.doc.lineAt(newRange.from);
				const firstLineIndent = firstLine.text.match(/^\s*/)?.[0];
				if (firstLineIndent) {
					editor.cm.dispatch({
						effects: zoomWithHideIndentEffect.of({
							range: {
								from: newRange.from,
								to: newRange.to,
							},
							indent: firstLineIndent
						})
					});
				}
			}
		}
	}

	updateResultEl(
		length: number,
	) {
		this.containerEl.toggleClass('cm-task-group-result-empty', length === 0);
		this.containerEl.find('.cm-task-group-result').setText(length.toString() + ' results');
	}

	async initEditor() {
		const api = getAPI(this.app);
		const result = await api.query(`TASK  
FROM ""  
WHERE contains(text, "#now")
GROUP BY file.path`);

		console.log('result', result.successful, result.value.values);

		if (!result.successful) return;
		const values = result.value.values;

		let count = 0;

		for (const v of values) {
			if (!v.key || this.editorMap.has(v.key)) continue;


			const linkHeader = this.containerEl.createEl('div', {cls: 'cm-task-group-header'});
			const taskGroupContainer = this.containerEl.createEl('div', {cls: 'cm-task-container'});
			const collapseButton = linkHeader.createEl('span', {cls: 'cm-group-collapse-button'});
			setIcon(collapseButton, 'chevron-right');

			const titleEl = linkHeader.createEl('span', {cls: 'cm-group-title', text: v.key});

			collapseButton.onclick = () => {
				taskGroupContainer.isShown() ? taskGroupContainer.hide() : taskGroupContainer.show();
				collapseButton.toggleClass('cm-task-container-collapsed', !taskGroupContainer.isShown());
			};

			titleEl.onclick = () => {
				this.app.workspace.openLinkText(v.key, '', true, {
					active: true,
				});
			};

			taskGroupContainer.hide();
			collapseButton.toggleClass('cm-task-container-collapsed', !taskGroupContainer.isShown());


			if (this.app.vault.getFileByPath(v.key)) {
				const file = this.app.vault.getFileByPath(v.key);

				const ranges = v.rows.map((r: { position: any }) => {
					count++;
					return {
						from: r.position.start.offset,
						to: r.position.end.offset,
					};
				});

				if (file) {
					const data = await this.app.vault.read(file);
					this.createEditor(taskGroupContainer, v.key, data, ranges);
				}
			}


		}

		this.updateResultEl(count);
	}

	debounceUpdateEditor = debounce((file: TFile, oldPath?: string) => {
		this.updateEditor(file, oldPath);
	}, 1000);

	async updateEditor(file: TFile, oldPath?: string) {
		console.log('is editing', this.editing);
		if (this.editing) return;

		const api = getAPI(this.app);

		const result = await api.query(`TASK  
FROM ""  
WHERE contains(text, "#now")
GROUP BY file.path`);

		console.log('result', result.successful, result.value.values);

		if (!result.successful) return;
		const values = result.value.values;

		let count = 0;
		for (const v of values) {
			const ranges = v.rows.map((r: { position: any }) => {
				count++;
				return {
					from: r.position.start.offset,
					to: r.position.end.offset,
				};
			});

			if (this.editorMap.has(v.key)) {
				const targetFile = this.app.vault.getFileByPath(v.key);
				if (!targetFile) continue;
				const editor = this.editorMap.get(targetFile?.path);
				if (editor) {
					const data = await this.app.vault.read(targetFile);

					const lastContent = this.contentMap.get(targetFile.path);
					if (lastContent !== data) {
						console.log('changed', lastContent, data);

						if (this.contentMap.has(targetFile.path)) {
							this.contentMap.set(targetFile.path, data);
						}

						this.changedBySelf = true;
						// const endPos = editor.offsetToPos((lastContent || editor.getValue()).length);
						const lastLine = editor.cm.state.doc.lineAt(editor.cm.state.doc.length - 1);
						editor.replaceRange(data, {line: 0, ch: 0}, {line: lastLine.number, ch: lastLine.length});
						this.contentMap.set(targetFile.path, data);

						// const values = result.value.values;
						this.updateVisibleRange(editor, ranges);
					}
				}
			} else {
				const myfile = this.app.vault.getFileByPath(v.key);

				// this.containerEl.createEl('div', {cls: 'cm-task-group-header', text: v.key});

				const linkHeader = this.containerEl.createEl('div', {cls: 'cm-task-group-header', text: v.key});
				linkHeader.onclick = () => {
					this.app.workspace.openLinkText(v.key, '', true, {
						active: true
					});
				};

				if (myfile) {
					const data = await this.app.vault.read(myfile);
					this.createEditor(this.containerEl, v.key, data, ranges);
					this.contentMap.set(myfile.path, data);
				}
			}
		}

		this.updateResultEl(count);

		// if(!this.editorMap.has(file.path)) {
		//
		// }
		//
		// if (oldPath) {
		// 	const oldComponent = this.editorMap.get(oldPath);
		// 	if (oldComponent) {
		// 		this.removeChild(oldComponent);
		// 		oldComponent.unload();
		// 		this.editorMap.delete(oldPath);
		// 	}
		// 	this.contentMap.delete(oldPath);
		// }
		// const newContent = await this.app.vault.read(file);
		// this.contentMap.set(file.path, newContent);
		// this.filePath = file.path;
		// this.reloadEditor();
	}
}
