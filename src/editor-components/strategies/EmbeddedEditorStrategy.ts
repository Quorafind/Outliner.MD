import { App, Component, debounce, Editor, TFile } from "obsidian";
import { EditorStrategy, EditorCreationResult } from "./EditorStrategy";
import { BaseEditorConfig, EditorType, EmbeddedEditorConfig } from "../EditorTypes";
import { EmbeddableMarkdownEditor } from "../MarkdownEditor";
import { editorRangeUtils } from "../../utils/editorRangeUtils";
import {
	handleDelete,
	handleEnterWithZoom,
	handleIndent,
	handleRegularEnter,
	handleShiftEnter,
} from "../../utils/editorEventHandlers";
import { EditorState } from "@codemirror/state";
import { zoomInEffect } from "../../cm/VisibleRangeController";

/**
 * Strategy for creating embedded editors
 */
export class EmbeddedEditorStrategy extends EditorStrategy {
	readonly type = EditorType.EMBEDDED;

	/**
	 * Validates embedded editor configuration
	 */
	validateConfig(config: BaseEditorConfig): void {
		this.validateCommonConfig(config);

		if (!config.file) {
			throw new Error("File is required for embedded editor");
		}
	}

	/**
	 * Gets default configuration for embedded editors
	 */
	getDefaultConfig(): Partial<BaseEditorConfig> {
		return {
			foldByDefault: false,
			disableTimeFormat: false,
			readOnly: false,
		};
	}

	/**
	 * Applies embedded editor specific transformations
	 */
	applyConfigTransformations(config: BaseEditorConfig): BaseEditorConfig {
		const result = this.applyPluginSettings(config);

		// Embedded editors should not fold by default
		if (result.foldByDefault === undefined) {
			result.foldByDefault = false;
		}

		return result;
	}

	/**
	 * Creates an embedded editor
	 */
	createEditor(config: BaseEditorConfig): EditorCreationResult {
		const embeddedConfig = config as EmbeddedEditorConfig;
		const {
			app,
			containerEl,
			file,
			subpath,
			targetRange,
			data,
			readOnly = false,
		} = embeddedConfig;

		// Create a component to host the editor
		const component = this.createComponent();

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
				embeddedConfig,
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
		app.vault.read(file).then((fileData: string) => {
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
				embeddedConfig,
				component,
				readOnly
			);

			// Set up save debouncing
			if (embeddedConfig.onSave) {
				const debouncedSave = debounce((file: TFile, data: string) => {
					embeddedConfig.onSave!(file, data);
				}, 400);

				// Register event listener for file changes
				component.registerEvent(
					app.metadataCache.on("changed", (changedFile: TFile) => {
						if (changedFile.path === file.path) {
							app.vault.read(changedFile).then((newData: string) => {
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
	 * Creates an embedded editor instance
	 */
	private createEditorInstance(
		app: App,
		containerEl: HTMLElement,
		path: string,
		data: string,
		range: { from: number; to: number; type: string },
		config: EmbeddedEditorConfig,
		component: Component,
		readOnly: boolean = false
	): Editor {
		const { foldByDefault = false, disableTimeFormat = false } = config;

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
					const shouldAutoSave = config?.behavior?.autoSave ?? true;
					if (file && config.onSave && shouldAutoSave) {
						config.onSave(file, update.state.doc.toString());
					}
				}

				// Call custom onChange handler if provided
				if (config.onChange) {
					config.onChange(update, path);
				}
			},
			onBlur: (editor, path) => {
				if (path) {
					const file = app.vault.getFileByPath(path);
					const data = editor.editor?.cm.state.doc.toString();

					if (file && data && config.onSave) {
						config.onSave(file, data);
					} else if (file && data) {
						requestSave(file, data);
					}
				}
			},
			type: EditorType.EMBEDDED,
			value: data || "",
			path: path,
			foldByDefault: foldByDefault,
			disableTimeFormat: disableTimeFormat,
			view: config.view,
		});

		// Apply visible range settings
		editorRangeUtils.updateVisibleRange(
			embedEditor.editor,
			{ from: range.from, to: range.to },
			range.type as "part" | "block" | "heading"
		);

		// Ensure edit button widget is available for partial ranges
		if (range.type === "part") {
			embedEditor.editor.cm.dispatch({
				effects: [
					zoomInEffect.of({
						from: range.from,
						to: range.to,
						type: "part",
						container: containerEl,
					}),
				],
			});
		}

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
			config.plugin?.settings.hideFrontmatter
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
