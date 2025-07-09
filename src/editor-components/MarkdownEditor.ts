/**
 * All credits go to mgmeyers for figuring out how to grab the proper editor prototype
 * 	 and making it easily deployable
 * Changes made to the original code:
 * 	 - Refactored to JS-only syntax (original code made use of React)
 * 	 - Added blur completion
 * 	 - Added some comments on how the code functions
 * 	 - Made editor settings fully optional
 * 	 - Allow all editor commands to function on this editor
 * 	 - Added typings for the editor(s) (will be added to obsidian-typings)
 * Make sure to also check out the original source code here: https://github.com/mgmeyers/obsidian-kanban/blob/main/src/components/Editor/MarkdownEditor.tsx
 */

import {
	App,
	type Constructor,
	Editor,
	Scope,
	TFile,
	WorkspaceLeaf,
} from "obsidian";
import {
	Compartment,
	EditorSelection,
	EditorState,
	type Extension,
	Prec,
} from "@codemirror/state";
import { keymap, ViewUpdate } from "@codemirror/view";
import { around } from "monkey-around";
import type { ScrollableMarkdownEditor } from "../types/obsidian-ex";
import { AddNewLineBtn } from "../components/AddNewLine";
// import { zoomStateField } from "./checkVisible";
// import { placeholder } from "../cm/Placeholder";
import { OutlinerEditorView } from "../OutlinerEditorView";
import { SearchHighlight } from "../cm/SearchHighlight";
import { BulletMenu } from "../components/BulletMenu";
import { TaskGroupComponent } from "../components/task-group/TaskGroupComponent";
import { blankBulletLineWidget } from "../cm/BulletLineWithNoContent";
import { KeepRangeVisible } from "../cm/KeepRangeVisible";
import { selectionController } from "../cm/SelectionController";
import { createDateRendererPlugin } from "../cm/DateRender";
import {
	FoldAnnotation,
	FoldingExtension,
	getAllFoldableRanges,
} from "../cm/BulletDescAutoCollpase";
import { foldEffect } from "@codemirror/language";
import { createBlockIdRender } from "../cm/RenderBlockID";
import { disableToDeleteBlockID } from "../cm/TransFilter";
import {
	buildExtensions,
	ExtensionConfig,
	ensureDefaultExtensions,
	EditorType as ExtensionEditorType,
} from "./extensions";
import { EditorTypeUtils } from "./EditorTypes";

export function resolveEditorPrototype(app: App) {
	// Create a temporary editor to resolve the prototype of ScrollableMarkdownEditor
	const widgetEditorView = app.embedRegistry.embedByExtension.md(
		{ app, containerEl: document.createElement("div") },
		null as unknown as TFile,
		""
		// @ts-expect-error - This is a private method
	) as WidgetEditorView;

	// Mark as editable to instantiate the editor
	widgetEditorView.editable = true;
	widgetEditorView.showEditor();
	const MarkdownEditor = Object.getPrototypeOf(
		Object.getPrototypeOf(widgetEditorView.editMode!)
	);

	// Unload to remove the temporary editor
	widgetEditorView.unload();

	return MarkdownEditor.constructor as Constructor<ScrollableMarkdownEditor>;
}

interface MarkdownEditorProps {
	cursorLocation?: { anchor: number; head: number };
	value?: string;
	cls?: string;
	placeholder?: string;
	view?: OutlinerEditorView;
	type?: "embed" | "outliner" | "task-group";
	foldByDefault?: boolean;
	disableTimeFormat?: boolean;

	path?: string;

	toggleMode: () => void;
	getDisplayText: () => string;
	getViewType: () => string;
	onFocus: (editor: EmbeddableMarkdownEditor) => void;
	onEnter: (
		editor: EmbeddableMarkdownEditor,
		mod: boolean,
		shift: boolean
	) => boolean;
	onEscape: (editor: EmbeddableMarkdownEditor) => void;
	onSubmit: (editor: EmbeddableMarkdownEditor) => void;
	onBlur: (editor: EmbeddableMarkdownEditor, path?: string) => void;
	onPaste: (e: ClipboardEvent, editor: EmbeddableMarkdownEditor) => void;
	onChange: (update: ViewUpdate, path?: string) => void;
	onDelete: (editor: EmbeddableMarkdownEditor) => boolean;
	onIndent: (
		editor: EmbeddableMarkdownEditor,
		mod: boolean,
		shift: boolean
	) => boolean;
	onArrowUp: (
		editor: EmbeddableMarkdownEditor,
		mod: boolean,
		shift: boolean
	) => boolean;
	onArrowDown: (
		editor: EmbeddableMarkdownEditor,
		mod: boolean,
		shift: boolean
	) => boolean;
	onArrowLeft: (
		editor: EmbeddableMarkdownEditor,
		mod: boolean,
		shift: boolean
	) => boolean;
	onArrowRight: (
		editor: EmbeddableMarkdownEditor,
		mod: boolean,
		shift: boolean
	) => boolean;
}

const defaultProperties: MarkdownEditorProps = {
	cursorLocation: { anchor: 0, head: 0 },
	value: "",
	cls: "",
	placeholder: "",
	view: undefined,
	type: "embed",
	foldByDefault: true,

	disableTimeFormat: false,

	path: "",

	toggleMode: () => "",
	getViewType: () => "",
	getDisplayText: () => "",
	onFocus: () => {},
	onEnter: () => false,
	onEscape: () => {},
	onSubmit: () => {},
	// NOTE: Blur takes precedence over Escape (this can be changed)
	onBlur: () => {},
	onPaste: () => {},
	onChange: () => {},
	onDelete: () => false,
	onIndent: () => false,
	onArrowUp: () => false,
	onArrowDown: () => false,
	onArrowLeft: () => false,
	onArrowRight: () => false,
};

export class EmbeddableMarkdownEditor
	extends resolveEditorPrototype((window as any).app)
	implements ScrollableMarkdownEditor
{
	options: MarkdownEditorProps;
	initial_value: string;
	scope: Scope;
	view: OutlinerEditorView;
	editor: Editor;

	readOnlyDepartment = new Compartment();
	KeepOnlyZoomedContentVisible: KeepRangeVisible = new KeepRangeVisible();

	/**
	 * Construct the editor
	 * @remark Takes 5ms to fully construct and attach
	 * @param app - Reference to App instance
	 * @param container - Container element to add the editor to
	 * @param options - Options for controling the initial state of the editor
	 */
	constructor(
		app: App,
		container: HTMLElement,
		options: Partial<MarkdownEditorProps>
	) {
		super(app, container, {
			app,
			// This mocks the MarkdownView functions, which is required for proper functioning of scrolling
			onMarkdownScroll: () => {},
			toggleMode: () => this.options.toggleMode(),
			getMode: () => "source",
			getDisplayText: () => this.options.getDisplayText(),
		});
		this.options = { ...defaultProperties, ...options };
		this.initial_value = this.options.value!;
		this.scope = new Scope(this.app.scope);
		// NOTE: Hotkeys take precedence over CM keymap, so scope is introduced to allow for specific hotkeys to be overwritten
		//   In this case, since Mod+Enter is linked to the "Open link in new leaf" command, but it is also the default user action for submitting the editor,
		//      the scope is used to prevent the hotkey from executing (by returning `true`)
		// TODO: It is also possible to allow both behaviours to coexist:
		//     1) Fetch the command via hotkeyManager
		//     2) Execute the command callback
		//     3) Return the result of the callback (callback returns false if callback could not execute)
		//     		(In this case, if cursor is not on a link token, the callback will return false, and onEnter will be applied)
		// this.scope.register(["Mod"], "Enter", (e, ctx) => {
		// 	return true;
		// });

		this.options?.type === "outliner" &&
			this.scope.register(["Mod"], "f", (e, ctx) => {
				this.view && this.view?.search();
				return true;
			});

		// Since the commands expect that this is a MarkdownView (with editMode as the Editor itself),
		//   we need to mock this by setting both the editMode and editor to this instance and its containing view respectively

		this.owner.editMode = this;
		this.owner.editor = this.editor;

		this.owner.getViewType = this.options.getViewType;

		// eslint-disable-next-line @typescript-eslint/no-this-alias
		const self = this;
		this.set(options.value || "");
		// this.editor.cm.dispatch({
		// 	effects: [
		// 		EditorView.scrollIntoView(this.editor.cm.state.selection.main, {
		// 			y: "center",
		// 		}),
		// 	],
		// });
		this.register(
			around(this.app.workspace, {
				setActiveLeaf:
					(
						oldMethod: (
							leaf: WorkspaceLeaf,
							params?: { focus?: boolean }
						) => void
					) =>
					(leaf: WorkspaceLeaf, params: { focus?: boolean }) => {
						// If the editor is currently focused, prevent the workspace setting the focus to a workspaceLeaf instead
						if (!this.activeCM.hasFocus) {
							oldMethod.call(this.app.workspace, leaf, params);
						}
					},
			})
		);

		this.register(
			around(this.editor.constructor.prototype, {
				getClickableTokenAt: (oldMethod: any) => {
					return function (...args: any[]) {
						const token = oldMethod.call(this, ...args);
						if (token && token.type === "tag") {
							// console.log(this, self.app.workspace.activeLeaf?.view, self.app.workspace.activeLeaf?.view?.getViewType());
							const activeView = self.app.workspace.activeEditor
								.editMode.view as OutlinerEditorView;
							// console.log(activeView, token.text, this.activeCM);
							if (
								activeView.getViewType() !==
								"outliner-editor-view"
							) {
								return token;
							}

							activeView?.searchWithText(token.text);
							return;
						}
						return token;
					};
				},
			})
		);

		// Execute onBlur when the editor loses focus
		// NOTE: Apparently Chrome does a weird thing where removing an element from the DOM triggers a blur event
		//		 (Hence why the ._loaded check is necessary)
		if (this.options.onBlur !== defaultProperties.onBlur) {
			this.editor.cm.contentDOM.addEventListener("blur", () => {
				this.app.keymap.popScope(this.scope);
				if (this._loaded || this.options?.type === "embed") {
					this.options.onBlur(this, this.options?.path);
				}
			});
		}

		// Whenever the editor is focused, set the activeEditor to the mocked view (this.owner)
		// This allows for the editorCommands to actually work
		this.editor.cm.contentDOM.addEventListener(
			"focusin",
			(e: FocusEvent) => {
				this.app.keymap.pushScope(this.scope);
				this.app.workspace.activeEditor = this.owner;

				if (this._loaded) this.options.onFocus(this);
			}
		);

		if (options.cls) this.editorEl.classList.add(options.cls);
		if (options.cursorLocation) {
			this.editor.cm.dispatch({
				selection: EditorSelection.range(
					options.cursorLocation.anchor,
					options.cursorLocation.head
				),
			});
		}

		this.view = this.options.view!;
		this.editor.cm.contentDOM.toggleClass(
			"embed-editor",
			this.options.type === "embed"
		);

		if (this.options.foldByDefault) {
			const allFoldedRanges = getAllFoldableRanges(this.editor.cm.state);

			const effects = allFoldedRanges
				.filter((t) => {
					t.from < t.to;
				})
				.map((r) => {
					return foldEffect.of({
						from: r.from,
						to: r.to,
					});
				});
			this.editor.cm.dispatch({
				effects,
				annotations: [FoldAnnotation.of("outliner.fold")],
			});
		}
		// this.editor.setCursor(0, 0);
		// this.sizerEl.appendChild(this.options.view?.backlinksEl);
	}

	get value() {
		return this.editor.cm.state.doc.toString();
	}

	onUpdate(update: ViewUpdate, changed: boolean) {
		super.onUpdate(update, changed);
		if (changed) this.options.onChange(update, this.options?.path);
	}

	/**
	 * Loads the CM extensions for rendering Markdown and handling user inputs
	 * Note that other plugins will not be able to send updates to these extensions to change configurations
	 */
	buildLocalExtensions(): Extension[] {
		// Ensure default extensions are initialized
		ensureDefaultExtensions();

		// Get base extensions from parent
		const extensions = super.buildLocalExtensions();

		// Create extension configuration
		const extensionConfig: ExtensionConfig = this.createExtensionConfig();

		// Build extensions using the extension manager
		const managedExtensions = buildExtensions(extensionConfig);
		extensions.push(...managedExtensions);

		// Add legacy extensions that haven't been migrated yet
		this.addLegacyExtensions(extensions);

		return extensions;
	}

	/**
	 * Creates extension configuration for the current editor
	 */
	private createExtensionConfig(): ExtensionConfig {
		// Map legacy type to new type system
		const editorType = this.mapLegacyType(this.options.type || "embed");

		// Get default capabilities for the editor type
		const capabilities = EditorTypeUtils.getDefaultCapabilities(editorType);

		return {
			type: editorType,
			capabilities,
			disableTimeFormat: this.options.disableTimeFormat,
			readOnly: false, // This editor is always editable
			customExtensions: [],
		};
	}

	/**
	 * Maps legacy editor type to new type system
	 */
	private mapLegacyType(legacyType: string): ExtensionEditorType {
		switch (legacyType) {
			case "embed":
				return ExtensionEditorType.EMBEDDED;
			case "outliner":
				return ExtensionEditorType.OUTLINER;
			case "task-group":
				return ExtensionEditorType.TASK_GROUP;
			default:
				return ExtensionEditorType.EMBEDDED;
		}
	}

	/**
	 * Adds legacy extensions that haven't been migrated to the new system yet
	 */
	private addLegacyExtensions(extensions: Extension[]): void {
		// Custom keymap for this editor instance
		extensions.push(
			Prec.highest(
				keymap.of([
					{
						key: "Enter",
						run: (cm) => this.options.onEnter(this, false, false),
						shift: (cm) => this.options.onEnter(this, false, true),
					},
					{
						key: "Mod-Enter",
						run: (cm) => this.options.onEnter(this, true, false),
						shift: (cm) => this.options.onEnter(this, true, true),
					},
					{
						key: "Escape",
						run: (cm) => {
							this.options.onEscape(this);
							return true;
						},
						preventDefault: true,
					},
					{
						key: "Backspace",
						run: (cm) => this.options.onDelete(this),
					},
					{
						key: "Delete",
						run: (cm) => this.options.onDelete(this),
					},
					{
						key: "Tab",
						run: (cm) => this.options.onIndent(this, false, false),
						shift: (cm) => this.options.onIndent(this, false, true),
					},
					{
						key: "ArrowLeft",
						run: (cm) =>
							this.options.onArrowLeft(this, false, false),
						shift: (cm) =>
							this.options.onArrowLeft(this, false, true),
					},
					{
						key: "ArrowRight",
						run: (cm) =>
							this.options.onArrowRight(this, false, false),
						shift: (cm) =>
							this.options.onArrowRight(this, false, true),
					},
					{
						key: "ArrowUp",
						run: (cm) => this.options.onArrowUp(this, false, false),
						shift: (cm) =>
							this.options.onArrowUp(this, false, true),
					},
					{
						key: "ArrowDown",
						run: (cm) =>
							this.options.onArrowDown(this, false, false),
						shift: (cm) =>
							this.options.onArrowDown(this, false, true),
					},
					{
						key: "Mod-ArrowUp",
						run: (cm) => this.options.onArrowUp(this, true, false),
						shift: (cm) => this.options.onArrowUp(this, true, true),
					},
					{
						key: "Mod-ArrowDown",
						run: (cm) =>
							this.options.onArrowDown(this, true, false),
						shift: (cm) =>
							this.options.onArrowDown(this, true, true),
					},
				])
			)
		);

		// Core editor extensions
		extensions.push([
			this.readOnlyDepartment.of(EditorState.readOnly.of(false)),
			blankBulletLineWidget,
			Prec.highest(this.KeepOnlyZoomedContentVisible?.getExtension()),
			selectionController(),
			FoldingExtension,
		]);

		// Legacy type-specific extensions (to be migrated)
		if (!this.options.disableTimeFormat) {
			extensions.push([createDateRendererPlugin()]);
		}

		if (this.options.type === "outliner") {
			extensions.push([
				AddNewLineBtn,
				TaskGroupComponent,
				SearchHighlight,
				BulletMenu,
			]);
		}

		if (this.options.type === "embed") {
			extensions.push([
				Prec.default(createBlockIdRender()),
				disableToDeleteBlockID(),
			]);
		}
	}

	/**
	 * Ensure that the editor is properly destroyed when the view is closed
	 */
	destroy(): void {
		if (this._loaded) this.unload();
		this.app.keymap.popScope(this.scope);
		this.app.workspace.activeEditor = null;
		this.containerEl.empty();
		super.destroy();
	}

	/**
	 * When removing as a component, destroy will also get invoked
	 */
	onunload() {
		super.onunload();
		this.destroy();
	}
}
