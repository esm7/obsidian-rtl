import { MarkdownPostProcessorContext } from 'obsidian';

export const autoDirectionPostProcessor = (el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
	el.setAttr('dir', 'auto');
}
