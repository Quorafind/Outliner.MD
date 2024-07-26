import { editorInfoField } from "obsidian";

import { EditorState } from "@codemirror/state";

export function getDocumentTitle(state: EditorState) {
	return state.field(editorInfoField).file?.basename || "";
}
