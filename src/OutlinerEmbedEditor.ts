import { App, Component, debounce, Editor, setIcon, TFile } from "obsidian";
import { EmbeddableMarkdownEditor } from "./embedEditor";
import { CalculateRangeForZooming, getIndent } from "./utils";
import OutlinerViewPlugin from "./main";
import { ClearSearchHighlightEffect } from "./SearchHighlight";
import { KeepOnlyZoomedContentVisible, zoomInEffect, zoomWithHideIndentEffect } from "./checkVisible";
import { getAPI } from "obsidian-dataview";


export class OutlinerEmbedEditor extends Component {
	app: App;
	editor: Editor;
	filePath: string;
	file: TFile | null;

	data: string;
	range: { from: number, to: number };

	calculateRangeForZooming = new CalculateRangeForZooming();
	KeepOnlyZoomedContentVisible = new KeepOnlyZoomedContentVisible();

	contentMap: Map<string, string> = new Map();
	editorMap: Map<string, Editor> = new Map();

	indexed: boolean = false;

	changedBySelf: boolean = false;

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
			this.app.metadataCache.on("dataview:metadata-change", (type, file, oldPath?) => {
					if (!this.indexed) return;
					console.log(type, file, oldPath);

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
					} else if (!lineText.trim()) {
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
					}
				}
				return false;
			},
			onDelete: (editor) => {
				const {line, ch} = (editor.editor as Editor).getCursor();
				const lineText = editor.editor.getLine(line);
				if (/^(\s*?)((-|\*|\d+\.)(\s\[.\])?)\s/g.test(lineText) && /^((-|\*|\d+\.)(\s\[.\])?)$/g.test(lineText.trim())) {
					if (line === 0) {
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


				console.log('content', update.state.doc.toString());

				if (path) {
					if (!update.docChanged) return;
					if (this.contentMap.get(path) === update.state.doc.toString()) return;


					if (this.changedBySelf) {
						this.changedBySelf = false;
						return;
					}


					this.requestSave(path, update.state.doc.toString());
				}
			},
			type: 'embed',
			value: data || "",
			path: path,
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

	async initEditor() {
		const api = getAPI(this.app);
		const result = await api.query(`TASK  
FROM ""  
WHERE contains(text, "#now")
GROUP BY file.path`);

		if (!result.successful) return;
		const values = result.value.values;

		for (let v of values) {
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

			if (this.app.vault.getFileByPath(v.key)) {
				const file = this.app.vault.getFileByPath(v.key);

				const ranges = v.rows.map((r) => {
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
	}

	debounceUpdateEditor = debounce((file: TFile, oldPath?: string) => {
		this.updateEditor(file, oldPath);
	}, 1000);

	async updateEditor(file: TFile, oldPath?: string) {

		const api = getAPI(this.app);

		const result = await api.query(`TASK  
FROM ""  
WHERE contains(text, "#now")
GROUP BY file.path`);

		if (!result.successful) return;

		console.log(result);

		const values = result.value.values;

		for (let v of values) {
			const ranges = v.rows.map((r) => {
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

					console.log('data in file', data, ranges);


					const lastContent = this.contentMap.get(targetFile.path);
					if (lastContent !== data) {
						console.log('changed', lastContent, data);

						if (this.contentMap.has(targetFile.path)) {
							this.contentMap.set(targetFile.path, data);
						}

						this.changedBySelf = true;
						// const endPos = editor.offsetToPos((lastContent || editor.getValue()).length);
						const lastLineofEditor = editor.lastLine();
						const lastLine = editor.getLine(lastLineofEditor);
						editor.replaceRange(data, {line: 0, ch: 0}, {line: lastLineofEditor, ch: lastLine.length});
						this.contentMap.set(targetFile.path, data);

						const values = result.value.values;
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
