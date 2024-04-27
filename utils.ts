import { EditorState, RangeSet, RangeValue } from "@codemirror/state";
import { zoomStateField } from "./checkVisible";
import { App } from "obsidian";

export function rangeSetToArray<T extends RangeValue>(
	rs: RangeSet<T>
): Array<{ from: number; to: number }> {
	const res = [];
	const i = rs.iter();
	while (i.value !== null) {
		res.push({from: i.from, to: i.to});
		i.next();
	}
	return res;
}

function calculateHiddenContentRanges(state: EditorState) {
	const field = state.field(zoomStateField);
	return rangeSetToArray(field);
}

export function getVisibleRanges(state: EditorState) {
	const hidden = calculateHiddenContentRanges(state);

	if (hidden.length === 1) {
		const [a] = hidden;

		if (a.from === 0) {
			return {from: a.to + 1, to: state.doc.length};
		} else {
			return {from: 0, to: a.from - 1};
		}
	}

	if (hidden.length === 2) {
		const [a, b] = hidden;

		return {from: a.to + 1, to: b.from - 1};
	}

	return null;

}

export function getZoomRange(state: EditorState) {
	const range = getVisibleRanges(state);

	if (!range) {
		return null;
	}

	const from = state.doc.lineAt(range.from);
	const to = state.doc.lineAt(range.to);

	return {
		from: {
			line: from.number - 1,
			ch: range.from - from.from,
		},
		to: {
			line: to.number - 1,
			ch: range.to - to.from,
		},
	};
}

export function getIndent(app: App) {
	const useTab = app.vault.getConfig('useTab') === undefined || window.app.vault.getConfig('useTab') === true;
	const tabSize = useTab ? 1 : app.vault.getConfig('tabSize');

	// const removeNewLine = MemoContent.replace(/\n/g, '<br>');
	const indentNewLine = (useTab ? '\t' : ' ').repeat(tabSize);

	return indentNewLine;
}
