# Obsidian RTL Plugin

[!["Buy Me A Coffee"](https://www.buymeacoffee.com/assets/img/custom_images/orange_img.png)](https://www.buymeacoffee.com/esm7)

This plugin extends the built-in RTL support of [Obsidian](https://obsidian.md) by adding some extra features.

Starting version 1.6.x Obsidian offers pretty good RTL support, and this plugin adds the following features to it:

- Ability to set individual notes to LTR or RTL rather than the built-in auto direction per line.
- Ability to remember this setting per note.
- Ability to get this setting via the note's front matter.
- Ability to set the default to LTR/RTL and change individual notes to Auto.

## Usage

Install the plugin via Obsidian's "Third Party Plugins" pane.

When enabled, you will have a "Switch Text Direction" command (accessible via Ctrl/Cmd+P if you have the Command Palette plugin enabled).
**You can map this command to a hotkey:** go to Obsidian's settings, click Hotkeys, search for "RTL" and set your preferred key combination.

Alternatively, you should see a text direction status bar item that will toggle the document direction when clicked.

## Canvas Support

The plugin provides full direction support in the Canvas core plugin, with the following caveats:

- A canvas card of an existing note gets the direction set for the note (or the default direction).
  - To change a card's direction you'd need to open the corresponding note, change its direction and reopen the canvas.
  - This might be improved in future versions if many users ask for it.
- A canvas card with no associated file will always be with the default direction (LTR/RTL/Auto) and there's no way to change that.
  - Hopefully future versions of Obsidian will provide a full API for Canvas which will allow saving metadata for a card without a note.

## Support the Development

If you want to support the development of this plugin, please consider to [buy me a coffee](https://www.buymeacoffee.com/esm7).

## Settings

### Default text direction

This is the direction to use for files on which you have not set an explicit text direction.

'Auto' is Obsidian's default behavior, which decides on a per-line text direction according to its content.

### Remember Text Direction Per File

When enabled (which is the default), when you change the text direction of a file it will be saved.
Every time you open that note it will use the same text direction regardless of the default.
This is useful, for example, if most of your notes are in English (so you want to keep the default LTR) but you have some notes in Arabic/Hebrew/Persian (Farsi) and you'd like to always edit them in RTL.

If you disable this setting, all notes will load in the default text direction.

If you want to forget the text direction of a file and go back to using the default, remove it from the map in `VAULT_DIR/.obsidian/plugins/obsidian-rtl/data.json`.

### Front Matter Direction

It's also possible to specify the note direction using a [front matter](https://help.obsidian.md/Advanced+topics/YAML+front+matter):

```
---
direction: rtl
---
```

The front matter direction overrides any other setting.
It is possible to temporarily override a note's direction regardless of the front matter (e.g. to edit or view it differently), but the next time the note is loaded, the front matter direction will always be used.


## Changelog

### 2.0.1

- Fixed https://github.com/esm7/obsidian-rtl/issues/85.
- Added an option to prevent raw YAML from being RTL.

Thanks @kotaindah55!

### 2.0.0

An overhaul of the plugin to build on top of Obsidian's new (1.6.x) RTL support, not interfere with it, and only add a few features on top.

Known issues:
- Export to PDF of a note set to LTR/RTL leaves the note looking wrong in some cases.
- The properties section of RTL notes are right-aligned too, which is probably not what we want.

### 1.2.2

Thanks @zoli for everything in this release!

**Important note:** as Obsidian is adding native auto direction support in version 1.6.0, the next major version of Obsidian RTL will remove a lot of plugin code and focus on improving some edges in Obsidian's native functionality. Therefore, this will be the last version to provide fixes/improvement that will soon be addressed natively in Obsidian.

- Fixed messing up Persian sentences containing bold/italic/strikethrough English phrases (https://github.com/esm7/obsidian-rtl/issues/77)
- Consider link name for detecting direction (https://github.com/esm7/obsidian-rtl/pull/80)

### 1.2.1

- Fixed auto direction in PDF exports (https://github.com/esm7/obsidian-rtl/issues/74).

### 1.2.0

- Auto direction is now the default for new users installing the plugin.
- Decent support for tables, thanks to the incredible @zoli:
    - Tables now properly obey to the document direction.
    - In auto direction, the table direction is decided based on the first cell of the table.
    - Mixed LTR-RTL tables are supported, but due to Obsidian's current cursor movement implementation, moving between cells with different directions using the keyboard arrows isn't great.

### 1.1.2

**Bug fixes:**

- Fix required for Obsidian 1.5 (no support for tables yet though -- it's just a fix for the plugin to continue functioning properly).
- Fixed problem when paragraph breaks to divs (https://github.com/esm7/obsidian-rtl/pull/59) -- thanks @zoli and sorry @Wnb369 for the huge delay in merging this :(

### 1.1.1

**Bug fixes:**

- Fix to tags in RTL mode (https://github.com/esm7/obsidian-rtl/issues/54), thanks @zoli!
- Added proper support for Syriac and Thaana as RTL languages (https://github.com/esm7/obsidian-rtl/issues/56).

### 1.1.0

**Added full support for RTL, LTR and Auto direction in Canvas**. See [here](#canvas-support) for more details.

This required major changes to how the plugin works, and although I tried to test it extensively, I won't be surprised if some bugs crept in.
Please report any issues!

**Bug fixes:**
- Issues related to special tags (https://github.com/esm7/obsidian-rtl/pull/53), thanks #zoli!

### 1.0.0

**With a lot of great help from [@zoli](https://github.com/zoli), and following the support for this feature that was added in CodeMirror a few months ago, this version introduces dynamic & auto RTL-LTR!**

AFAIK this mode works really well without any artifacts, no cursor problems or other issues, but there could definitely be some edge cases we didn't test.

Each note can now be set to LTR, RTL or Auto, and a default can be set in the plugin settings.
And as always, the plugin remembers the setting per file.

**Other improvements:**
- A status bar item with the current direction (or 'auto') was added, and can be turned off in the settings.
- Some general maintenance work for the plugin, which was originally written while Obsidian's API was in its early infancy, and contained lots of legacy code.

### 0.3.0

**IMPORTANT: this version drops support for the legacy (CM5) Obsidian editor.**
If you are sticking to the legacy editor until Obsidian removes it, you cannot upgrade to this version of the plugin.

**This release marks a major overhaul of the way this plugin works, fixing most known bugs in the process.**

- RTL/LTR is now (once again) set for a specific view instead of all the open panes.
- All known bugs related to the plugin interfering with other parts of Obsidian (e.g. the Community Plugin view) are fixed.
- **The plugin now works in Obsidian Mobile** (tested only on Android).

### 0.2.2

- Fixed an issue of not properly detecting the direction when the default is set as RTL (due to Obsidian's own styles).

### 0.2.1

- Fixed an issue of detecting the legacy editor.

### 0.2.0

- Full support for the new (CM6) editor introduced in Obsidian 0.13.x.

### 0.1.0

- Another take at the Home and End keys, trying to make them behave like they should in RTL.
- Added support to setting a note direction via the front matter, as requested [here](https://github.com/esm7/obsidian-rtl/issues/24).
- Added a configurable option to right-align YAML previews as requested [here](https://github.com/esm7/obsidian-rtl/issues/25).

### 0.0.9

- Fixed [incompatibility with the Excalidraw plugin](https://github.com/esm7/obsidian-rtl/issues/20) and improved the plugin's technical behavior overall (it now tries not to override non-Markdown views).

### 0.0.8

- Fixed a bug in the previous release, of some important Obsidian editing behavior (e.g. auto-complete list bullets) being overwritten.

### 0.0.7

- Improved the handling of the Home & End keys (without Shift at this point) in RTL. It's still not perfect (CodeMirror is not good at this) but at least the basic functionality works.
- Some adaptations to the newest Obsidian API.
- Setting the direction of the note title (https://github.com/esm7/obsidian-rtl/issues/15) is now configurable.

### 0.0.6

- Lists are finally rendered properly in RTL, both in Markdown and in Preview!
- The header of RTL notes are now aligned to the right as well.
- Removed debug logs.

### 0.0.5

Export/print support for RTL: https://github.com/esm7/obsidian-rtl/issues/8

### 0.0.4

- Auto-pair brackets patch (https://github.com/esm7/obsidian-rtl/issues/7): until CodeMirror release their fix and Obsidian adapts it, the plugin temporarily disables auto-pair brackets when in RTL mode.
- Patching around Obsidian misbehaving on Home/End keys in RTL mode (https://github.com/esm7/obsidian-rtl/issues/6).

### 0.0.3

- RTL support in preview mode.

### 0.0.2

- Fixed cursor movement on Windows: https://github.com/esm7/obsidian-rtl/issues/3
