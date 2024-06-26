import { MarkdownPostProcessorContext } from 'obsidian';
import { Direction } from './direction.util';

let lastDetectedDir: Direction = 'ltr';

// Special nodes are which the direction style should get applied on the parent
// element, Because changing their own direction won't take effect.
const specialNodes = ['A', 'STRONG', 'EM', 'DEL', 'CODE']

// Try to detect if the postprocessor was asked to run inside a canvas element, and in that case, use the
// supplied setPreviewDirection function to launch the plugin logic and set the text to the file's direction.
function detectCanvasElement(ctx: MarkdownPostProcessorContext, setPreviewDirection: SetPreviewDirection) {
	const container = ctx ? (ctx as any).containerEl as HTMLElement : null;
	if (container && container.closest) {
		const possibleCanvas = container.closest('.canvas-node-content');
		if (possibleCanvas) {
			const markdownPreview = container.closest('.markdown-preview-view');
			if (markdownPreview && markdownPreview instanceof HTMLDivElement) {
				// Mark this canvas as RTL or LTR
				setPreviewDirection(ctx.sourcePath, markdownPreview);
			}
		}
	}
}

// Try to detect if the postprocessor was asked to render an export, which seems to be the only case on which
// the post processor is called with a top-level Markdown Preview View div.
// In this case, we must add the relevant document direction class to that element, because no one else will.
function detectExport(el: HTMLElement, ctx: MarkdownPostProcessorContext, setPreviewDirection: SetPreviewDirection) {
	if (el?.classList && el.classList?.contains('markdown-preview-view')) {
		setPreviewDirection(ctx.sourcePath, el as HTMLDivElement);
	}
}

type SetPreviewDirection = (path: string, markdownPreviewElement: HTMLDivElement) => void;

/*
 * This Markdown post-processor handles the Reading view and other rendered components of notes.
 * It detects the direction for each node individually and adds corresponding CSS classes that are
 * later referenced in styles.css.
 */
export const autoDirectionPostProcessor = (
	el: HTMLElement,
	ctx: MarkdownPostProcessorContext,
	setPreviewDirection: SetPreviewDirection,
) => {
	detectExport(el, ctx, setPreviewDirection);
}

