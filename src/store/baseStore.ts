import create from 'zustand';
import { Tree } from '../types/tree';

interface BaseState {
    globalTree: Tree | null;
    globalTreeBak: Tree | null;
    globalParseTree: Tree | null;
    globalDataSaved: boolean;
    globalSkipFocus: boolean;
    globalCompletedHidden: boolean;
    globalDiffUncommitted: boolean;
    globalSkipNextUndo: boolean;
    changeHiddenComplete: () => void;
    setGlobalTree: (tree: Tree) => void;
    setGlobalTreeBak: (tree: Tree) => void;
    setGloablSkipFocus: (skip: boolean) => void;
    setGlobalDiffUncommitted: (diff: boolean) => void;
    setSelected: (uuid: string | null) => void;
}

export const useBaseStore = create<BaseState>((set) => ({
    globalTree: null,
    globalTreeBak: null,
    globalParseTree: null,
    globalDataSaved: true,
    globalSkipFocus: false,
    globalCompletedHidden: false,
    globalDiffUncommitted: false,
    globalSkipNextUndo: false,
    changeHiddenComplete: () => set((state) => ({ globalCompletedHidden: !state.globalCompletedHidden })),
    setGlobalTree: (tree: Tree | null) => set({ globalTree: tree }),
    setGlobalTreeBak: (tree: Tree | null) => set({ globalTreeBak: tree }),
    setGloablSkipFocus: (skip: boolean) => set({ globalSkipFocus: skip }),
    setGlobalDiffUncommitted: (diff: boolean) => set({ globalDiffUncommitted: diff }),
    setSelected: (selected: string | null) =>
        set((state) => ({
            globalTree: {
                ...state.globalTree,
                selected: selected ? selected : null,
            },
        })),
}));
