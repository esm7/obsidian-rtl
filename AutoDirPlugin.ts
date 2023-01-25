import {
	DecorationSet,
	EditorView,
	Decoration,
	PluginValue,
	ViewUpdate,
	ViewPlugin,
} from "@codemirror/view";
import { RangeSetBuilder, Text } from "@codemirror/state";
import { detectDirection } from './globals';

type Region = {from: number; to: number;};
// A DecorationRegion is basically a region alongside with its decoration
type DecorationRegion = Region & {dec: Decoration};

class AutoDirectionPlugin implements PluginValue {
	decorations: DecorationSet;
	// Sort of caching decoration for regions so we don't need to calculate
	// decoration for a line each time while it has not been changed.
	decorationRegions: DecorationRegion[] = [];
	active = false;

	rtlDec = Decoration.line({
		attributes: { dir: 'rtl' },
	});
	ltrDec = Decoration.line({
		attributes: { dir: 'ltr' },
	});
	emptyDirDec = Decoration.line({
		attributes: { dir: "" },
	});
	autoDec = Decoration.line({
		attributes: { dir: 'auto' },
	});

	constructor(_view: EditorView) {
		this.decorations = this.buildDecorations();
	}

	update(vu: ViewUpdate) {
		if (vu.viewportChanged || vu.docChanged) {
			const regions: Region[] = [];
			if (vu.docChanged) {
				// Trying to calculate the regions that have been changed and
				// also modifying (shift) other regions regarding to that change.
				// So for example if we have `First line\nSecond line\Test`
				// any insertion or delete on second line will result in a shift
				// on next lines (here third line) and will add the second line
				// region to regions array so we recalculate the direction
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
		this.decorations = this.buildDecorations();

		if (forceUpdate) {
			this.updateEx(view);
		}
		view.dispatch();
	}

	// Calculate line decoration (rtl|ltr|auto|none) for each line that has an
	// intersection with given regions. Note that a single region could include
	// or intersect with multiple lines.
	updateEx(view: EditorView, regions: Region[] = []) {
		// if regions is empty recalculate the decoration for all lines in the viewport
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
					// if we couldn't find what is proper decoration use the
					// line before decoration
					dec = d ? d : this.lineBeforeDecoration(line.from);
				}

				this.addDecorationRegion({from: line.from, to: line.to, dec});
				// putting the position at the beginning of next line
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

	// Adding a decoration region while keeping the decoration regions in order
	// based on their start (from property). This will either replace a
	// decoration region or add one in the middle or append to end of the
	// decoration regions
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

	// Shifting everey decorationRegions region which their start is after
	// passed from variable based on the given amount.
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

			// The shift amount could be negative (on deletion). If after
			// shifting with negative amount the region gets bellow the from
			// variable we will remove the decoration region as the decoration
			// will get calculated again
			if (this.decorationRegions[i].from <= from) {
				this.decorationRegions.splice(i, 1);
				i--;
			}
		}
	}

	detectDecoration(s: string): Decoration|null {
		// Replacing so we don't get the 'x' charachter which is used to show a
		// checked checkbox in markdown as a LTR direction indicator.
		const direction = detectDirection(s.replace('- [x]', ''));
		switch (direction) {
		case 'rtl':
			return this.rtlDec;
		case 'ltr':
			return this.ltrDec;
		}

		return null;
	}

	lineBeforeDecoration(from: number, def=this.ltrDec): Decoration {
		const l = this.decorationRegions.length;
		// If from is out of decoration regions scope use the last one.
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

	// Get all lines region between from and to position.
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
