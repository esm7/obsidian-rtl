import { App, PluginSettingTab, Setting } from 'obsidian';
import { Direction } from 'direction.util';
import RtlPlugin from 'main';

export type Settings = {
	fileDirections: { [path: string]: Direction };
	defaultDirection: Direction;
	rememberPerFile: boolean;
	setNoteTitleDirection: boolean;
	setYamlDirection: boolean;
	preventRTLFrontmatter: boolean; // Frontmatter == Raw YAML
	statusBar: boolean;
};

export const DEFAULT_SETTINGS: Settings = {
	fileDirections: {},
	defaultDirection: 'auto',
	rememberPerFile: true,
	setNoteTitleDirection: true,
	setYamlDirection: false,
	preventRTLFrontmatter: false,
	statusBar: true
};

export class RtlSettingsTab extends PluginSettingTab {
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
						   this.plugin.adjustDirectionToActiveView();
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
							 this.plugin.adjustDirectionToActiveView();
						 }));

		new Setting(containerEl)
			.setName('Set note title direction')
			.setDesc('In RTL notes, also set the direction of the note title.')
			.addToggle(toggle => toggle.setValue(this.settings.setNoteTitleDirection)
						 .onChange((value) => {
							 this.settings.setNoteTitleDirection = value;
							 this.plugin.saveSettings();
							 this.plugin.adjustDirectionToActiveView();
						 }));

		new Setting(containerEl)
			.setName('Set YAML direction in Preview')
			.setDesc('For RTL notes, preview YAML blocks as RTL. (When turning off, restart of Obsidian is required.)')
			.addToggle(toggle => toggle.setValue(this.settings.setYamlDirection ?? false)
						 .onChange((value) => {
							 this.settings.setYamlDirection = value;
							 this.plugin.saveSettings();
							 this.plugin.adjustDirectionToActiveView();
						 }));

		new Setting(containerEl)
			.setName('Prevent raw YAML (Frontmatter) to be RTL-directioned in Editor')
			.setDesc('Raw YAML will always be LTR-directioned whatever the direction is. (Restart required after changing.)')
			.addToggle(toggle => toggle.setValue(this.settings.preventRTLFrontmatter ?? false)
						.onChange((value) => {
							this.settings.preventRTLFrontmatter = value;
							this.plugin.saveSettings();
							this.plugin.adjustDirectionToActiveView();
						}));

		new Setting(containerEl)
			.setName('Show status bar item')
			.setDesc('Show a clickable status bar item showing the current direction.')
			.addToggle(toggle => toggle.setValue(this.settings.statusBar ?? true)
				.onChange((value) => {
					this.settings.statusBar = value;
					this.plugin.saveSettings();
					this.plugin.adjustDirectionToActiveView();
				}));
	}
}
