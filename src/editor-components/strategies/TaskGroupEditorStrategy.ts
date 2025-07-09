import { App, Component, debounce, Editor, TFile } from "obsidian";
import { EditorStrategy, EditorCreationResult } from "./EditorStrategy";
import { BaseEditorConfig, EditorType, TaskGroupEditorConfig } from "../EditorTypes";
import { EmbeddableMarkdownEditor } from "../MarkdownEditor";
import {
	handleDelete,
	handleEnterWithZoom,
	handleIndent,
	handleRegularEnter,
	handleShiftEnter,
} from "../../utils/editorEventHandlers";

/**
 * Strategy for creating task group editors
 */
export class TaskGroupEditorStrategy extends EditorStrategy {
	readonly type = EditorType.TASK_GROUP;

	/**
	 * Validates task group editor configuration
	 */
	validateConfig(config: BaseEditorConfig): void {
		this.validateCommonConfig(config);
		
		if (!config.file) {
			throw new Error("File is required for task group editor");
		}
	}

	/**
	 * Gets default configuration for task group editors
	 */
	getDefaultConfig(): Partial<BaseEditorConfig> {
		return {
			foldByDefault: true,
			disableTimeFormat: false,
			readOnly: false,
		};
	}

	/**
	 * Applies task group editor specific transformations
	 */
	applyConfigTransformations(config: BaseEditorConfig): BaseEditorConfig {
		const result = this.applyPluginSettings(config);
		
		// Task group editors should fold by default
		if (result.foldByDefault === undefined) {
			result.foldByDefault = true;
		}

		return result;
	}

	/**
	 * Creates a task group editor
	 */
	createEditor(config: BaseEditorConfig): EditorCreationResult {
		const taskGroupConfig = config as TaskGroupEditorConfig;
		const { app, containerEl, file, data } = taskGroupConfig;

		// Create a component to host the editor
		const component = this.createComponent();

		// Create the editor
		const editor = this.createEditorInstance(
			app,
			containerEl,
			file.path,
			data || "",
			{ from: 0, to: (data || "").length, type: "whole" },
			taskGroupConfig,
			component
		);

		return { editor, component };
	}

	/**
	 * Creates a task group editor instance
	 */
	private createEditorInstance(
		app: App,
		containerEl: HTMLElement,
		path: string,
		data: string,
		range: { from: number; to: number; type: string },
		config: TaskGroupEditorConfig,
		component: Component
	): Editor {
		const { foldByDefault = true, disableTimeFormat = false } = config;

		// Create the shared event handlers
		const requestSave = debounce(async (file: TFile, data: string) => {
			if (file) {
				await app.vault.modify(file, data);
			}
		}, 400);

		// Create the embedded editor with task group-specific configuration
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
					if (file && config.onSave) {
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
			type: EditorType.TASK_GROUP,
			value: data || "",
			path: path,
			foldByDefault: foldByDefault,
			disableTimeFormat: disableTimeFormat,
			view: config.view,
		});

		// Add the editor to the component
		// @ts-expect-error - This is a private method
		component.addChild(embedEditor);

		return embedEditor.editor;
	}
}
