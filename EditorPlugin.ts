import {
	DecorationSet,
	EditorView,
	Decoration,
	PluginValue,
	ViewUpdate,
	ViewPlugin,
} from "@codemirror/view";
import { RangeSetBuilder } from "@codemirror/state";
import RtlPlugin from './main';
import { editorInfoField, MarkdownView } from 'obsidian';
import { Direction } from './direction.util';

type Region = {from: number; to: number;};
type DecorationRegion = Region & {dec: Decoration};

export interface EditorPlugin extends PluginValue {
	setDirection(direction: Direction, view: EditorView): void;
}

export function getEditorPlugin(rtlPlugin: RtlPlugin) {
	return ViewPlugin.fromClass(
		class implements EditorPlugin {
			rtlPlugin: RtlPlugin;
			view: EditorView;
			decorations: DecorationSet;
			// A cache mechanism for regions, so we don't need to calculate the decoration for a line if it doesn't
			// change.
			decorationRegions: DecorationRegion[] = [];
			direction: Direction = 'auto';

			rtlDec = Decoration.line({
				attributes: { dir: 'rtl' },
			});
			ltrDec = Decoration.line({
				attributes: { dir: 'ltr' },
			});
			emptyDirDec = Decoration.line({
				attributes: { dir: "auto" },
			});

			constructor(view: EditorView) {
				this.decorations = this.buildDecorations(view);
				this.rtlPlugin = rtlPlugin;
				this.view = view;
				const editorInfo = this.view.state.field(editorInfoField);
				// Checking for editorInfo.editMode because apparently editorInfo.editor which is needed later
				// is a getter which counts on this field to exist
				if (editorInfo && editorInfo instanceof MarkdownView && (editorInfo as any).editMode) {
					this.rtlPlugin.adjustDirectionToView(editorInfo, this);
				}
				this.rtlPlugin.handleIframeEditor(this.view.dom, this.view, editorInfo.file, this);
			}

			update(vu: ViewUpdate) {
				if (vu.viewportChanged || vu.docChanged) {
					this.decorations = this.buildDecorations(vu.view);
				}
			}

			buildDecorations(view: EditorView) {
				const builder = new RangeSetBuilder<Decoration>();
				if (view == null || view.state == null) return builder.finish();
				const viewport = view.viewport;
				if (!viewport)
					return builder.finish();

				let decoration = this.emptyDirDec;
				if (this.direction != 'auto') {
					decoration = this.direction === 'ltr' ? this.ltrDec : this.rtlDec;
				}

				for (let pos = viewport.from; pos <= viewport.to; ) {
					const line = view.state.doc.lineAt(pos);
					builder.add(line.from, line.from, decoration);
					pos = line.to + 1;
				}
				return builder.finish();
			}

			destroy() {}

			setDirection(direction: Direction, view: EditorView) {
				this.direction = direction;
				this.decorations = this.buildDecorations(view);
			}

		}, {decorations: (v) => v.decorations});
}

