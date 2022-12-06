import {
	DecorationSet,
	EditorView,
	Decoration,
	PluginValue,
	ViewUpdate,
	ViewPlugin,
} from "@codemirror/view";
import { RangeSetBuilder, Text } from "@codemirror/state";
import { RTL, LTR, AUTO, detectDirection } from "globals";

type Region = {from: number; to: number;};
type DecorationRegion = Region & {dec: Decoration};

class AutoDirectionPlugin implements PluginValue {
	decorations: DecorationSet;
	decorationRegions: DecorationRegion[] = [];
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
	autoDec = Decoration.line({
		attributes: { dir: AUTO },
	});

	constructor(_view: EditorView) {
		this.decorations = this.buildDecorations();
	}

	update(vu: ViewUpdate) {
		if (vu.viewportChanged || vu.docChanged) {
			const regions: Region[] = [];
			if (vu.docChanged) {
				vu.changes.iterChanges((fromA, toA, fromB, toB) => {
					const shift = (toB-fromB) - (toA-fromA);
					this.shiftDecorationRegions(shift < 0 ? toB : toA, shift);

					regions.push(...this.getLineRegions(vu.state.doc, fromB, toB));
				});
			}

			this.updateEx(vu.view, regions);
		}
	}

	destroy() {}

	setActive(active: boolean, view: EditorView) {
		const forceUpdate = this.active !== active;
		this.active = active;

		if (forceUpdate) {
			this.updateEx(view);
		}
	}

	updateEx(view: EditorView, regions: Region[] = []) {
		if (regions.length === 0) {
			const {from, to} = view.viewport;
			regions = this.getLineRegions(view.state.doc, from, to);
		}

		for (const { from, to } of regions) {
			for (let pos = from; pos <= to; ) {
				const line = view.state.doc.lineAt(pos);

				let dec = this.emptyDirDec;
				if (this.active) {
					const s = view.state.doc.sliceString(line.from, line.to);
					const d = this.detectDecoration(s);
					dec = d ? d : this.lineBeforeDecoration(line.from);
				}

				this.addDecorationRegion({from: line.from, to: line.to, dec});
				pos = line.to + 1;
			}
		}

		this.decorations = this.buildDecorations();
	}

	buildDecorations(): DecorationSet {
		const builder = new RangeSetBuilder<Decoration>();
		for (const dr of this.decorationRegions) {
			builder.add(dr.from, dr.from, dr.dec);
		}

		return builder.finish();
	}

	addDecorationRegion(dr: DecorationRegion) {
		for (let i = 0; i < this.decorationRegions.length; i++) {
			if (this.decorationRegions[i].from < dr.from) {
				continue;
			}

			if (this.decorationRegions[i].from === dr.from) {
				this.decorationRegions[i] = dr;
			} else if (this.decorationRegions[i].from > dr.from) {
				this.decorationRegions.splice(i, 0, dr);
			}

			return;
		}

		this.decorationRegions.push(dr);
	}

	shiftDecorationRegions(from: number, amount: number) {
		if (amount === 0) {
			return;
		}

		for (let i = 0; i < this.decorationRegions.length; i++) {
			if (this.decorationRegions[i].from < from) {
				continue;
			}

			this.decorationRegions[i].from += amount;
			this.decorationRegions[i].to += amount;

			if (this.decorationRegions[i].from <= from) {
				this.decorationRegions.splice(i, 1);
				i--;
			}
		}
	}

	detectDecoration(s: string): Decoration|null {
		const direction = detectDirection(s.replace('- [x]', ''));
		switch (direction) {
		case RTL:
			return this.rtlDec;
		case LTR:
			return this.ltrDec;
		}

		return null;
	}

	lineBeforeDecoration(from: number, def=this.ltrDec): Decoration {
		const l = this.decorationRegions.length;
		if (l !== 0 && from > this.decorationRegions[l-1].from) {
			return this.decorationRegions[l-1].dec;
		}

		for (let i = 0; i < l; i++) {
			if (i !== 0 && this.decorationRegions[i].from >= from) {
				return this.decorationRegions[i-1].dec;
			}
		}

		return def;
	}

	getLineRegions(doc: Text, from: number, to: number): Region[] {
		const regions: Region[] = [];
		for (let i = from; i <= to; i++) {
			const l = doc.lineAt(i);
			i = l.to;

			regions.push({from: l.from, to: l.to});
		}

		return regions;
	}
}

export const autoDirectionPlugin = ViewPlugin.fromClass(AutoDirectionPlugin, {
	decorations: (v) => v.decorations,
});
