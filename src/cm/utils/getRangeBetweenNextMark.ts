import OutlinerViewPlugin from "../../OutlinerViewIndex";
import { EditorState } from "@codemirror/state";
import { debounce } from "obsidian";

// All mark is a string, like "++SECTION{NAME}++"


/**
 * @param plugin
 * @param state
 * @param pos
 */
export function getRangeBetweenMarks(
	{
		plugin, state, pos
	}: {
		plugin: OutlinerViewPlugin,
		state: EditorState,
		pos: number
	}
) {
	const mark = plugin.settings.markForSplitSections;

	const nextMarkPos = state.doc.sliceString(pos, state.doc.length).indexOf(mark);
	const prevMarkPos = state.doc.sliceString(0, pos).lastIndexOf(mark);

	const prevMarkPosLine = prevMarkPos === -1 ? state.doc.lineAt(0) : state.doc.lineAt(prevMarkPos);
	const nextMarkPosLine = nextMarkPos === -1 ? state.doc.lineAt(state.doc.length) : state.doc.lineAt(nextMarkPos + pos);

	/** not include the mark line, get next line to return start and end */
	const prevRangeStart = prevMarkPos === -1 ? 0 : prevMarkPosLine.to;
	const nextRangeEnd = nextMarkPos === -1 ? state.doc.length : nextMarkPosLine.from;

	return {
		start: prevRangeStart,
		end: nextRangeEnd
	};
}

export function getAllSectionsRangeAndName(
	{
		state
	}: {
		state: EditorState
	}
) {
	const mark = /%%SECTION\{([^}]*)\}%%|<!--section: ([^-]+)-->/;

	const sections: {
		name: string,
		start: number,
		end: number,
		type: 'outliner' | 'lineage'
	}[] = [];

	const contentArray = state.doc.sliceString(0, state.doc.length).split('\n');

	const markLinesPos = contentArray.map((line, index) => {
		const match = line.match(mark);
		if (match) {
			return {
				index,
				match
			};
		}
		return null;
	}).filter((item): item is { index: number; match: RegExpMatchArray } => item !== null);

	for (let i = 0; i < markLinesPos.length; i++) {
		const startInfo = markLinesPos[i];
		const endInfo = markLinesPos[i + 1] || {index: contentArray.length};

		if (!startInfo) continue;

		const start = startInfo.index;
		const end = endInfo.index;
		const match = startInfo.match;

		let name = 'Unnamed Section';
		let type: 'outliner' | 'lineage' = 'outliner';

		if (match[1]) {
			name = match[1];
			type = 'outliner';
		} else if (match[2]) {
			name = `Section ${match[2]}`;
			type = 'lineage';
		}

		const startLinePos = state.doc.line(start + 1).to + 1;
		const endLinePos = end === contentArray.length ? state.doc.line(end).to : state.doc.line(end).from - 1;

		sections.push({
			name,
			start: startLinePos,
			end: endLinePos,
			type
		});
	}

	return sections;
}

export const listenToSectionsChanged = debounce(({state}: {
	state: EditorState
}) => {
	const sections = getAllSectionsRangeAndName({state});

	return sections;
}, 200);





