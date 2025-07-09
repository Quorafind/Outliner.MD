import OutlinerViewPlugin from "../OutlinerViewIndex";
import { around } from "monkey-around";
import { MarkdownView } from "obsidian";
import { getAllSectionsRangeAndName } from "../cm/utils/getRangeBetweenNextMark";

export function initSectionFeature(plugin: OutlinerViewPlugin) {
	const markdownViewOnloadUninstaller = around(MarkdownView.prototype, {
		setViewData: (next: any) => {
			return function (data, clear) {
				const result = next.call(this, data, clear);

				// Defer non-critical operations to avoid blocking the main process
				setTimeout(() => {
					if (plugin.settings.alwaysShowSectionHeader) {
						const sections = getAllSectionsRangeAndName({
							state: this.editor.cm.state,
						});
						plugin.sectionTabsNavigation.showSectionTabs(
							this.editor.cm,
							sections
						);
					}
					plugin.dragDropManager.initDragManager(this.editor.cm);
				}, 0);

				return result;
			};
		},
	});
	plugin.register(markdownViewOnloadUninstaller);
}
