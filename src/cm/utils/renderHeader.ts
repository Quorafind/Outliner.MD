import { Section } from "../CollectSections";
import {
	App,
	ButtonComponent,
	Component,
	debounce,
	editorInfoField,
	ExtraButtonComponent,
	Menu,
	Modal
} from "obsidian";
import { EditorView } from "@codemirror/view";

export function renderHeader(
	doc: HTMLElement,
	ctx: {
		view: EditorView;
		sections: Section[];
		selected: number;
		onClick: (pos: {
			start: number;
			end: number;
			index: number;
		} | null) => void;
		createSection: () => void;
	}
) {
	const {sections, selected, onClick, createSection, view} = ctx;

	const parentContainer = doc.createEl("div", "omd-container");
	new TabsContainer({
		parentContainer,
		sections,
		selected,
		onClick,
		createSection,
		view
	}).onload();

	return parentContainer;
}


class TabsContainer extends Component {
	parentContainer: HTMLElement;
	sections: Section[];
	onClick: (pos: {
		start: number;
		end: number;
		index: number;
	} | null) => void;
	createSection: () => void;
	selected: number | null = null;
	view: EditorView;

	currentTab: HTMLElement | null = null;
	app: App;

	constructor({parentContainer, sections, selected, onClick, createSection, view}: {
		parentContainer: HTMLElement;
		sections: Section[];
		selected: number | null;
		onClick: (pos: {
			start: number;
			end: number;
			index: number;
		} | null) => void;
		createSection: () => void;
		view: EditorView;
	}) {
		super();
		this.parentContainer = parentContainer;
		this.sections = sections;
		this.selected = selected;
		this.onClick = onClick;
		this.createSection = createSection;
		this.view = view;

		this.app = this.view.state.field(editorInfoField).app;
	}

	onload() {
		this.parentContainer.createEl("div", "omd-section-tab-container", (container) => {
			for (let i = 0; i < this.sections.length; i++) {
				const sectionTab = this.sections[i];
				container.createEl('div', "omd-section-tab", (o) => {
					o.dataset.start = String(sectionTab.start);
					o.dataset.end = String(sectionTab.end);

					const button = new ButtonComponent(o).setButtonText(sectionTab.name);

					if (this.selected === i) {
						this.currentTab = o;
						this.currentTab.toggleClass('omd-section-tab-active', true);
					}

					button.onClick((e) => {
						e.preventDefault();
						const start = o.dataset.start;
						const end = o.dataset.end;
						if (start && end && this.selected !== i) {
							this.onClick({start: +start, end: +end, index: i});
						} else {
							this.onClick(null);
						}

						if (this.currentTab) {
							this.currentTab.toggleClass('omd-section-tab-active', false);
						}
						this.currentTab = o;
						this.currentTab.toggleClass('omd-section-tab-active', true);
					});

					this.registerDomEvent(o, 'mouseover', (e) => {
						debouncedMouseover(this.view, e, o, this.app);
					});


					this.registerDomEvent(o, 'contextmenu', (e) => {
						e.preventDefault();
						const menu = new Menu();

						menu
							.addItem((item) => {
								item.setDisabled(this.sections[i].type === 'lineage').setSection('action').setIcon('pencil').setTitle("Rename").onClick(() => {
									new RenameModal(this.app, (name) => {
										const section = this.sections[i];

										const originalNameLine = this.view.state.doc.lineAt(section.start - 1);
										const newNameLine = originalNameLine.text.replace(/%%SECTION\{.*?\}%%/, `%%SECTION{${name}}%%`);

										this.view.dispatch({
											changes: [
												{
													from: originalNameLine.from,
													to: originalNameLine.to,
													insert: newNameLine
												}
											]
										});
									}).open();
								});
							})
							.addItem((item) => {
								item.setSection('danger').setIcon('trash').setTitle("Delete").onClick(() => {
									const section = this.sections[i];

									const startLine = this.view.state.doc.lineAt(section.start - 1);
									const endLine = this.view.state.doc.lineAt(section.end);

									this.view.dispatch({
										changes: [
											{
												from: startLine.from,
												to: endLine.to === this.view.state.doc.length ? endLine.to : endLine.to + 2,
												insert: ''
											}
										]
									});

									if (this.selected === i) {
										this.onClick(null);
									}
								});
								(item as any).dom.toggleClass('is-warning', true);
							});

						menu.showAtMouseEvent(e);
					});
				});
			}
		});

		this.parentContainer.createEl('div', "omd-section-tab-add-button", (container) => {
			const button = new ExtraButtonComponent(container).setIcon("plus").setTooltip("Add section");
			button.onClick(() => {
				// this.onClick(null);
				this.createSection();
			});
		});

		this.parentContainer.createEl('div', 'omd-section-tab-spacer');

		this.parentContainer.createEl('div', "omd-back-to-full", (o) => {
			const button = new ExtraButtonComponent(o).setIcon("book-open-text").setTooltip("Back to full document");
			button.onClick(() => {
				this.currentTab?.toggleClass('omd-section-tab-active', false);
				this.onClick(null);
			});
		});
	}

	onunload() {
		this.parentContainer.empty();
	}
}

class RenameModal extends Modal {
	constructor(app: App, readonly cb: (name: string) => void) {
		super(app);
	}

	onOpen() {
		this.setTitle("Rename section");

		this.contentEl.toggleClass('omd-section-rename', true);

		const frag = document.createDocumentFragment();
		const input = frag.createEl("textarea", {
			cls: "rename-textarea",
			attr: {
				rows: "1",
			}
		});
		frag.createEl("div", "modal-button-container", (el) => {
			const button = new ButtonComponent(el).setCta().setButtonText("Rename");
			button.onClick(() => {
				const value = input.value;
				if (value) {
					this.cb(value);
					this.close();
				}
			});

			const cancelButton = new ButtonComponent(el).setButtonText("Cancel");
			cancelButton.buttonEl.toggleClass('mod-cancel', true);
			cancelButton.onClick(() => {
				this.close();
			});
		});


		this.setContent(frag);
	}

	onClose() {
		this.contentEl.empty();
	}
}

const debouncedMouseover = debounce((view: EditorView, e: MouseEvent, o: HTMLElement, app: App) => {
	const file = view.state.field(editorInfoField).file;
	if (!file) return;
	//
	// const line = this.view.state.doc.lineAt(sectionTab.start + 1);
	// const state = {
	// 	scroll: line.number
	// };

	// console.log("hovering", file.path, state);

	app.workspace.trigger("hover-link", {
		event: e,
		source: "outliner-md",
		hoverParent: view.dom,
		targetEl: o,
		linktext: file.path,
		// state: state
	});
}, 200);
