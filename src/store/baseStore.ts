import create from 'zustand'

const useBaseStore = create((set) => ({
    bears: 0,
    reactTree: {},
    globalTree: {},
    globalTreeBak: {},
    globalParseTree: {},
    globalDataSaved: true,
    globalSkipFocus: false,
    globalCompletedHidden: null,
    globalDiffUncommitted: false,
    globalSkipNextUndo: false,
    increasePopulation: () => set((state) => ({ bears: state.bears + 1 })),
    removeAllBears: () => set({ bears: 0 }),
}))
