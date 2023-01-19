import {ViewPlugin, ViewUpdate, Decoration, PluginValue, DecorationSet, EditorView} from "@codemirror/view";

const dirAutoDecoration = Decoration.line({attributes: {dir: "auto"}});
const dirDefaultDecoration = Decoration.line({attributes: {dir: ''}});

// Based on this example:
// https://codemirror.net/try/?c=aW1wb3J0IHtFZGl0b3JWaWV3LCBiYXNpY1NldHVwfSBmcm9tICJjb2RlbWlycm9yIgppbXBvcnQge2phdmFzY3JpcHR9IGZyb20gIkBjb2RlbWlycm9yL2xhbmctamF2YXNjcmlwdCIKaW1wb3J0IHtWaWV3UGx1Z2luLCBEZWNvcmF0aW9ufSBmcm9tICJAY29kZW1pcnJvci92aWV3IgoKY29uc3QgZGlyQXV0byA9IERlY29yYXRpb24ubGluZSh7YXR0cmlidXRlczoge2RpcjogImF1dG8ifX0pCgpjb25zdCBhdXRvTGluZURpciA9IFZpZXdQbHVnaW4uZGVmaW5lKHZpZXcgPT4gKHsKICBkZWNvOiB2aWV3cG9ydExpbmVEZWNvKHZpZXcsIGRpckF1dG8pLAogIHVwZGF0ZSh1cGRhdGUpIHsKICAgIGlmICh1cGRhdGUuZG9jQ2hhbmdlZCB8fCB1cGRhdGUudmlld3BvcnRDaGFuZ2VkIHx8IHVwZGF0ZS5oZWlnaHRDaGFuZ2VkKQogICAgICB0aGlzLmRlY28gPSB2aWV3cG9ydExpbmVEZWNvKHVwZGF0ZS52aWV3LCBkaXJBdXRvKQogIH0KfSksIHsKICBkZWNvcmF0aW9uczogcCA9PiBwLmRlY28KfSkKCmZ1bmN0aW9uIHZpZXdwb3J0TGluZURlY28odmlldywgZGVjbykgewogIHJldHVybiBEZWNvcmF0aW9uLnNldCh2aWV3LnZpZXdwb3J0TGluZUJsb2Nrcy5tYXAobCA9PiBkZWNvLnJhbmdlKGwuZnJvbSkpKQp9Cgp3aW5kb3cudmlldyA9IG5ldyBFZGl0b3JWaWV3KHsKICBkb2M6ICdjb25zb2xlLmxvZygiSGVsbG8gd29ybGQiKVxu/0UG/zEG/y0G/ygG/ycGIP8oBv8nBv9EBv85Bv8nBv9EBv9FBlxuJywKICBleHRlbnNpb25zOiBbCiAgICBiYXNpY1NldHVwLAogICAgamF2YXNjcmlwdCgpLAogICAgYXV0b0xpbmVEaXIsCiAgICBFZGl0b3JWaWV3LnBlckxpbmVUZXh0RGlyZWN0aW9uLm9mKHRydWUpCiAgXSwKICBwYXJlbnQ6IGRvY3VtZW50LmJvZHkKfSkK

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
		this.decorations = this.buildDecorations(view);
		view.dispatch();
	}

	buildDecorations(view: EditorView) {
		const decoration = this.active ? dirAutoDecoration : dirDefaultDecoration;
		return Decoration.set(view.viewportLineBlocks.map(l => decoration.range(l.from)));
	}
}

export const autoDirectionPlugin = ViewPlugin.fromClass(AutoDirectionPlugin, {
	decorations: (v) => v.decorations,
});
