import { StateEffect, StateField } from "@codemirror/state";
import { EditorView, showPanel } from "@codemirror/view";

import { renderHeader } from "./utils/renderHeader";
import { Section } from "./CollectSections";
import { zoomInEffect, zoomOutEffect } from "./VisibleRangeController";
import { getAllSectionsRangeAndName } from "./utils/getRangeBetweenNextMark";
import { Component, editorInfoField, Notice, TFile } from "obsidian";
import OutlinerViewPlugin from "../OutlinerViewIndex";
import "../less/sections-tabs.less";
import { splitIntoNotes } from "./utils/splitIntoNotes";

interface SectionState {
	sections: Section[];
	selected: number;
	onClick: (view: EditorView, pos: { start: number; end: number; index: number } | null) => void;
	createSection: (view: EditorView) => void;
}

const showSectionsEffect = StateEffect.define<SectionState>();
const hideSectionsEffect = StateEffect.define<void>();

const selectSectionEffect = StateEffect.define<number>();

const tabState = StateField.define<SectionState | null>({
	create: () => null,
	update: (value, tr) => {

		if (tr.docChanged && value) {
			const sections = getAllSectionsRangeAndName({state: tr.state});

			return {
				...value,
				sections: sections,
				selected: value.selected,
			};
		}

		for (const e of tr.effects) {
			if (e.is(selectSectionEffect) && value?.sections && typeof e.value === "number") {
				value = {
					...value,
					selected: e.value
				};
			}

			if (e.is(showSectionsEffect)) {
				value = e.value;
			}
			if (e.is(hideSectionsEffect)) {
				value = null;
			}
		}
		return value;
	},
	provide: (f) =>
		showPanel.from(f, (state) => {
			if (!state) {
				return null;
			}

			return (view) => ({
				top: true,
				dom: renderHeader(view.dom, {
					view: view,
					sections: state.sections,
					selected: state.selected,
					onClick: (pos) => state.onClick(view, pos),
					createSection: () => state.createSection(view),
				}),
			});
		}),
});

export class RenderNavigationHeader extends Component {
	private index = 0;
	private zoomed = false;

	private type: 'outliner' | 'lineage' = 'outliner';
	private sections: Section[] = [];

	plugin: OutlinerViewPlugin;

	indexMap: Map<string, string> = new Map();

	getExtension() {
		return tabState;
	}

	constructor(plugin: OutlinerViewPlugin) {
		super();
		this.plugin = plugin;
	}

	onload() {
		super.onload();

		this.registerEvent(this.plugin.app.workspace.on("zoom-into-section", (view: EditorView, pos: number) => {
			const sections = getAllSectionsRangeAndName({state: view.state});
			console.log(sections);

			const section = sections.find(section => section.start <= pos && pos <= section.end);
			if (section) {
				this.onClick(view, {
					start: section.start,
					end: section.end,
					index: sections.indexOf(section)
				});
			}
		}));


		this.registerEvent(this.plugin.app.workspace.on("files-menu", (menu, files) => {
			menu.addItem((item) => {
				item.setTitle("Merge notes into sections");
				item.setIcon("merge");
				item.onClick(async (e) => {
					const markdownFiles = files.filter((file) => file instanceof TFile && file.extension === "md") as TFile[];

					let content = "";
					for (const file of markdownFiles) {
						content += `\n\n%%SECTION{${file.basename}}%%\n`;

						const pos = this.plugin.app.metadataCache.getFileCache(file)?.frontmatterPosition;
						if (pos) {
							const temp = await this.plugin.app.vault.cachedRead(file);
							content += temp.slice(pos.end.offset + 1).trim();
						} else {
							content += (await this.plugin.app.vault.read(file)).trim();
						}

					}

					const folder = this.plugin.app.fileManager.getMarkdownNewFileParent();
					const newFile = await this.plugin.app.fileManager.createNewMarkdownFile(folder, "merged-notes");
					await this.plugin.app.vault.modify(newFile, content);

					new Notice('Sections are merged into a single file');
				});
			});

		}));


		this.plugin.addCommand({
			id: "show-section-tabs",
			name: "Show section tabs",
			editorCallback: (editor) => {
				this.showSectionTabs(editor.cm, getAllSectionsRangeAndName({state: editor.cm.state}));
			},
		});

		this.plugin.addCommand({
			id: "hide-section-tabs",
			name: "Hide section tabs",
			editorCallback: (editor) => {
				this.hideSectionTabs(editor.cm);
			},
		});

		this.plugin.addCommand({
			id: 'zoom-in-section-contains-cursor',
			name: 'Zoom in section contains cursor',
			editorCheckCallback: (checking, editor, ctx) => {
				const sections = getAllSectionsRangeAndName({state: editor.cm.state});

				if (sections.length > 0) {
					if (!checking) {
						const cursor = editor.getCursor();
						const pos = editor.posToOffset(cursor);

						const section = sections.find(section => section.start <= pos && pos <= section.end);
						if (section) {
							this.onClick(editor.cm, {
								start: section.start,
								end: section.end,
								index: sections.indexOf(section)
							});
						}
					}

					return true;
				}


			}
		});

		this.plugin.addCommand({
			id: "create-section-end",
			name: "Create section at end",
			editorCallback: (editor) => {
				this.createSection(editor.cm, 'end');
			},
		});

		this.plugin.addCommand({
			id: "create-section-start",
			name: "Create section at start",
			editorCallback: (editor) => {
				this.createSection(editor.cm, 'start');
			},
		});

		this.plugin.addCommand({
			id: "create-section-before",
			name: "Create section before",
			editorCallback: (editor) => {
				this.createSection(editor.cm, 'before');
			},
		});

		this.plugin.addCommand({
			id: "create-section-after",
			name: "Create section after",
			editorCallback: (editor) => {
				this.createSection(editor.cm, 'after');
			},
		});

		this.plugin.addCommand({
			id: "select-next-section",
			name: "Select next section",
			editorCallback: (editor) => {
				this.selectNextSection(editor.cm);
			},
		});

		this.plugin.addCommand({
			id: "select-prev-section",
			name: "Select previous section",
			editorCallback: (editor) => {
				this.selectPrevSection(editor.cm);
			},
		});

		this.plugin.addCommand({
			id: "split-sections-in-notes-to-links",
			name: "Split sections in notes and link them",
			editorCallback: async (editor) => {
				await splitIntoNotes(editor, this.plugin, 'link');
				this.onClick(editor.cm, null);

				new Notice('Sections are split into new files');
			},
		});

		this.plugin.addCommand({
			id: "split-sections-in-notes-to-embeds",
			name: "Split sections in notes and embed them",
			editorCallback: async (editor) => {

				await splitIntoNotes(editor, this.plugin, 'embed');
				this.onClick(editor.cm, null);

				new Notice('Sections are split into new files');
			},
		});

		this.plugin.addCommand({
			id: "show-whole-document",
			name: "Show whole document",
			editorCallback: (editor) => {
				this.onClick(editor.cm, null);
			},
		});
	}

	private selectNextSection(view: EditorView) {
		const sections = getAllSectionsRangeAndName({state: view.state});
		if (sections.length === 0) {
			return;
		}
		// Check if zoomed already, if not, do not change the index

		this.sections = sections;
		const selected = view.state.field(tabState)?.selected;
		if (selected !== undefined) {
			this.index = selected;
		}

		this.index = !this.zoomed ? this.index : (this.index + 1) % sections.length;
		this.onClick(view, {
			start: sections[this.index].start,
			end: sections[this.index].end,
			index: this.index
		});
	}

	private selectPrevSection(view: EditorView) {
		const sections = getAllSectionsRangeAndName({state: view.state});
		if (sections.length === 0) {
			return;
		}

		this.sections = sections;
		const selected = view.state.field(tabState)?.selected;
		if (selected !== undefined) {
			this.index = selected;
		}

		this.index = !this.zoomed ? this.index : (this.index - 1 + sections.length) % sections.length;


		this.onClick(view, {
			start: sections[this.index].start,
			end: sections[this.index].end,
			index: this.index
		});
	}


	public showSectionTabs(view: EditorView, sections: Section[], selected: number = 0) {
		view.dispatch({
			effects: [
				showSectionsEffect.of({
					sections: sections,
					selected: selected,
					onClick: this.onClick,
					createSection: this.createSection,
				}),
			],
		});
	}

	public hideSectionTabs(view: EditorView) {
		view.dispatch({
			effects: [hideSectionsEffect.of(), zoomOutEffect.of(), selectSectionEffect.of(-1)],
		});
		view.state.field(editorInfoField).editor?.editorComponent?.sizerEl.toggleClass('hide-sections-tabs', false);
	}

	private onClick = (view: EditorView, pos: {
		start: number
		end: number,
		index: number
	} | null) => {
		if (pos === null) {
			this.showTitle(view);
			view.dispatch({effects: [zoomOutEffect.of(), selectSectionEffect.of(-1)]});

			this.index = 0;

			setTimeout(() => {
				view.scrollDOM.scrollTo(0, 0);
			});


		} else {

			view.dispatch({
				effects: [zoomInEffect.of({
					from: pos.start,
					to: pos.end,
					type: "block"
				}), selectSectionEffect.of(pos.index)],
			});

			this.index = pos.index;
			this.hideTitle(view);
		}
	};

	private hideTitle = (view: EditorView) => {
		this.zoomed = true;
		view.state.field(editorInfoField).editor?.editorComponent?.sizerEl.toggleClass('hide-sections-tabs', true);
	};

	private showTitle = (view: EditorView) => {
		this.zoomed = false;
		view.state.field(editorInfoField).editor?.editorComponent?.sizerEl.toggleClass('hide-sections-tabs', false);
	};

	private createSection = (view: EditorView, position: 'before' | 'after' | 'end' | 'start' = 'end') => {
		const sections = getAllSectionsRangeAndName({state: view.state});
		const selected = view.state.field(tabState)?.selected;
		if (selected !== undefined) {
			this.index = selected;
		}

		let newSection = `\n\n%%SECTION{New Section}%%\n\n`;
		if (sections.length > 0 && sections[0].type === 'lineage') {
			const lastnumber = this.sections[this.sections.length - 1].name.match(/section: (\d)/);
			newSection = lastnumber ? `\n\n<!--section: ${+lastnumber[1] + 1}-->\n\n` : `\n\n<!--section: 1-->\n\n`;
		}

		let to = view.state.doc.length;

		if (!this.zoomed) {
			view.dispatch({
				changes: [
					{
						from: to,
						to: to,
						insert: newSection
					}
				]
			});
		} else {
			switch (position) {
				case "end": {
					view.dispatch({
						changes: [
							{
								from: to,
								to: to,
								insert: newSection
							}
						]
					});
					break;
				}
				case "start": {
					if (sections.length > 0) {
						const firstSection = sections[0];
						to = view.state.doc.lineAt(firstSection.start - 1).from === 0 ? 0 : (view.state.doc.lineAt(firstSection.start - 1).from - 1);
					}
					view.dispatch({
						changes: [
							{
								from: to,
								to: to,
								insert: newSection
							}
						]
					});
					break;
				}
				case "before": {
					if (sections.length > 0) {
						to = view.state.doc.lineAt(sections[this.index].start - 1).from === 0 ? 0 : (view.state.doc.lineAt(sections[this.index].start - 1).from - 1);
					}

					view.dispatch({
						changes: [
							{
								from: to,
								to: to,
								insert: newSection
							}
						]
					});
					break;
				}

				case "after": {
					if (sections.length > 0) {
						to = view.state.doc.lineAt(sections[this.index].end).to;

					}
					view.dispatch({
						changes: [
							{
								from: to,
								to: to,
								insert: newSection
							}
						]
					});
					break;
				}
				default: {
					view.dispatch({
						changes: [
							{
								from: to,
								to: to,
								insert: newSection
							}
						]
					});
					break;
				}
			}
		}

		setTimeout(() => {
			const sections = getAllSectionsRangeAndName({state: view.state});

			let selected = sections.length - 1;
			switch (position) {
				case "end": {
					selected = sections.length - 1;
					break;
				}
				case "start": {
					selected = 0;
					break;
				}
				case "before": {
					selected = sections.length > 1 ? (this.index > 0 ? this.index : 0) : 0;
					break;
				}
				case "after": {
					selected = sections.length > 1 ? this.index + 1 : 0;
					break;
				}
				default: {
					selected = sections.length - 1;
					break;
				}
			}

			view.dispatch({
				effects: [zoomInEffect.of({
					from: to + newSection.length - 1,
					to: to + newSection.length,
					type: "block",
				}), showSectionsEffect.of({
					sections: sections,
					selected: selected,
					onClick: this.onClick,
					createSection: this.createSection,
				})]
			});
			this.index = selected;
			this.hideTitle(view);
		}, 20);
	};
}
