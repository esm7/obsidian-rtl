

# Multi language-directions in the same note 

## Abstract
Almost every obsidian user who writes in RTL language(like Hebrew and Arabic) aware of this problem: you want to write the note in your Right To Left language using the outstanding plug-in called "RTL Support". Yet, when you want to change the page direction, it affected the entire note, even you've some parts in the document that you want them to display in LTR direction(like code, some English quote etc. ).
The "RTL Support" plug-in changes the direction in the `<Body>` section, while this workaround will takes care of the option of changing the direction in the `<div>` level. 
**Before**:
> (Pasted image 20210905134340.png)[]!

**After**:
> ![[Pasted image 20210905134104.png]]

## Step 1: Install Admonition plug-in
> Note: this guide assume the plug-in [RTL Support](https://github.com/esm7/obsidian-rtl) already installed on your Obsidian vault.

**Go to Settings > Community Plugins > Browse**
![[Pasted image 20210905132650.png]]

**Type in "Admonition" in the search box then click "Install"**
![[Pasted image 20210905132827.png]]

**When the installation will be completed, go to  and turn the "Admonition" plugin on** 
![[Pasted image 20210905133407.png]]
> Alternatively, you can install this plugin using the guide in the [Admonition's](https://github.com/valentine195/obsidian-admonition) repository 
## Step 2: Adding new Admonition
**Go to Settings > Plugin Options: Admonition** 

![[Pasted image 20210905153418.png]]

**Then click on "Add New" **

**In the next window insert the details of the new admonition:**
* Admonition Type: the name of this admonition (later you'll use this name). 
* Admonition Icon: you can chose some icon from the icons list that will be displayed on the header line of the admonition box.
*  Color: the color of the frame and the title's background
![[Pasted image 20210905150917.png]]
**Then click the "✔" symbol.**

## Step 3: Customize the new Admonition's CSS
**Open the directory of your Obsidian's vault.**
**Open the file** (using some text editor):  
<Your_Obsidian_Path>/.obsidian/plugins/obsidian-admonition/styles.css
add the code:
```css
.admonition-<your Admonition Type>{
	direction:ltr;
}
```
In my case it'll be: 
![[Pasted image 20210905151924.png]]

**Then save and restart your Obsidian**

## Step 4: Use the customized Admonition
In your none Insert a Code Block with the format:
````
```ad-<Admonition Type>
title: <your_title>

your content..
```
````

In my case : 
`````
````ad-code
title: Example for using RESTful API to push .md file to OP's GIT

[[TFS Basic Auth]]
Before any push, the oldObjectId should be taken:
```bash
curl -D- \
-u yakiki@openu.ac.il:<MY TOKEN> \
-X GET \
-H "Content-Type: application/json" \
"<base path>/_apis/git/repositories/PBackup/refs?api-version=4.1" 

```
`````

 

