import { App, Component, debounce, Editor, ExtraButtonComponent, TFile } from "obsidian";
import { CalculateRangeForZooming } from "./calculateRangeForZooming";
import { EmbeddableMarkdownEditor } from "./MarkdownEditor";
import { getIndent } from "./utils";
import { foldable } from "@codemirror/language";
import { SelectionAnnotation } from "./SelectionController";
import { hideFrontMatterEffect, zoomInEffect, zoomWithHideIndentEffect } from "./checkVisible";
import { KeepOnlyZoomedContentVisible } from "./keepOnlyZoomedContentVisible";
import OutlinerViewPlugin from "./OutlinerViewIndex";

export class EmbeddedEditor extends Component {
	plugin: OutlinerViewPlugin;
	app: App;
	editor: Editor | undefined;

	file: TFile | undefined;
	subpath: string | undefined;
	data: string | undefined;

	sourcePath: string;
	sourceFile: TFile | undefined;

	containerEl: HTMLElement;

	range: { from: number; to: number; } | { from: number; to: number; }[] | undefined;

	calculateRangeForZooming = new CalculateRangeForZooming();
	KeepOnlyZoomedContentVisible = new KeepOnlyZoomedContentVisible();

	constructor(plugin: OutlinerViewPlugin, e: {
		sourcePath: string;
		app: App;
		containerEl: HTMLElement;
	}, file: TFile, subpath: string, readonly targetRange?: { from: number, to: number }, readonly initData?: string) {
		super();
		this.plugin = plugin;
		this.app = e.app;
		this.containerEl = e.containerEl;

		this.sourcePath = e.sourcePath;
		this.file = file;
		this.subpath = subpath;
	}

	async onload() {
		super.onload();

		const targetFile = this.file;
		targetFile && !this.initData && this.app.vault.read(targetFile).then((data) => {
			this.data = data;
			if (!targetFile) return;

			const targetRange = this.getRange(targetFile);


			const embedEl = this.containerEl.createEl('div', {
				cls: 'embedded-editor-container',
			});

			this.createEditor(embedEl, targetFile?.path, this.data || "", targetRange);
		});

		if (this.initData && targetFile && this.targetRange) {
			this.data = this.initData;
			console.log('initdata', this.initData.slice(this.targetRange.from, this.targetRange.to));
			// const targetRange = this.getRange(targetFile);
			this.createEditor(this.containerEl, targetFile?.path, this.data || "", {
				...this.targetRange,
				type: 'part'
			});
		}

		this.registerEvent(this.app.metadataCache.on('changed', (file) => {
			this.updateFile(file);
		}));
	}

	updateFile = debounce(async (file: TFile) => {
		if (file.path === this.file?.path) {
			const data = await this.app.vault.read(file);
			if (this.data === data) return;
			//
			// const targetData = data;
			//
			// if (this.range && !Array.isArray(this.range)) {
			// 	const dataInRange = this.editor?.cm.state.doc.toString()?.slice(this.range.from, this.range.to);
			// 	const originData = this.data?.slice(this.range.from, this.range.to);
			//
			// 	if (dataInRange && originData && dataInRange !== originData) {
			// 		targetData.replace(originData, dataInRange);
			// 	}
			// }
			//
			// this.data = targetData;
			//
			// const lastLine = this.editor?.cm.state.doc.lineAt(this.editor?.cm.state.doc.length - 1);
			// lastLine && this.editor?.replaceRange(targetData, {line: 0, ch: 0}, {
			// 	line: lastLine.number,
			// 	ch: lastLine.length - 1
			// });
			//
			// const targetRange = this.getRange(file);
			// this.range = {
			// 	from: targetRange.from,
			// 	to: targetRange.to
			// };
			// targetRange.type !== 'whole' && this.updateVisibleRange(this.editor as Editor, this.range, targetRange.type as 'part' | 'block' | 'heading');


			this.data = data;
			const lastLine = this.editor?.cm.state.doc.lineAt(this.editor?.cm.state.doc.length - 1);
			lastLine && this.editor?.replaceRange(data, {line: 0, ch: 0}, {line: lastLine.number, ch: lastLine.length});

			const targetRange = this.getRange(file);
			this.range = {
				from: targetRange.from,
				to: targetRange.to
			};
			targetRange.type !== 'whole' && this.updateVisibleRange(this.editor as Editor, this.range, targetRange.type as 'part' | 'block' | 'heading');
			targetRange.type === 'whole' && this.plugin.settings.hideFrontmatter && this.updateFrontMatterVisible(this.editor as Editor, this.file as TFile);
		}
	}, 800);

	async onunload() {
		super.onunload();
	}

	onFileChanged(file: TFile) {
		console.log(file);
	}

	loadFile(file: TFile, subpath: string) {

	}

	requestSave = debounce(async (file: TFile, data: string) => {
		if (file) {
			// let targetData = data;
			//
			// const currentVisible = this.editor?.cm.visibleRanges;
			// console.log('currentVisible', currentVisible);
			//
			// if (currentVisible && currentVisible[0]) {
			// 	console.log(currentVisible);
			// 	const currentData = this.editor?.cm.state.doc.toString().slice(
			// 		currentVisible[0].from,
			// 		currentVisible[0].to
			// 	);
			// 	if (this.range && !Array.isArray(this.range)) {
			// 		const fileData = await this.app.vault.read(file);
			//
			// 		const originData = this.data?.slice(
			// 			this.range?.from - 1,
			// 			this.range?.to + 1
			// 		);
			//
			// 		console.log('originData', originData, currentData, currentData !== originData);
			//
			// 		if (currentData && originData && currentData !== originData) {
			// 			targetData = fileData.replace(originData, currentData);
			// 		}
			// 	}
			// }
			//
			//
			// this.data = targetData;
			// await this.app.vault.modify(file, targetData);

			this.data = data;
			await this.app.vault.modify(file, data);
		}
	}, 400);

	longWaitUpdate = debounce((data: string) => {
		this.data = data;
	});

	createEditor(container: HTMLElement, path: string, data: string, range: {
		from: number,
		to: number,
		type: string
	}) {
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

					const prevLine = line > 0 ? editor.editor.getLine(line - 1) : "";

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
					} else if (/^\s+/g.test(lineText) && !(/^(-|\*|\d+\.)(\s\[.\])?/g.test(lineText.trim()))) {
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

					if (/^(-|\*|\d+\.)(\s\[.\])?/g.test(lineText.trim())) {
						const range = foldable(editor.editor.cm.state, editor.editor.posToOffset({
							line,
							ch: 0
						}), editor.editor.posToOffset({line: line + 1, ch: 0}) - 1);
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
										if (currentLine.to === range.to) {
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

					if (/^\s+/g.test(charLine.text) && !(/^(-|\*|\d+\.)(\s\[.\])?/g.test(charLine.text.trimStart()))) {
						const lineNum = charLine.number;

						for (let i = lineNum; i >= 1; i--) {
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
			onBlur: (editor, path) => {
				if (this.file && this.targetRange) {
					const data = editor.editor?.cm.state.doc.toString();
					// console.log('data', data, this.data, data === this.data);
					if (this.data === data) return;
					// this.file && this.requestSave(this.file, data);

					// if (!update.docChanged) return;
					// if (this.data === data) return;

					this.requestSave(this.file, data);
				}
			},
			onChange: (update, path) => {
				if (path) {
					if (!update.docChanged) return;
					if (this.data === update.state.doc.toString()) return;
					// if (this.editor?.activeCM.hasFocus) {
					// 	this.longWaitUpdate(update.state.doc.toString());
					// 	return;
					// }

					!this.targetRange && this.file && this.requestSave(this.file, update.state.doc.toString());
				}
			},
			toggleMode: () => {
				// @ts-expect-error
				const cmView = this.containerEl.cmView;
				if (cmView) {
					// console.log(cmView.widget.editor);
					cmView.widget.editor.owner.toggleMode();
				}
			},
			type: 'embed',
			value: data || "",
			path: this.file?.path
		});

		// embedEditor.editor.getValue = () => {
		// 	return this.data || "";
		// };


		this.range = {
			from: range.from,
			to: range.to
		};
		this.editor = embedEditor.editor;

		if (this.targetRange && !this.plugin.settings.livePreviewForBacklinks) {
			// console.log('targetRange', this.targetRange);
			this.editor?.editorComponent.toggleSource();

			// this.containerEl.onclick = (e) => {
			// 	e.stopPropagation();
			// 	// e.preventDefault();
			// 	new Notice('Click to toggle source mode');
			// };

		}

		// console.log('editor', this.editor);

		range.type !== 'whole' && this.updateVisibleRange(embedEditor.editor, range, range.type as 'part' | 'block' | 'heading');
		range.type === 'whole' && this.plugin.settings.hideFrontmatter && this.updateFrontMatterVisible(this.editor as Editor, this.file as TFile);

		// range.type === 'while' && this.editor?.editorComponent.toggleFrontMatter();

		if (range.type !== 'part') {
			const button = this.containerEl.createEl('div', {
				cls: 'source-btn',
			});

			new ExtraButtonComponent(button).setIcon('link');
		}

		// @ts-expect-error - This is a private method
		return this.addChild(embedEditor);
	}

	public updateRange(range: { from: number, to: number }) {
		this.range = {
			from: range.from,
			to: range.to
		};
		this.updateVisibleRange(this.editor as Editor, range, 'part');
		// this.updateIndentVisible(
		// 	this.editor as Editor,
		// 	range
		// );
	}


	updateVisibleRange(editor: Editor, range: { from: number, to: number } | {
		from: number,
		to: number
	}[], type: 'part' | 'block' | 'heading') {

		if (Array.isArray(range)) {
			const wholeRanges = range.map((r) => {
				return (this.calculateRangeForZooming.calculateRangeForZooming(editor.cm.state, r.from) || {
					from: r.from,
					to: r.to
				});
			});
			this.KeepOnlyZoomedContentVisible.keepRangesVisible(editor.cm, wholeRanges);

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
			// for(const r of range) {
			// 	editor.cm.dispatch({
			// 		effects: [zoomInEffect.of(r)]
			// 	});
			// }

		} else {
			// if(range.from === 0 && range.to === this.editor?.cm.state.doc.length) return;
			if (type === 'part') {
				console.log('range', range, this.targetRange, this.containerEl, this.data?.slice(
					range.from,
					range.to
				));
				editor.cm.dispatch({
					effects: [zoomInEffect.of({
						from: range.from,
						to: range.to,
						type: 'part',
						container: this.targetRange ? undefined : this.containerEl,
					})]
				});
				// this.updateIndentVisible(
				// 	editor,
				// 	range
				// );
				this.containerEl.toggleClass('embedded-part', true);
				return;
			}


			const newRange = this.calculateRangeForZooming.calculateRangeForZooming(editor.cm.state, range.from);

			// console.log('newRange', newRange, range);

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
			} else {
				editor.cm.dispatch({
					effects: [zoomInEffect.of(range)]
				});
			}

			// editor.cm.dispatch(
			// {
			// 	effects: [zoomInEffect.of(range)]
			// });
		}
	}


	getRange(targetFile: TFile) {
		const cache = this.app.metadataCache.getFileCache(targetFile);

		if (this.sourcePath && !this.subpath && this.targetRange) {
			return {
				from: this.targetRange.from,
				to: this.targetRange.to,
				type: 'part'
			};
		}

		if (this.sourcePath && !this.subpath) {
			const title = this.containerEl.getAttr('alt');

			if (title) {
				const content = this.data;
				const targetBlockId = `%%${title}%%`;

				// console.log('content', content, targetBlockId, title);

				if (!content) {
					return {
						from: 0,
						to: 0,
						type: 'whole'
					};
				}

				const start = content.indexOf(targetBlockId);
				const end = content.indexOf(targetBlockId, start + 1);

				if (start !== -1 && end !== -1) {
					return {
						from: start + targetBlockId.length + 1,
						to: end - 1,
						type: 'part'
					};
				}
			}
		}

		let targetRange = {
			from: 0,
			to: this.data?.length || 0,
			type: 'whole',
		};
		if (cache && this.subpath) {
			if (/#\^/.test(this.subpath)) {
				const id = this.subpath.slice(2);
				const block = Object.values(cache?.blocks || {}).find((key) => {
					return key.id === id;
				});
				if (block) {
					targetRange = {
						from: block.position?.start.offset,
						to: block.position?.end.offset,
						type: 'block'
					};

					// console.log('cache', cache, block);
				}

				// console.log('block', block);

				return targetRange;
			} else if (/^#/.test(this.subpath)) {
				const heading = this.subpath.slice(1);
				const headingBlock = Object.values(cache?.headings || {}).find((key) => {
					return heading.trim() && key.heading.replace(/((\[\[)|(\]\]))/g, '').trim() === heading.trim();
				});
				if (headingBlock) {
					targetRange = {
						from: headingBlock.position.start.offset,
						to: headingBlock.position.end.offset,
						type: 'heading'
					};
				}

				return targetRange;
			}
		}
		return targetRange;
	}


	updateIndentVisible(editor: Editor, range: { from: number, to: number }) {
		const firstLine = editor.cm.state.doc.lineAt(range.from);
		const firstLineIndent = firstLine.text.match(/^\s*/)?.[0];
		if (firstLineIndent) {
			editor.cm.dispatch({
				effects: zoomWithHideIndentEffect.of({
					range: {
						from: range.from,
						to: range.to,
					},
					indent: firstLineIndent
				})
			});
		}
	}

	updateFrontMatterVisible(editor: Editor, file: TFile) {
		const cache = this.app.metadataCache.getFileCache(file);
		const frontMatter = cache?.frontmatterPosition;

		console.log('frontMatter', frontMatter);
		if (frontMatter) {
			editor.cm.dispatch({
				effects: hideFrontMatterEffect.of({
					range: {
						from: frontMatter.start.offset,
						to: frontMatter.end.offset,
					}
				})
			});
		}

	}
}
