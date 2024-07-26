import OutlinerViewPlugin from "../../OutlinerViewIndex";
import { getAllSectionsRangeAndName } from "./getRangeBetweenNextMark";
import { Editor, editorInfoField } from "obsidian";

export async function splitIntoNotes(editor: Editor, plugin: OutlinerViewPlugin, type: 'embed' | 'link') {
	const sections = getAllSectionsRangeAndName({state: editor.cm.state});
	const folder = plugin.app.fileManager.getMarkdownNewFileParent();
	const currentFile = editor.cm.state.field(editorInfoField).file;
	const name = currentFile?.basename || 'untitled';
	const path = currentFile?.path || "";

	const prepareLinks: {
		start: number,
		end: number,
		insert: string
	}[] = [];

	for (let i = 0; i < sections.length; i++) {
		const content = editor.cm.state.doc.sliceString(sections[i].start, sections[i].end);
		const realStart = editor.cm.state.doc.lineAt(sections[i].start - 1).from;
		const file = await plugin.app.fileManager.createNewMarkdownFile(folder, `${name}/section-${sections[i].name}`);
		await plugin.app.vault.append(file, content);

		const link = plugin.app.fileManager.generateMarkdownLink(file, path, "", sections[i].name);
		prepareLinks.push({
			start: realStart,
			end: sections[i].end,
			insert: (type === 'embed' ? '!' : '') + link
		});
	}

	const changes = prepareLinks.map((link) => {
		return {
			from: link.start,
			to: link.end,
			insert: link.insert
		};
	});

	editor.cm.dispatch({
		changes: changes
	});
}
