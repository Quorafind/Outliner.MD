import { App, Component, debounce, Editor, ExtraButtonComponent, MarkdownRenderer, TFile } from "obsidian";

export class EmbeddedRender extends Component {
	app: App;
	editor: Editor | undefined;

	file: TFile | undefined;
	subpath: string | undefined;
	data: string | undefined;

	sourcePath: string;
	sourceFile: TFile | undefined;

	childComponent: Component | undefined;

	containerEl: HTMLElement;

	range: { from: number; to: number; } | undefined;

	constructor(e: {
		sourcePath: string;
		app: App;
		containerEl: HTMLElement;
	}, file: TFile, subpath: string) {
		super();
		this.app = e.app;
		this.containerEl = e.containerEl;

		this.sourcePath = e.sourcePath;
		this.file = file;
		this.subpath = subpath;
	}

	async onload() {
		super.onload();

		const targetFile = this.file;
		targetFile && this.app.vault.read(targetFile).then((data) => {
			this.data = data;
			if (!targetFile) return;

			const targetRange = this.getRange(targetFile);

			this.createEmbed(this.containerEl, targetFile?.path, this.data || "", targetRange);
		});

		this.registerEvent(this.app.metadataCache.on('changed', (file) => {
			this.childComponent && this.updateFile(file);
		}));
	}

	updateFile = debounce((file: TFile) => {
		if (file.path === this.file?.path) {
			this.app.vault.read(file).then(async (data) => {
				if (this.data === data) return;
				this.data = data;

				const targetRange = this.getRange(file);
				this.range = {
					from: targetRange.from,
					to: targetRange.to
				};

				this.childComponent && await this.updateContent(data, this.containerEl, file.path, this.childComponent);
				// this.createEmbed(this.containerEl, file.path, this.data || "", targetRange);

			});
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

	async updateContent(
		content: string,
		container: HTMLElement,
		path: string,
		childComponent: Component
	) {
		await MarkdownRenderer.render(this.app, content, container, path, childComponent);
	}

	async createEmbed(container: HTMLElement, path: string, data: string, range: {
		from: number,
		to: number,
		type: string
	}) {
		this.childComponent = new Component();
		const content = data.slice(range.from, range.to + 1);

		await MarkdownRenderer.render(this.app, content, container, path, this.childComponent);

		this.range = {
			from: range.from,
			to: range.to
		};

		const button = this.containerEl.createEl('div', {
			cls: 'source-btn',
		});

		this.containerEl.toggleClass('embedded-part', true);

		new ExtraButtonComponent(button).setIcon('link').onClick(async () => {
			const leaf = this.app.workspace.getLeaf();
			await leaf.setViewState({
				type: 'markdown',
			});
			this.file && await leaf.openFile(this.file);
		});
		return this.addChild(this.childComponent);
	}

	getRange(targetFile: TFile) {
		const cache = this.app.metadataCache.getFileCache(targetFile);

		if (this.sourcePath && !this.subpath) {
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
						type: 'part',
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
					return heading.trim() && key.heading.trim() === heading.trim();
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
}
