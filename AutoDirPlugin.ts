import {ViewPlugin, ViewUpdate, Decoration, PluginValue, DecorationSet, EditorView} from "@codemirror/view";

const dirAutoDecoration = Decoration.line({attributes: {dir: "auto"}});
const dirDefaultDecoration = Decoration.line({attributes: {dir: ''}});

class AutoDirectionPlugin implements PluginValue {
	decorations: DecorationSet;
	active = true;

	constructor(view: EditorView) {
		this.decorations = this.buildDecorations(view);
	}

	update(vu: ViewUpdate) {
		if (vu.viewportChanged || vu.docChanged || vu.heightChanged) {
			this.decorations = this.buildDecorations(vu.view);
		}
	}

	destroy() {}

	setActive(active: boolean, view: EditorView) {
		this.active = active;
	}

	buildDecorations(view: EditorView) {
		const decoration = this.active ? dirAutoDecoration : dirDefaultDecoration;
		return Decoration.set(view.viewportLineBlocks.map(l => decoration.range(l.from)));
	}
}

export const autoDirectionPlugin = ViewPlugin.fromClass(AutoDirectionPlugin, {
	decorations: (v) => v.decorations,
});
