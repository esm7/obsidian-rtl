import { Notice, App, WorkspaceLeaf, MarkdownView, Plugin, PluginSettingTab, TFile, TAbstractFile, Setting, getIcon } from 'obsidian';
import { autoDirectionPlugin } from './AutoDirPlugin';
import { autoDirectionPostProcessor } from './AutoDirPostProcessor';
import { EditorView } from '@codemirror/view';
import { Direction, RTL_CLASS, AUTO_CLASS } from 'globals';

export type Settings = {
	fileDirections: { [path: string]: Direction };
	defaultDirection: Direction;
	rememberPerFile: boolean;
	setNoteTitleDirection: boolean;
	setYamlDirection: boolean;
	statusBar: boolean;
};

const DEFAULT_SETTINGS: Settings = {
	fileDirections: {},
	defaultDirection: 'ltr',
	rememberPerFile: true,
	setNoteTitleDirection: true,
	setYamlDirection: false,
	statusBar: true
};

export default class RtlPlugin extends Plugin {
	public settings: Settings = null;
	private currentFile: TFile;
	private initialized = false;
	private statusBarItem: HTMLElement = null;
	private statusBarText: HTMLElement = null;

	async onload() {
		this.addCommand({
			id: 'switch-text-direction',
			name: 'Switch Text Direction (LTR->RTL->auto)',
			icon: 'arrow-left-right',
			callback: () => { this.switchDocumentDirection(); }
		});

		this.registerEditorExtension(autoDirectionPlugin);
		this.registerEditorExtension(EditorView.perLineTextDirection.of(true));
		this.registerMarkdownPostProcessor(autoDirectionPostProcessor);

		await this.convertLegacySettings();
		await this.loadSettings();

		this.addSettingTab(new RtlSettingsTab(this.app, this));

		this.app.workspace.on('active-leaf-change', async (leaf: WorkspaceLeaf) => {
			if (leaf.view instanceof MarkdownView) {
				const file = leaf.view.file;
				await this.onFileOpen(file);
			}
		});

		this.app.workspace.on('file-open', async (file: TFile) => {
			await this.onFileOpen(file);
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
			this.switchDocumentDirection();
		});
	}

	async initialize() {
		this.initialized = true;
	}

	onunload() {
		const view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view?.editor) {
			// @ts-expect-error, not typed
			const editorView = view.editor.cm as EditorView;
			const plugin = editorView.plugin(autoDirectionPlugin);
			if (plugin) {
				plugin.setActive(false, editorView);
			}
		}

		console.log('unloading RTL plugin');
	}

	async onFileOpen(file: TFile) {
		if (!this.initialized)
			await this.initialize();
		if (file && file.path) {
			this.syncDefaultDirection();
			this.currentFile = file;
			this.adjustDirectionToCurrentFile();
		}
	}

	adjustDirectionToCurrentFile() {
		if (this.currentFile && this.currentFile.path) {
			let requiredDirection = null;
			const frontMatterDirection = this.getFrontMatterDirection(this.currentFile);
			let usedDefault = false;
			if (frontMatterDirection) {
				if (frontMatterDirection == 'rtl' || frontMatterDirection == 'ltr' || frontMatterDirection == 'auto')
					requiredDirection = frontMatterDirection;
				else
					console.log('Front matter direction in file', this.currentFile.path, 'is unknown:', frontMatterDirection);
			}
			else if (this.settings.rememberPerFile && this.currentFile.path in this.settings.fileDirections) {
				// If the user wants to remember the direction per file, and we have a direction set for this file -- use it
				requiredDirection = this.settings.fileDirections[this.currentFile.path];
			} else {
				// Use the default direction
				requiredDirection = this.settings.defaultDirection;
				usedDefault = true;
			}
			this.setDocumentDirection(requiredDirection, usedDefault);
		}
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

	setStatusBar(direction: Direction, usedDefault: boolean) {
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
		} else {
			this.statusBarItem.style.display = 'none';
		}
	}

	setDocumentDirection(newDirection: Direction, usedDefault: boolean) {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view || !view?.editor)
			return;

		this.setStatusBar(newDirection, usedDefault);

		//@ts-ignore
		const editorView = view.editor.cm as EditorView;
		const autoDirection = editorView.plugin(autoDirectionPlugin);
		if (autoDirection) {
			autoDirection.setActive(newDirection === 'auto', editorView);
			let title = editorView.dom.querySelector('.inline-title');
			if (!title) {
				title = view.previewMode.containerEl.querySelector('.inline-title');
			}
			title?.setAttribute('dir', newDirection === 'auto' ? 'auto' : '');
		}

		const editorDivs = view.contentEl.getElementsByClassName('cm-editor');
		for (const editorDiv of editorDivs) {
			if (editorDiv instanceof HTMLDivElement)
				this.setDocumentDirectionForEditorDiv(editorDiv, newDirection);
		}
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

		view.editor.refresh();

		// Set the *currently active* export direction. This is global and changes every time the user
		// switches a pane
		if (newDirection !== 'auto') {
			this.setExportDirection(newDirection);
		}
	}

	setDocumentDirectionForEditorDiv(editorDiv: HTMLDivElement, newDirection: Direction) {
		editorDiv.style.direction = newDirection === 'auto' ? '' : newDirection;
		this.addDirectionClassToEl(editorDiv.parentElement, newDirection);
	}

	setDocumentDirectionForReadingDiv(readingDiv: HTMLDivElement, newDirection: Direction) {
		readingDiv.style.direction = newDirection === 'auto' ? '' : newDirection;
		// Although Obsidian doesn't care about is-rtl in Markdown preview, we use it below for some more formatting
		this.addDirectionClassToEl(readingDiv, newDirection);
		readingDiv.classList.remove('rtl-yaml');
		if (newDirection !== 'auto' && this.settings.setYamlDirection)
			readingDiv.classList.add('rtl-yaml');
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

	switchDocumentDirection() {
		let newDirection = this.getDocumentDirection();
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
		new Notice(`Document direction set to ${displayName}`, 2000);

		this.setDocumentDirection(newDirection, false);
		if (this.settings.rememberPerFile && this.currentFile && this.currentFile.path) {
			this.settings.fileDirections[this.currentFile.path] = newDirection;
			this.saveSettings();
		}
	}

	getDocumentDirection(): Direction {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!view)
			return 'ltr';

		const rtlEditors = view.contentEl.getElementsByClassName(RTL_CLASS),
			autoEditors = view.contentEl.getElementsByClassName(AUTO_CLASS);
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

class RtlSettingsTab extends PluginSettingTab {
	settings: Settings;
	plugin: RtlPlugin;

	constructor(app: App, plugin: RtlPlugin) {
		super(app, plugin);
		this.plugin = plugin;
		this.settings = plugin.settings;
	}

	display(): void {
		let {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'RTL Settings'});

		this.plugin.syncDefaultDirection();

		new Setting(containerEl)
			.setName('Remember text direction per file')
			.setDesc('Store and remember the text direction used for each file individually.')
			.addToggle(toggle => toggle.setValue(this.settings.rememberPerFile)
					   .onChange((value) => {
						   this.settings.rememberPerFile = value;
						   this.plugin.saveSettings();
						   this.plugin.adjustDirectionToCurrentFile();
					   }));

		new Setting(containerEl)
			.setName('Default text direction')
			.setDesc('What should be the default text direction in Obsidian?')
			.addDropdown(dropdown => dropdown
						 .addOption('ltr', 'LTR')
						 .addOption('rtl', 'RTL')
						 .addOption('auto', 'Auto')
						 .setValue(this.settings.defaultDirection)
						 .onChange((value) => {
							 this.settings.defaultDirection = value as Direction;
							 (this.app.vault as any).setConfig('rightToLeft', value == 'rtl');
							 this.plugin.saveSettings();
							 this.plugin.adjustDirectionToCurrentFile();
						 }));

		new Setting(containerEl)
			.setName('Set note title direction')
			.setDesc('In RTL notes, also set the direction of the note title.')
			.addToggle(toggle => toggle.setValue(this.settings.setNoteTitleDirection)
						 .onChange((value) => {
							 this.settings.setNoteTitleDirection = value;
							 this.plugin.saveSettings();
							 this.plugin.adjustDirectionToCurrentFile();
						 }));

		new Setting(containerEl)
			.setName('Set YAML direction in Preview')
			.setDesc('For RTL notes, preview YAML blocks as RTL. (When turning off, restart of Obsidian is required.)')
			.addToggle(toggle => toggle.setValue(this.settings.setYamlDirection ?? false)
						 .onChange((value) => {
							 this.settings.setYamlDirection = value;
							 this.plugin.saveSettings();
							 this.plugin.adjustDirectionToCurrentFile();
						 }));

		new Setting(containerEl)
			.setName('Show status bar item')
			.setDesc('Show a clickable status bar item showing the current direction.')
			.addToggle(toggle => toggle.setValue(this.settings.statusBar ?? true)
				.onChange((value) => {
					this.settings.statusBar = value;
					this.plugin.saveSettings();
					this.plugin.adjustDirectionToCurrentFile();
				}));
	}
}
