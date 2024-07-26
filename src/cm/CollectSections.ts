import { EditorState } from "@codemirror/state";

import { getAllSectionsRangeAndName } from "./utils/getRangeBetweenNextMark";
import OutlinerViewPlugin from "../OutlinerViewIndex";

export interface Section {
	name: string,
	start: number,
	end: number,
	type: 'outliner' | 'lineage';
}

export class CollectSections {
	sections: Section[] = [];
	plugin: OutlinerViewPlugin;

	constructor(plugin: OutlinerViewPlugin) {
		this.plugin = plugin;
	}

	public collectSections(state: EditorState) {
		this.sections = getAllSectionsRangeAndName({
			state,
		});

		return this.sections;
	}
}
