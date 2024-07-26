import OutlinerViewPlugin from "../OutlinerViewIndex";
import { StateEffect, StateField } from "@codemirror/state";

interface PluginState {
	plugin: OutlinerViewPlugin;
}

export const setPluginEffect = StateEffect.define<OutlinerViewPlugin>();

export const pluginInfoField = StateField.define<PluginState | null>({
	create: () => null,
	update: (value, tr) => {
		if (!tr.docChanged) return value;
		// for (const effect of tr.effects) {
		// 	if (effect.is(setPluginEffect)) {
		// 		value = {plugin: effect.value};
		// 	}
		// }

		return value;
	},
});
