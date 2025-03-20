# Obsidian Outliner View Plugin - Refactored Editor Architecture

This document describes the refactoring of the editor components in the Obsidian Outliner View Plugin.

## Overview of Changes

The codebase has been refactored to remove duplication across multiple editor implementations by:

1. Extracting common event handling logic into shared utility functions
2. Creating a unified API for handling editor ranges and visibility
3. Implementing a factory pattern for creating different types of editors with shared configurations

## New Architecture

### 1. Shared Utilities

#### Event Handlers (`editorEventHandlers.ts`)

-   Common event handling functions (Enter, Delete, etc.) extracted from the original implementations
-   Consistent logic that can be reused across different editor contexts
-   Specialized handlers for various use cases (e.g., lists, indented content)

#### Range Utilities (`editorRangeUtils.ts`)

-   Common utilities for handling editor ranges and visibility
-   Methods for calculating and updating visible ranges
-   Utilities for hiding/showing frontmatter and indentation

### 2. Editor Factory (`EditorFactory.ts`)

-   Unified factory for creating different types of editors
-   Configurable options that can be tailored to specific editor types
-   Common setup logic that applies to all editor instances

### 3. Refactored Editor Components

#### EmbeddedEditor

-   Uses the EditorFactory and utility functions
-   Simplified UI element creation with dedicated methods
-   Cleaner state management

#### TaskGroupEditor

-   Uses the EditorFactory and utility functions
-   Simplified content management for task groups
-   Better component organization

## Benefits of Refactoring

1. **Reduced Code Duplication**: Common code is now in shared utilities rather than duplicated across classes
2. **Improved Maintainability**: Changes to event handling or range calculations only need to be made in one place
3. **Better Separation of Concerns**: UI components focus on UI logic, while core editor functionality is centralized
4. **Easier Extensions**: New editor types can be added by extending the factory pattern

## How to Use the New Architecture

To create a new editor instance:

```typescript
// Example of creating an embedded editor
const { editor, component, updateRange } = EditorFactory.createEditor(
	EditorType.EMBEDDED,
	{
		app: this.app,
		containerEl: this.containerEl,
		file: file,
		data: data,
		// Additional configuration options...
		onSave: (file, data) => this.handleSave(file, data),
	}
);

// The editor can now be used directly
editor.setValue("New content");

// Range updates can be performed with the utility
updateRange({ from: 10, to: 20 });
```

This approach makes it easier to maintain consistency across different editor types while allowing for specialized behavior when needed.
