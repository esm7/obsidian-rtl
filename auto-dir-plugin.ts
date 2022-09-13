import {
	DecorationSet,
	EditorView,
	Decoration,
	PluginValue,
	ViewUpdate,
	ViewPlugin,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import { RTL, LTR, RTL_LANGS } from "globals";
import { franc } from "franc";

class AutoDirectionPlugin implements PluginValue {
	decorations: DecorationSet;
	active = false;

	rtlDec = Decoration.line({
		attributes: { dir: RTL },
	});
	ltrDec = Decoration.line({
		attributes: { dir: LTR },
	});
	emptyDirDec = Decoration.line({
		attributes: { dir: "" },
	});

	constructor(view: EditorView) {
		this.updateEx(view);
	}

	update(update: ViewUpdate) {
		if (update.docChanged || update.viewportChanged) {
			this.updateEx(update.view);
		}
	}

	destroy() {}

	buildDecorations(view: EditorView): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();

		for (const { from, to } of view.visibleRanges) {
			let defaultDec = this.ltrDec;
			for (let pos = from; pos <= to; ) {
				const line = view.state.doc.lineAt(pos);

				let dec = this.emptyDirDec;
				if (this.active) {
					const s = view.state.doc.sliceString(line.from, line.to);
					dec = this.detectDecoration(s);
					dec = dec ? dec : defaultDec;
					defaultDec = dec;
				}

				builder.add(line.from, line.from, dec);
				pos = line.to + 1;
			}
		}
		return builder.finish();
	}

	setActive(active: boolean) {
		this.active = active;
	}

	updateEx(view: EditorView) {
		this.decorations = this.buildDecorations(view);
	}

	detectDecoration(s: string): Decoration {
		const lang = franc(s, {
			minLength: 3,
			ignore: ["zlm", "uig"],
		});
		if (lang === "und")
			return undefined;

		return RTL_LANGS.includes(lang) ? this.rtlDec : this.ltrDec;
	}
}

export const autoDirectionPlugin = ViewPlugin.fromClass(AutoDirectionPlugin, {
	decorations: (v) => v.decorations,
});
