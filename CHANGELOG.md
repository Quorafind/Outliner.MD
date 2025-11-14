# 0.1.14

Platform: Desktop
Date: August 13, 2025

## Improvement

- feat: replace button-based editing with progressive click interaction in search results and backlinks
  - Remove visual pencil icon buttons for cleaner, less cluttered interface
  - Implement intuitive two-click pattern: first click focuses content, second click enables editing
  - Add double-click protection to preserve native text selection behavior
  - Add smooth focus state visual feedback with accent color outline
  - Add elegant fade-in animations for editor appearance
  - Improve event listener management to prevent memory leaks
  - Maintain full backward compatibility with existing embedded editor functionality

# 0.1.13

Platform: Desktop
Date: August 12, 2025

## Fix

- fix: improve embedded editor lifecycle management
  - Prevent duplicate embedded editor creation by checking container state
  - Add autoSave behavior control to prevent unwanted saves
  - Improve editor unload logic to preserve active editing sessions
  - Fix editor range update method naming consistency
- fix: resolve build errors and improve embedded editor handling
  - Update CodeMirror dependencies to resolve version conflicts
  - Add missing TaskGroupEditor import in backlinkwidget
  - Fix EditorSelection dispatch calls with proper cursor API
  - Improve embedded editor lifecycle and duplicate prevention
  - Add loadFile compatibility method for Obsidian embed registry
  - Simplify fold handler implementation
  - Remove alt attribute requirement for embedded editors

# 0.1.12

Platform: Desktop
Date: October 21, 2024

## Improvement

- feat: support Obsidian 1.7.3+

# 0.1.11

Platform: Desktop
Date: October 12, 2024

## Fix

- feat: support event `omd-section-update` to be listened in other plugins.

# 0.1.10

Platform: Desktop
Date: October 10, 2024

## Improvement

- feat: support Obsidian 1.7.3+

# 0.1.9

Platform: Desktop
Date: September 9, 2024

## Improvement

- feat: click edit pencil in search result/query result to edit result directly;
- feat: support press ctrl + click on link button to open file;

## Fix

- fix: cannot show part of document in canvas;
- fix: cannot drag when block in at the end of document;
- fix: doesn't show fold indicator correctly;

# 0.1.8

Platform: Desktop
Date: July 23, 2024

## Improvement

- feat: setting for hiding section tab header automatically is now available;
- feat: setting for disable time picker is now available;
- feat: command to zoom in current section that contains cursor;
- feat: click on active tab will return to full document;
- feat: control style easily via [style settings](https://github.com/mgmeyers/obsidian-style-settings);
- feat: support create section to the start/end/prev/next.

## Fix

- fix: change Rename function text input to single-line, confirming on Enter press

## Style

- style: refresh setting page UI and some text in it. 
![[refresh-setting-ui.png]]
- style: divider between section tabs;
- style: name above section line;

# 0.1.7

**Platform:** Desktop  
**Date:** July 23, 2024

## Shinny new things

- feat: turn notes into sections/split sections into notes. Note: [notebook mode](https://docs.outliner.md/pages/20240721175612)
## Improvements

- feat: support commands to create section before/after current section. Note: [notebook mode](https://docs.outliner.md/pages/20240721175612)

---

# 0.1.6

**Platform:** Desktop  
**Date:** July 21, 2024

## Shinny new things

- feat: support note as notebook. Note: [notebook mode](https://docs.outliner.md/pages/20240721175612)

---

# 0.1.5

**Platform:** Desktop  
**Date:** June 5, 2024

## Shinny new things

- feat: support custom query string for task group. You can set the query string in the settings.

## Fixes

- fix: when press enter in task list item with indent, should not create a new list item with no indent.
- fix: global search hotkey could not be triggered when the editor is focused. Resolves #51

---

# 0.1.4

**Platform:** Desktop  
**Date:** May 25, 2024

## Shinny new things

- feat: when list item has mark content, for example (And if you press enter at the end of the line, the new bullet line should be added after the mark content.):

```markdown
- Here is a bullet line
  Mark: this is a mark content
```

- feat: support copy link to text fragment. Resolves #34

![Clip_2024-05-25_23-33-33](https://github.com/Quorafind/Outliner.MD/assets/13215013/0f513839-28af-410f-90d0-3a7a0b72ebe1)

## Fixes

- fix: conflict with `Obsidian Banner` plugin, cause paper-layout not working well. Resolves #41
- fix: height issue of Popout window. Resolves #39
- fix: conflict with `Obsidian Paste image rename` plugin. Resolves #43
- fix: when markdown link is embedded, the link should be rendered as a link. Resolves #49

---

# 0.1.3

**Platform:** Desktop  
**Date:** May 16, 2024

## Breaking changes

- `Create inline embed` renamed as `Create link to embed text fragment`. About [Text fragment](https://developer.mozilla.org/en-US/docs/Web/Text_fragments)

## Shinny new things

- feat: support link to text fragment [docs](https://docs.outliner.md/pages/20240517232122); Resolves: #25
- feat: click on link to jump to text fragment and highlight it. [docs](https://docs.outliner.md/pages/20240517232122) Resolves: #20
- style: settings to disable paper layout. Resolves #28 #27
- feat: click on backlink to jump back target pos. [docs](https://docs.outliner.md/pages/20240514151617) Resolves #29
- feat: block-id in embedded editor cannot be selected any more. [docs](https://docs.outliner.md/pages/20240517162521) Resolves #19

## Fixes

- editor: Embedded whole page in backlink should not be hidden when its content changed.
- editor: end mark of text fragment sometimes doesn't render correctly.
