import { App, Component, debounce, Editor, TFile } from "obsidian";
import { EmbeddableMarkdownEditor } from "./MarkdownEditor";
import { editorRangeUtils } from "../utils/editorRangeUtils";
import {
	handleDelete,
	handleEnterWithZoom,
	handleIndent,
	handleRegularEnter,
	handleShiftEnter,
} from "../utils/editorEventHandlers";
import { EditorState } from "@codemirror/state";
import OutlinerViewPlugin from "../OutlinerViewIndex";

/**
 * Editor types supported by the factory
 */
export enum EditorType {
	EMBEDDED = "embed",
	OUTLINER = "outliner",
	TASK_GROUP = "task-group",
}

/**
 * Shared editor configuration options
 */
export interface EditorFactoryOptions {
	app: App;
	containerEl: HTMLElement;
	file?: TFile;
	subpath?: string;
	targetRange?: { from: number; to: number };
	path?: string;
	data?: string;
	foldByDefault?: boolean;
	disableTimeFormat?: boolean;
	sourcePath?: string;
	plugin?: OutlinerViewPlugin;
	readOnly?: boolean;
	onSave?: (file: TFile, data: string) => void;
	type?: EditorType;
}

/**
 * Factory for creating different types of editors with shared configuration
 */
export class EditorFactory {
	/**
	 * Creates an editor based on the specified type and options
	 */
	static createEditor(
		type: EditorType,
		options: EditorFactoryOptions
	): {
		editor: Editor;
		component: Component;
		updateRange?: (range: { from: number; to: number }) => void;
	} {
		switch (type) {
			case EditorType.EMBEDDED:
				return this.createEmbeddedEditor({
					...options,
					type: EditorType.EMBEDDED,
				});
			case EditorType.TASK_GROUP:
				return this.createTaskGroupEditor({
					...options,
					type: EditorType.EMBEDDED,
				});
			case EditorType.OUTLINER:
				return this.createOutlinerEditor({
					...options,
					type: EditorType.OUTLINER,
				});
			default:
				throw new Error(`Unsupported editor type: ${type}`);
		}
	}

	/**
	 * Creates an embedded editor
	 */
	private static createEmbeddedEditor(options: EditorFactoryOptions) {
		const {
			app,
			containerEl,
			file,
			subpath,
			targetRange,
			data,
			readOnly = false,
		} = options;

		// Create a component to host the editor
		const component = new Component();

		if (!file) {
			throw new Error("File is required for embedded editor");
		}

		// If we have data, create the editor right away
		if (data) {
			const range = targetRange
				? { from: targetRange.from, to: targetRange.to, type: "part" }
				: editorRangeUtils.getRange(
						app,
						file,
						subpath,
						undefined,
						data
				  );

			const editor = this.createEditorInstance(
				app,
				containerEl,
				file.path,
				data,
				range,
				options,
				component,
				readOnly
			);

			return {
				editor,
				component,
				updateRange: (range: { from: number; to: number }) => {
					editorRangeUtils.updateVisibleRange(editor, range, "part");
				},
			};
		}

		// Otherwise, read the file and then create the editor
		let editor: Editor;
		app.vault.read(file).then((fileData) => {
			const range = editorRangeUtils.getRange(
				app,
				file,
				subpath,
				targetRange,
				fileData
			);
			editor = this.createEditorInstance(
				app,
				containerEl,
				file.path,
				fileData,
				range,
				options,
				component,
				readOnly
			);

			// Set up save debouncing
			if (options.onSave) {
				const debouncedSave = debounce((file: TFile, data: string) => {
					options.onSave!(file, data);
				}, 400);

				// Register event listener for file changes
				component.registerEvent(
					app.metadataCache.on("changed", (changedFile) => {
						if (changedFile.path === file.path) {
							app.vault.read(changedFile).then((newData) => {
								if (editor && editor.getValue() !== newData) {
									editor.setValue(newData);
									debouncedSave(changedFile, newData);
								}
							});
						}
					})
				);
			}
		});

		return {
			// Editor will be defined after async file reading
			get editor() {
				return editor;
			},
			component,
			updateRange: (range: { from: number; to: number }) => {
				if (editor) {
					editorRangeUtils.updateVisibleRange(editor, range, "part");
				}
			},
		};
	}

	/**
	 * Creates a task group editor
	 */
	private static createTaskGroupEditor(options: EditorFactoryOptions) {
		const { app, containerEl, file, data } = options;

		if (!file) {
			throw new Error("File is required for task group editor");
		}

		// Create a component to host the editor
		const component = new Component();

		// Create the editor
		const editor = this.createEditorInstance(
			app,
			containerEl,
			file.path,
			data || "",
			{ from: 0, to: (data || "").length, type: "whole" },
			{ ...options, foldByDefault: true },
			component
		);

		return { editor, component };
	}

	/**
	 * Creates an outliner editor
	 */
	private static createOutlinerEditor(options: EditorFactoryOptions) {
		const { app, containerEl, file, data } = options;

		// Create a component to host the editor
		const component = new Component();

		// Create the editor
		const editor = this.createEditorInstance(
			app,
			containerEl,
			file?.path || "",
			data || "",
			{ from: 0, to: (data || "").length, type: "whole" },
			{ ...options, foldByDefault: true },
			component
		);

		return { editor, component };
	}

	/**
	 * Creates an editor instance with the given options
	 */
	private static createEditorInstance(
		app: App,
		containerEl: HTMLElement,
		path: string,
		data: string,
		range: { from: number; to: number; type: string },
		options: EditorFactoryOptions,
		component: Component,
		readOnly: boolean = false
	): Editor {
		const { foldByDefault = false, disableTimeFormat = false } = options;

		// Create the shared event handlers
		const requestSave = debounce(async (file: TFile, data: string) => {
			if (file) {
				await app.vault.modify(file, data);
			}
		}, 400);

		// Create the embedded editor
		const embedEditor = new EmbeddableMarkdownEditor(app, containerEl, {
			// Configure based on editor type
			onEnter: (editor, mod: boolean, shift: boolean) => {
				if (!editor.view) return false;

				const editorInstance = editor.editor as Editor;
				const cursor = editorInstance.getCursor();
				const { line, ch } = cursor;
				const lineText = editorInstance.getLine(line);

				if (shift) {
					return handleShiftEnter(editorInstance, line, lineText);
				}

				// Try handling with zoom-specific logic first
				if (handleEnterWithZoom(editorInstance, app, mod, shift)) {
					return true;
				}

				// Fall back to regular enter handling
				return handleRegularEnter(editorInstance, line, ch, lineText);
			},
			onDelete: (editor) => {
				if (!editor.view) return false;
				return handleDelete(editor.editor as Editor);
			},
			onIndent: (editor, mod: boolean, shift: boolean) => {
				if (!editor.view) return false;
				return handleIndent(editor.editor as Editor, app, mod, shift);
			},
			getDisplayText: () => path.split("/").pop() || "Untitled",
			getViewType: () => "outliner",
			onChange: (update, path) => {
				if (path) {
					if (!update.docChanged) return;

					const file = app.vault.getFileByPath(path);
					if (file && options.onSave) {
						options.onSave(file, update.state.doc.toString());
					}
				}
			},
			onBlur: (editor, path) => {
				if (path) {
					const file = app.vault.getFileByPath(path);
					const data = editor.editor?.cm.state.doc.toString();

					if (file && data && options.onSave) {
						options.onSave(file, data);
					} else if (file && data) {
						requestSave(file, data);
					}
				}
			},
			type: options.type ? options.type : EditorType.EMBEDDED,
			value: data || "",
			path: path,
			foldByDefault: foldByDefault,
			disableTimeFormat: disableTimeFormat,
		});

		// Apply visible range settings
		editorRangeUtils.updateVisibleRange(
			embedEditor.editor,
			{ from: range.from, to: range.to },
			range.type as "part" | "block" | "heading"
		);

		// Apply read-only mode if specified
		if (readOnly) {
			embedEditor.editor.cm.dispatch({
				effects: [
					embedEditor.readOnlyDepartment.reconfigure(
						EditorState.readOnly.of(true)
					),
				],
			});
			containerEl.toggleClass("readonly", true);
		}

		// If it's a full file and front matter should be hidden
		if (
			range.type === "whole" &&
			options.plugin?.settings.hideFrontmatter
		) {
			const file = app.vault.getFileByPath(path);
			if (file) {
				editorRangeUtils.updateFrontMatterVisible(
					embedEditor.editor,
					app,
					file
				);
			}
		}

		// Add the editor to the component
		// @ts-expect-error - This is a private method
		component.addChild(embedEditor);

		return embedEditor.editor;
	}
}
