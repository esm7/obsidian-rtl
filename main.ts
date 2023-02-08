import { MarkdownFileInfo, Notice, WorkspaceLeaf, MarkdownView, Plugin, TFile, TAbstractFile, getIcon, Editor } from 'obsidian';
import { getAutoDirectionPlugin, AutoDirectionPlugin } from './AutoDirPlugin';
import { autoDirectionPostProcessor } from './AutoDirPostProcessor';
import { EditorView, ViewPlugin } from '@codemirror/view';
import { Direction, RTL_CLASS, AUTO_CLASS } from 'globals';
import { Settings, DEFAULT_SETTINGS, RtlSettingsTab } from 'settingsTab';

export default class RtlPlugin extends Plugin {
	public settings: Settings = null;
	private statusBarItem: HTMLElement = null;
	private statusBarText: HTMLElement = null;
	private autoDirectionPlugin: ViewPlugin<AutoDirectionPlugin>;

	async onload() {
		this.addCommand({
			id: 'switch-text-direction',
			name: 'Switch Text Direction (LTR->RTL->auto)',
			icon: 'arrow-left-right',
			callback: () => {
				const view = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (!view || !view?.editor)
					return;
				this.switchDocumentDirection(view.editor, view);
			}
		});

		this.autoDirectionPlugin = getAutoDirectionPlugin(this);
		this.registerEditorExtension(this.autoDirectionPlugin);
		this.registerEditorExtension(EditorView.perLineTextDirection.of(true));
		this.registerMarkdownPostProcessor((el, ctx) => {
			autoDirectionPostProcessor(el, ctx, (path, markdownPreviewElement) => this.setCanvasPreviewDirection(path, markdownPreviewElement));
		});

		await this.convertLegacySettings();
		await this.loadSettings();

		this.addSettingTab(new RtlSettingsTab(this.app, this));

		this.app.workspace.on('active-leaf-change', async (leaf: WorkspaceLeaf) => {
			// This creates a redundancy with the flow coming from AutoDirPlugin, but it seems to be needed
			// for older versions of Obsidian
			this.adjustDirectionToActiveView();
			this.updateStatusBar();
		});

		this.app.workspace.on('file-open', async (file: TFile, ctx?: any) => {
			// This creates a redundancy with the flow coming from AutoDirPlugin, but it seems to be needed
			// for older versions of Obsidian
			this.adjustDirectionToActiveView();
			this.updateStatusBar();
		});

		this.registerEvent(this.app.vault.on('delete', (file: TAbstractFile) => {
			if (file && file.path && file.path in this.settings.fileDirections) {
				delete this.settings.fileDirections[file.path];
				this.saveSettings();
			}
		}));

		this.registerEvent(this.app.vault.on('rename', (file: TAbstractFile, oldPath: string) => {
			if (file && file.path && oldPath in this.settings.fileDirections) {
				this.settings.fileDirections[file.path] = this.settings.fileDirections[oldPath];
				delete this.settings.fileDirections[oldPath];
				this.saveSettings();
			}
		}));

		this.statusBarItem = this.addStatusBarItem();
		const languageIcon = getIcon('arrow-left-right');
		this.statusBarItem.appendChild(languageIcon);
		this.statusBarText = this.statusBarItem.createEl('span');
		this.statusBarText.style.marginLeft = '5px';
		this.statusBarItem.title = 'Text direction';
		this.statusBarItem.addClass('mod-clickable');
		this.statusBarItem.addEventListener('click', _ev => {
			const view = this.app.workspace.getActiveViewOfType(MarkdownView);
			if (!view || !view?.editor)
				return;
			this.switchDocumentDirection(view.editor, view);
		});
	}

	onunload() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view?.editor) {
			// @ts-expect-error, not typed
			const editorView = view.editor.cm as EditorView;
			this.adjustAutoDirection(editorView, 'ltr');
		}

		console.log('unloading RTL plugin');
	}

	adjustDirectionToActiveView() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view)
			return;
		this.adjustDirectionToView(view);
	}

	// Adjust the direction of a given MarkdownView (editor, Reading view, title etc), optionally
	// using the given autoDirectionPlugin in the case this is called from within in
	adjustDirectionToView(view: MarkdownView, autoDirectionPlugin?: AutoDirectionPlugin) {
		if (!view)
			return;
		this.syncDefaultDirection();
		const file = view?.file;
		const editor = view?.editor;
		const editorView = (editor as any)?.cm as EditorView;
		if (file && file.path && editorView) {
			const [requiredDirection, _usedDefault] = this.getRequiredFileDirection(file);
			this.setMarkdownViewDirection(view, editor, editorView, requiredDirection, autoDirectionPlugin);
		}
	}

	// Get the direction setup for this file, or the default direction.
	// The 2nd return value denotes whether it was the default direction that was used.
	getRequiredFileDirection(file: TAbstractFile): [Direction, boolean] {
		if (!file) {
			return [this.settings.defaultDirection, true];
		}
		if (!(file instanceof TFile))
			return null;
		let requiredDirection = null;
		const frontMatterDirection = this.getFrontMatterDirection(file);
		// This is true when the file doesn't specify a direction and we used the default value from
		// the settings
		let usedDefault = false;
		if (frontMatterDirection) {
			if (frontMatterDirection == 'rtl' || frontMatterDirection == 'ltr' || frontMatterDirection == 'auto')
				requiredDirection = frontMatterDirection;
			else
				console.log('Front matter direction in file', file.path, 'is unknown:', frontMatterDirection);
		}
		else if (this.settings.rememberPerFile && file.path in this.settings.fileDirections) {
			// If the user wants to remember the direction per file, and we have a direction set for this file -- use it
			requiredDirection = this.settings.fileDirections[file.path];
		} else {
			// Use the default direction
			requiredDirection = this.settings.defaultDirection;
			usedDefault = true;
		}
		return [requiredDirection, usedDefault];
	}

	async saveSettings() {
        await this.saveData(this.settings);
	}

	async loadSettings() {
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			await this.loadData()
		);
	}

	async convertLegacySettings() {
		const legacySettingsPath = '.obsidian/rtl.json';
		if (await this.app.vault.adapter.exists(legacySettingsPath)) {
			const legacyContent = await this.app.vault.adapter.read(legacySettingsPath);
			if (legacyContent) {
				this.settings = JSON.parse(legacyContent);
			}
			this.app.vault.adapter.remove(legacySettingsPath);
			new Notice('RTL Plugin: legacy settings were converted to the new format');
			this.saveSettings();
		}
	}

	// Update the direction status bar item according to the active view
	updateStatusBar() {
		let hide = true;
		let usedDefault = false;
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view?.editor) {
			const direction = this.getDocumentDirection(view.editor, view);
			// If the file is using the settings default direction (i.e. there is no special setting for that
			// file), we want this to be shown to the user
			if (view.file && view.file.path)
				[, usedDefault] = this.getRequiredFileDirection(view.file);
			if (this.settings.statusBar) {
				let directionString = direction === 'auto' ? 'auto' : (direction === 'ltr' ? 'LTR' : 'RTL');
				let statusString = '';
				if (usedDefault)
					statusString = `Default (${direction})`;
				else {
					if (direction === 'auto')
						statusString = 'Auto';
					else
						statusString = directionString;
				}
				this.statusBarText.textContent = statusString;
				this.statusBarItem.style.display = null;
				hide = false;
			}
		}
		if (hide)
			this.hideStatusBar();
	}

	hideStatusBar() {
		this.statusBarItem.style.display = 'none';
	}

	// Set the direction of an editor that's embedded in an iframe, e.g. an editor in a canvas card.
	// We update here only the editor direction and not Reading view, which is handled from a different path,
	// because there currently doesn't seem to be a reliable way to get from the AutoDirectionPlugin to
	// the markdown-preview-view container.
	handleIframeEditor(editorDiv: HTMLElement, editorView: EditorView, file: TFile, autoDirectionPlugin: AutoDirectionPlugin) {
		const isInIframe = editorDiv.closest('.mod-inside-iframe');
		if (isInIframe) {
			if (editorDiv instanceof HTMLDivElement) {
				const [requiredDirection, _] = this.getRequiredFileDirection(file);
				this.adjustAutoDirection(editorView, requiredDirection, autoDirectionPlugin);
				this.setDocumentDirectionForEditorDiv(editorDiv, requiredDirection);
			}
		}
	}

	// This is the main entry point for setting a Markdown view (the "regular" view of Obsidian), which can be either
	// an editor, or a Reading View, to an LTR/RTL/Auto direction.
	// It sets the editor, the Markdown Preview (reading/printing), the note title etc.
	setMarkdownViewDirection(view: MarkdownView, editor: Editor, editorView: EditorView, newDirection: Direction, autoDirectionPlugin?: AutoDirectionPlugin) {
		if (!view || !editor) {
			this.hideStatusBar();
			return;
		}

		// Adjust the note title
		let title = editorView.dom.querySelector('.inline-title');
		if (!title) {
			title = view.previewMode.containerEl.querySelector('.inline-title');
		}
		title?.setAttribute('dir', newDirection === 'auto' ? 'auto' : '');

		// Adjust the editor for Auto Direction using the AutoDirPlugin (either a given one or we find it from the editor)
		this.adjustAutoDirection(editorView, newDirection, autoDirectionPlugin);

		// Adjust the editor for LTR/RTL
		const editorDivs = view.contentEl.getElementsByClassName('cm-editor');
		for (const editorDiv of editorDivs) {
			if (editorDiv instanceof HTMLDivElement)
				this.setDocumentDirectionForEditorDiv(editorDiv, newDirection);
		}

		// Adjust Markdown Preview / Reading Mode
		const markdownPreviews = view.contentEl.getElementsByClassName('markdown-preview-view');
		for (const preview of markdownPreviews) {
			if (preview instanceof HTMLDivElement)
				this.setDocumentDirectionForReadingDiv(preview, newDirection);
		}

		// --- General global fixes ---

		if (this.settings.setNoteTitleDirection) {
			const container = view.containerEl.parentElement;
			let header = container.getElementsByClassName('view-header-title-container');
			(header[0] as HTMLDivElement).style.direction = newDirection;
		}

		editor.refresh();

		// Set the *currently active* export direction. This is global and changes every time the user
		// switches a pane
		if (newDirection !== 'auto') {
			this.setExportDirection(newDirection);
		}
	}

	// Adjust the given EditorView for Auto direction.
	// This both sets Auto direction when needed and turns it off if the direction was changed to LTR/RTL (and
	// then the constant LTR/RTL is handled in setDocumentDirectionForEditorDiv).
	// There's a gentle point here: we get here both from applying a change from a command (switch a document direction)
	// and also from the constructor of AutoDirPlugin when a new editor is created. In the latter case we must
	// use the instance we were given and *not dispatch* an update, which cannot be done from inside the constructor
	// of the editor plugin.
	adjustAutoDirection(editorView: EditorView, newDirection: Direction, autoDirectionPlugin?: AutoDirectionPlugin) {
		const autoDirection = autoDirectionPlugin ?? editorView.plugin(this.autoDirectionPlugin);
		if (autoDirection) {
			autoDirection.setActive(newDirection === 'auto', editorView);
			// If we're not inside the context of a specific AutoDirectionPlugin, we need to dispatch an update
			// so the editor is refreshed
			if (!autoDirectionPlugin)
				editorView.dispatch();
		}
	}

	// Set a constant LTR/RTL direction for an editor or mark it as Auto using a class.
	// editorDiv is the element with the cm-editor class
	setDocumentDirectionForEditorDiv(editorDiv: HTMLDivElement, newDirection: Direction) {
		editorDiv.style.direction = newDirection === 'auto' ? '' : newDirection;
		this.addDirectionClassToEl(editorDiv.parentElement, newDirection);
	}

	setDocumentDirectionForReadingDiv(readingDiv: HTMLDivElement, newDirection: Direction) {
		// In case of an LTR/RTL direction, we ue the 'direction' style.
		// For an Auto direction the AutoDirPostProcessor takes over and we just need to add a few classes
		// to set settings (e.g. 'rtl-yaml').
		readingDiv.style.direction = newDirection === 'auto' ? '' : newDirection;
		// Although Obsidian doesn't care about is-rtl in Markdown preview, we use it below for some more formatting
		this.addDirectionClassToEl(readingDiv, newDirection);
		readingDiv.classList.remove('rtl-yaml');
		if (newDirection !== 'auto' && this.settings.setYamlDirection)
			readingDiv.classList.add('rtl-yaml');
	}

	setCanvasPreviewDirection(path: string, markdownPreviewElement: HTMLDivElement) {
		const file = this.app.vault.getAbstractFileByPath(path);
		const [requiredDirection, _] = this.getRequiredFileDirection(file);
		this.setDocumentDirectionForReadingDiv(markdownPreviewElement, requiredDirection);
	}

	addDirectionClassToEl(el: HTMLElement|HTMLDivElement, direction: Direction) {
		switch (direction) {
			case 'rtl':
				el.classList.remove(AUTO_CLASS);
				el.classList.add(RTL_CLASS);
				break;
			case 'auto':
				el.classList.remove(RTL_CLASS);
				el.classList.add(AUTO_CLASS);
				break;
			default:
				el.classList.remove(RTL_CLASS);
				el.classList.remove(AUTO_CLASS);
		}
	}

	setExportDirection(newDirection: Direction) {
		this.replacePageStyleByString('searched and replaced',
			`/* This is searched and replaced by the plugin */ @media print { body { direction: ${newDirection}; } }`,
			true);
	}

	// Returns true if a replacement was made
	replacePageStyleByString(searchString: string, newStyle: string, addIfNotFound: boolean) {
		let alreadyExists = false;
		let style = this.findPageStyle(searchString);
		if (style) {
			if (style.getText() === searchString)
				alreadyExists = true;
			else
				style.setText(newStyle);
		} else if (addIfNotFound) {
			let style = document.createElement('style');
			style.textContent = newStyle;
			document.head.appendChild(style);
		}
		return style && !alreadyExists;
	}

	findPageStyle(regex: string) {
		let styles = document.head.getElementsByTagName('style');
		for (let style of styles) {
			if (style.getText().match(regex))
				return style;
		}
		return null;
	}

	// This is used for the UI command that switches the active document's direction and cycles
	// between LTR/RTL/Auto.
	switchDocumentDirection(editor: Editor, view: MarkdownView | MarkdownFileInfo) {
		let newDirection = this.getDocumentDirection(editor, view);
		if (newDirection === null) {
			new Notice("Obsidian RTL can't set the direction of this document");
			return;
		}
		let displayName = '';
		switch (newDirection) {
			case 'ltr':
				newDirection = 'rtl';
				displayName = 'RTL';
				break;
			case 'rtl':
				newDirection = 'auto';
				displayName = 'Auto';
				break;
			case 'auto':
				newDirection = 'ltr';
				displayName = 'LTR';
				break;
		}

		if (view instanceof MarkdownView) {
			const editorView = (view.editor as any).cm as EditorView;
			this.setMarkdownViewDirection(view, editor, editorView, newDirection);
			if (this.settings.rememberPerFile && view.file && view.file.path) {
				this.settings.fileDirections[view.file.path] = newDirection;
				this.saveSettings();
			}
			new Notice(`Document direction set to ${displayName}`, 2000);
			this.updateStatusBar();
		} else {
			const canvasView = this.getCanvasContext(view);
			if (canvasView) {
				if (view.file)
					new Notice('To change a canvas card direction, open the document separately and reload the canvas.');
				else
					new Notice("Can't change the direction of a card without a file.");
				// Work in progress
				// const editorDiv = (editor as any)?.containerEl;
				// if (editorDiv === null)
				// 	return;
				// const editorView = (editor as any).cm as EditorView;
				// this.adjustAutoDirection(editorView, newDirection);
				// this.setDocumentDirectionForEditorDiv(editorDiv, newDirection);
			}
		}
	}

	// Checks if the given ctx object represents a canvas container (has the canvas-node-content class),
	// and if so, returnes it as an HTMLElement
	getCanvasContext(ctx: MarkdownView | MarkdownFileInfo) {
		if (ctx instanceof MarkdownView)
			return null;
		const possibleCanvasContainer = (ctx as any)?.containerEl as HTMLElement;
		if (possibleCanvasContainer && possibleCanvasContainer.hasClass('canvas-node-content'))
			return possibleCanvasContainer;
	}

	getDocumentDirection(_editor: Editor, ctx: MarkdownView | MarkdownFileInfo): Direction | null {
		// The element that is used for searching for the direction classes
		let refElement = null;
		if (ctx instanceof MarkdownView) {
			refElement = ctx.contentEl;
		} else {
			refElement = this.getCanvasContext(ctx);
		}
		if (refElement === null)
			return null;

		const rtlEditors = refElement.getElementsByClassName(RTL_CLASS),
			autoEditors = refElement.getElementsByClassName(AUTO_CLASS);
		if (rtlEditors.length > 0)
			return 'rtl';
		else if (autoEditors.length > 0)
			return 'auto';
		else
			return 'ltr';
	}

	getFrontMatterDirection(file: TFile) {
		const fileCache = this.app.metadataCache.getFileCache(file);
		const frontMatter = fileCache?.frontmatter;
		if (frontMatter && frontMatter?.direction) {
			try {
				const direction = frontMatter.direction;
				return direction;
			}
			catch (error) {}
		}
	}

	syncDefaultDirection() {
		// Sync the plugin default direction with Obsidian's own setting
		const obsidianDirection = (this.app.vault as any).getConfig('rightToLeft') ? 'rtl' : 'ltr';
		if (obsidianDirection != this.settings.defaultDirection &&
			this.settings.defaultDirection !== 'auto') {
			this.settings.defaultDirection = obsidianDirection;
			this.saveSettings();
		}
	}
}
