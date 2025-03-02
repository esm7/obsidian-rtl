import {
	DecorationSet,
	EditorView,
	Decoration,
	PluginValue,
	ViewUpdate,
	ViewPlugin,
} from "@codemirror/view";
import { EditorState, RangeSetBuilder } from "@codemirror/state";
import { syntaxTree } from "@codemirror/language";
import RtlPlugin from './main';
import { editorInfoField, MarkdownView } from 'obsidian';
import { Direction } from './direction.util';

type Region = {from: number; to: number;};
type DecorationRegion = Region & {dec: Decoration};

export interface EditorPlugin extends PluginValue {
	setDirection(direction: Direction, view: EditorView): void;
}

const FRONTMATTER_OPEN = "---";

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
			
			// Cached frontmatter range, recalculating only occurs when there is a document change within the range, or
			// within the first three characters on the first line.
			// If any, "from" should be 0, and "to" should be the end offset of the line where the frontmatter being closed.
			// If it doesn't exist, the range should be null.
			frontmatterRange: { from: number, to: number } | null = null;

			constructor(view: EditorView) {
				this.rtlPlugin = rtlPlugin;
				this.decorations = this.buildDecorations(view);
				this.view = view;

				// Get the frontmatter range at initialization if any.
				let preventRTLFrontmatter = this.rtlPlugin.settings.preventRTLFrontmatter,
					state = view.state;
				if (preventRTLFrontmatter && this.checkFrontmatter(state)) {
					this.getFrontmatterRange(state);
				}

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

					// Frontmatter checking
					if (rtlPlugin.settings.preventRTLFrontmatter && vu.docChanged) {
						let { from, to } = this.frontmatterRange ?? { from: 0, to: 3 },
							state = vu.state;
						// Update this.frontmatterRange only when document change occur within it.
						if (vu.changes.touchesRange(from, to)) {
							if (this.checkFrontmatter(state)) {
								this.getFrontmatterRange(state);
							} else {
								this.frontmatterRange = null;
							}
						}
					}

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

				let pos = viewport.from,
					preventRTLFrontmatter = this.rtlPlugin.settings.preventRTLFrontmatter;
				// Move the pos after the frontmatter if the pos touches it.
				if (preventRTLFrontmatter && this.frontmatterRange !== null && pos <= this.frontmatterRange.to) {
					if (pos == viewport.to)
						return builder.finish();
					else pos = this.frontmatterRange.to + 1;
				}

				while (pos <= viewport.to) {
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

			// We notice that frontmatter can exist only if the first line is containing exactly three hyphens ("-")
			// without any character before or after it, even if it is a space.
			checkFrontmatter(state: EditorState) {
				let firstLineStr = state.doc.line(1).text;
				return firstLineStr == FRONTMATTER_OPEN;
			}

			// Should be run only when the frontmatter was found.
			getFrontmatterRange(state: EditorState) {
				// Using syntax tree to get the range of the frontmatter
				let treeCursor = syntaxTree(state).cursor(),
					frontmatterRange = { from: 0, to: 3 };
				// Need to move twice the cursor first, because the first node is always "Document",
				// and the second one is the frontmatter opening delimiter.
				treeCursor.next(); treeCursor.next();
				while (treeCursor.name.includes("frontmatter")) {
					frontmatterRange.to = treeCursor.to;
					treeCursor.next();
				}
				this.frontmatterRange = frontmatterRange;
			}

		}, {decorations: (v) => v.decorations});
}

