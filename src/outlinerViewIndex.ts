import { ItemView, Plugin, WorkspaceLeaf } from "obsidian";
import React from "react";
import ReactDOM from "react-dom";

import DiceRoller from "./component/DicerRoller";

const VIEW_TYPE = "react-view";

class MyReactView extends ItemView {
    private reactComponent: React.ReactElement;

    getViewType(): string {
        return VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Outliner View";
    }

    getIcon(): string {
        return "clipboard-list";
    }

    async onOpen(): Promise<void> {
        this.reactComponent = React.createElement(DiceRoller);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ReactDOM.render(this.reactComponent, (this as any).contentEl);
    }
}

export default class AnotherReactStarter extends Plugin {
    private view: MyReactView;

    async onload(): Promise<void> {
        this.registerView(
            VIEW_TYPE,
            (leaf: WorkspaceLeaf) => (this.view = new MyReactView(leaf))
        );

        this.app.workspace.onLayoutReady(this.onLayoutReady.bind(this));
    }

    onLayoutReady(): void {
        if (this.app.workspace.getLeavesOfType(VIEW_TYPE).length) {
            return;
        }
        this.app.workspace.getRightLeaf(false).setViewState({
            type: VIEW_TYPE,
        });
    }
}
