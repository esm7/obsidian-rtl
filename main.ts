import { App, Editor, MarkdownView, Plugin, PluginSettingTab, TFile, TAbstractFile, Setting } from 'obsidian';
import * as codemirror from 'codemirror';

class Settings {
	public fileDirections: { [path: string]: string } = {};
	public defaultDirection: string = 'ltr';
	public rememberPerFile: boolean = true;
	public setNoteTitleDirection: boolean = true;
	public setYamlDirection: boolean = false;

	toJson() {
		return JSON.stringify(this);
	}

	fromJson(content: string) {
		var obj = JSON.parse(content);
		this.fileDirections = obj['fileDirections'];
		this.defaultDirection = obj['defaultDirection'];
		this.rememberPerFile = obj['rememberPerFile'];
		this.setNoteTitleDirection = obj['setNoteTitleDirection'];
	}
}

export default class RtlPlugin extends Plugin {

	public settings = new Settings();
	private currentFile: TFile;
	public SETTINGS_PATH = '.obsidian/rtl.json'
	// This stores the value in CodeMirror's autoCloseBrackets option before overriding it, so it can be restored when
	// we're back to LTR
	private autoCloseBracketsValue: any = false;

	onload() {
		console.log('loading RTL plugin');

		this.addCommand({
			id: 'switch-text-direction',
			name: 'Switch Text Direction (LTR<>RTL)',
			callback: () => { this.toggleDocumentDirection(); }
		});

		this.addSettingTab(new RtlSettingsTab(this.app, this));

		this.loadSettings();

		this.registerEvent(this.app.workspace.on('file-open', (file: TFile) => {
			if (file && file.path) {
				this.currentFile = file;
				this.adjustDirectionToCurrentFile();
			}
		}));

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

		this.registerCodeMirror((cm: CodeMirror.Editor) => {
			let cmEditor = cm;
			let currentExtraKeys = cmEditor.getOption('extraKeys');
			let moreKeys = {
				'End': (cm: CodeMirror.Editor) => {
					if (cm.getOption('direction') == 'rtl')
						cm.execCommand('goLineLeftSmart');
					else
						cm.execCommand('goLineRight');
				},
				'Home': (cm: CodeMirror.Editor) => {
					if (cm.getOption('direction') == 'rtl')
						cm.execCommand('goLineRight');
					else
						cm.execCommand('goLineLeftSmart');
				}
			};
			cmEditor.setOption('extraKeys', Object.assign({}, currentExtraKeys, moreKeys));
		});

	}

	onunload() {
		console.log('unloading RTL plugin');
	}

	adjustDirectionToCurrentFile() {
		if (this.currentFile && this.currentFile.path) {
			let requiredDirection = null;
			const frontMatterDirection = this.getFrontMatterDirection(this.currentFile);
			if (frontMatterDirection) {
				if (frontMatterDirection == 'rtl' || frontMatterDirection == 'ltr')
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
			}
			this.setDocumentDirection(requiredDirection);
		}
	}

	saveSettings() {
		var settings = this.settings.toJson();
		this.app.vault.adapter.write(this.SETTINGS_PATH, settings);
	}

	loadSettings() {
		this.app.vault.adapter.read(this.SETTINGS_PATH).
			then((content) => this.settings.fromJson(content)).
			catch(error => { console.log("RTL settings file not found"); });
	}

	getObsidianEditor(): Editor {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view)
			return view.editor;
		return null;
	}

	getCmEditor(): codemirror.Editor {
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view)
			return view.sourceMode?.cmEditor;
		return null;
	}

	setDocumentDirection(newDirection: string) {
		var cmEditor = this.getCmEditor();
		if (cmEditor && cmEditor.getOption("direction") != newDirection) {
			this.patchAutoCloseBrackets(cmEditor, newDirection);
			cmEditor.setOption("direction", newDirection as any);
			cmEditor.setOption("rtlMoveVisually", true);
		}
		let view = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (view && view.previewMode && view.previewMode.containerEl)
			view.previewMode.containerEl.dir = newDirection;

		if (view) {
			// Fix the list indentation style
			this.replacePageStyleByString('CodeMirror-rtl pre',
				`.CodeMirror-rtl pre { text-indent: 0px !important; }`,
				true);

			if (this.settings.setYamlDirection) {
				const alignSide = newDirection == 'rtl' ? 'right' : 'left';
				this.replacePageStyleByString('Patch YAML',
					`/* Patch YAML RTL */ .language-yml code { text-align: ${alignSide}; }`, true);
			}

			if (this.settings.setNoteTitleDirection) {
				var leafContainer = (this.app.workspace.activeLeaf as any).containerEl as Document;
				let header = leafContainer.getElementsByClassName('view-header-title-container');
				(header[0] as any).style.direction = newDirection;
			}

			this.setExportDirection(newDirection);
		}

	}

	setExportDirection(newDirection: string) {
		this.replacePageStyleByString('searched and replaced',
			`/* This is searched and replaced by the plugin */ @media print { body { direction: ${newDirection}; } }`,
			false);
	}

	replacePageStyleByString(searchString: string, newStyle: string, addIfNotFound: boolean) {
		let styles = document.head.getElementsByTagName('style');
		let found = false;
		for (let style of styles) {
			if (style.getText().includes(searchString)) {
				style.setText(newStyle);
				found = true;
			}
		}
		if (!found && addIfNotFound) {
			let style = document.createElement('style');
			style.textContent = newStyle;
			document.head.appendChild(style);
		}
	}

	patchAutoCloseBrackets(cmEditor: any, newDirection: string) {
		// Auto-close brackets doesn't work in RTL: https://github.com/esm7/obsidian-rtl/issues/7
		// Until the actual fix is released (as part of CodeMirror), we store the value of autoCloseBrackets when
		// switching to RTL, overriding it to 'false' and restoring it when back to LTR.
		if (newDirection == 'rtl') {
			this.autoCloseBracketsValue = cmEditor.getOption('autoCloseBrackets');
			cmEditor.setOption('autoCloseBrackets', false);
		} else {
			cmEditor.setOption('autoCloseBrackets', this.autoCloseBracketsValue);
		}
	}

	toggleDocumentDirection() {
		var cmEditor = this.getCmEditor();
		if (cmEditor) {
			var newDirection = cmEditor.getOption("direction") == "ltr" ? "rtl" : "ltr"
			this.setDocumentDirection(newDirection);
			if (this.settings.rememberPerFile && this.currentFile && this.currentFile.path) {
				this.settings.fileDirections[this.currentFile.path] = newDirection;
				this.saveSettings();
			}
		}
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
			.addDropdown(dropdown => dropdown.addOption('ltr', 'LTR')
						 .addOption('rtl', 'RTL')
						 .setValue(this.settings.defaultDirection)
						 .onChange((value) => {
							 this.settings.defaultDirection = value;
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
	}
}
