import { App, Component, debounce, Editor, ExtraButtonComponent, Keymap, TFile } from "obsidian";
import { CalculateRangeForZooming } from "../../cm/CalculateRangeForZooming";
import { EmbeddableMarkdownEditor } from "../../editor-components/MarkdownEditor";
import { getIndent } from "../../utils/utils";
import { foldable } from "@codemirror/language";
import { hideFrontMatterEffect, zoomInEffect, zoomWithHideIndentEffect } from "../../cm/VisibleRangeController";
import { KeepRangeVisible } from "../../cm/KeepRangeVisible";
import OutlinerViewPlugin from "../../OutlinerViewIndex";
import { EditorState } from "@codemirror/state";
import { handleRegularEnter, handleShiftEnter } from "../../utils/keyDownHandler";

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
	KeepOnlyZoomedContentVisible = new KeepRangeVisible();

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


			// const embedEl = this.containerEl.createEl('div', {
			// 	cls: 'embedded-editor-container',
			// });

			this.createEditor(this.containerEl, targetFile?.path, this.data || "", targetRange);
		});

		if (this.initData && targetFile && this.targetRange) {
			this.data = this.initData;
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

			this.data = data;
			// const lastLine = this.editor?.cm.state.doc.lineAt(this.editor?.cm.state.doc.length - 1);
			this.editor?.replaceRange(data, {
				line: 0,
				ch: 0
			}, this.editor.offsetToPos(this.editor.cm.state.doc.length));

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


	debounceHover = debounce((extraButton: ExtraButtonComponent, e: MouseEvent) => {
		if (!this.file) return;
		// console.log("hovering", file.path, state);

		this.app.workspace.trigger("hover-link", {
			event: e,
			source: "outliner-md",
			hoverParent: this.containerEl,
			targetEl: extraButton.extraSettingsEl,
			linktext: this.file.path,
		});
	}, 200);

	requestSave = debounce(async (file: TFile, data: string) => {
		if (file) {
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
			onEnter: (editor, mod: boolean, shift: boolean) => {
				if (!editor.view) return false;

				const editorInstance = editor.editor as Editor;
				const cursor = editorInstance.getCursor();
				const {line, ch} = cursor;
				const lineText = editorInstance.getLine(line);

				if (shift) {
					return handleShiftEnter(editorInstance, line, lineText);
				}

				return handleRegularEnter(editorInstance, line, ch, lineText);
			},
			onDelete: (editor) => {
				if (!editor.view) return false;
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
				if (!editor.view) return false;
				if (shift) {
					const range = this.app.plugins.getPlugin('obsidian-zoom')?.getZoomRange(editor.editor);

					if (range) {
						const firstLineInRange = range.from.line;
						const lastLineInRange = range.to.line;

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
			path: this.file?.path,
			disableTimeFormat: !this.plugin.settings.timeFormatWidget,
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
		}

		if (this.targetRange) {
			const backlinkBtn = this.containerEl.createEl('div', {
				cls: 'backlink-btn',
			});

			const extraButton = new ExtraButtonComponent(backlinkBtn).setIcon('file-symlink');

			this.registerDomEvent(extraButton.extraSettingsEl, 'mouseover', (e) => {
				if (!this.file || !this.targetRange) return;
				const line = this.editor?.cm.state.doc.lineAt(this.targetRange.from + 1);

				if (!line) return;
				const state = {
					scroll: line.number
				};

				// console.log("hovering", file.path, state);

				this.app.workspace.trigger("hover-link", {
					event: e,
					source: "outliner-md",
					hoverParent: this.containerEl,
					targetEl: extraButton.extraSettingsEl,
					linktext: this.file.path,
					state: state
				});
			});
		}

		range.type !== 'whole' && this.updateVisibleRange(embedEditor.editor, range, range.type as 'part' | 'block' | 'heading');
		range.type === 'whole' && this.plugin.settings.hideFrontmatter && this.updateFrontMatterVisible(this.editor as Editor, this.file as TFile);

		// range.type === 'while' && this.editor?.editorComponent.toggleFrontMatter();


		const title = this.containerEl.getAttr('alt');
		if (title) {
			if (title === 'readonly' || title.contains('readonly')) {
				this.editor?.cm.dispatch({
					effects: [embedEditor.readOnlyDepartment.reconfigure(EditorState.readOnly.of(true))]
				});

				this.containerEl.toggleClass('readonly', true);

				const button = this.containerEl.createEl('div', {
					cls: 'lock-btn',
				});

				let locked = true;

				const component = new ExtraButtonComponent(button).setIcon('lock').onClick(() => {
					this.editor?.cm.dispatch({
						effects: embedEditor.readOnlyDepartment.reconfigure(EditorState.readOnly.of(!locked))
					});

					locked = !locked;
					component.setIcon(locked ? 'lock' : 'unlock');
					this.containerEl.toggleClass('readonly', locked);
				});
			}
		}

		if (range.type !== 'part') {
			const button = this.containerEl.createEl('div', {
				cls: 'source-btn embedded-editor-btn',
			});

			const extraButton = new ExtraButtonComponent(button).setIcon('link');

			this.registerDomEvent(extraButton.extraSettingsEl, 'click', async (e) => {
				if (Keymap.isModEvent(e)) {
					const leaf = this.app.workspace.getLeaf();
					await leaf.setViewState({
						type: 'markdown',
					});
					this.file && await leaf.openFile(this.file);
				}
			});

			this.registerDomEvent(extraButton.extraSettingsEl, 'mouseover', (e) => this.debounceHover(extraButton, e));
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

				const cache = this.app.metadataCache.getFileCache(this.file as TFile);

				const blockCache = cache?.sections?.find((key) => {
					return key.type === 'table' && key.position.start.offset < range.from && key.position.end.offset > range.to;
				});

				if (blockCache) {
					this.editor?.editorComponent.toggleSource();
				}

				editor.cm.dispatch({
					effects: [zoomInEffect.of({
						from: range.from,
						to: range.to,
						type: 'part',
						container: this.targetRange ? undefined : this.containerEl,
					})]
				});

				// this.editor?.editorComponent.toggleSource();
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

		if (!this.subpath && this.targetRange) {
			return {
				from: this.targetRange.from,
				to: this.targetRange.to,
				type: 'part'
			};
		}

		if (!this.subpath) {


			const title = this.containerEl.getAttr('alt')?.replace('readonly', '');

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
