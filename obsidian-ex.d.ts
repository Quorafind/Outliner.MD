import 'obsidian';
import { View, WorkspaceItem, WorkspaceParent } from "obsidian";

type ScrollableMarkdownEditor = any;


declare module "obsidian" {
	interface Vault {
		getConfig(key: string): any;
	}

	interface EditableFileView {
		titleParentEl: HTMLElement;
	}

	interface Workspace {
		recordHistory(leaf: WorkspaceLeaf, pushHistory: boolean): void;

		iterateLeaves(callback: (item: WorkspaceLeaf) => boolean | void, item: WorkspaceItem | WorkspaceItem[]): boolean;

		iterateLeaves(item: WorkspaceItem | WorkspaceItem[], callback: (item: WorkspaceLeaf) => boolean | void): boolean;

		getDropLocation(event: MouseEvent): {
			target: WorkspaceItem;
			sidedock: boolean;
		};

		recursiveGetTarget(event: MouseEvent, parent: WorkspaceParent): WorkspaceItem;

		recordMostRecentOpenedFile(file: TFile): void;

		onDragLeaf(event: MouseEvent, leaf: WorkspaceLeaf): void;

		onLayoutChange(): void; // tell Obsidian leaves have been added/removed/etc.
		activeLeafEvents(): void;

		floatingSplit: any;

		pushUndoHistory(leaf: WorkspaceLeaf, id: string, e: any): void;
	}

	interface App {
		appId: string;
		plugins: {
			getPlugin(name: string): any;
		};
		embedRegistry: {
			embedByExtension: {
				md: (...args: any[]) => MarkdownInfo;
			};
		};
		internalPlugins: {
			getEnabledPluginById(id: string): any;
		};
		commands: any;
		viewRegistry: ViewRegistry;

		openWithDefaultApp(path: string): void;
	}

	interface ViewRegistry {
		typeByExtension: Record<string, string>; // file extensions to view types
		viewByType: Record<string, (leaf: WorkspaceLeaf) => View>; // file extensions to view types
	}

	interface FileManager {
		createNewMarkdownFile: (parent: TFolder, name: string) => Promise<TFile>;
		promptForFileRename: (file: TFile) => void;
		promptForFileDeletion: (file: TFile) => void;
	}

	interface View {
		contentEl: HTMLElement;
		titleEl: HTMLElement;

		file: TFile;
	}

	interface WorkspaceLeaf {
		width: number;
		height: number;
		activeTime: number;

		id: string;

		tabHeaderInnerTitleEl: HTMLElement;

		openLinkText(linkText: string, path: string, state?: unknown): Promise<void>;

		updateHeader(): void;

		containerEl: HTMLDivElement;
		working: boolean;
		parentSplit: WorkspaceParent;
	}

	interface WorkspaceParent {
		insertChild(index: number, child: WorkspaceItem, resize?: boolean): void;

		replaceChild(index: number, child: WorkspaceItem, resize?: boolean): void;

		removeChild(leaf: WorkspaceLeaf, resize?: boolean): void;

		containerEl: HTMLElement;
		children: any;
	}

	interface MarkdownEditView {
		editorEl: HTMLElement;
	}

	interface MarkdownInfo {
		set: (value: string) => void;
		showEditor: () => void;
		editMode: any;
		editable: boolean;
	}
}
