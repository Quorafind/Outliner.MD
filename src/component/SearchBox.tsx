import * as React from 'react';
import { useState } from 'react';
import { useBaseStore } from '../store/baseStore';
import { TreeNS } from '../utils/tree';

interface Props {
}

const SearchBox: React.FC<Props> = () => {
    const [value, setValue] = useState<string>('');

    const globalTree = useBaseStore((state) => state.globalTree);
    const globalTreeBak = useBaseStore((state) => state.globalTreeBak);
    const setGlobalTree = useBaseStore((state) => state.setGlobalTree);
    const setGlobalTreeBak = useBaseStore((state) => state.setGlobalTreeBak);
    const setSelected = useBaseStore((state) => state.setSelected);
    const setGlobalRenderAllNoUndo = useBaseStore((state) => state.setGlobalRenderAllNoUndo);

    const handleChange = (event: React.FormEvent<HTMLInputElement>) => {
        if (value?.length > 0) {
            setValue(event.currentTarget.value);
        }

        if (event.currentTarget.value.length === 0) {
            setGlobalTree(globalTreeBak);
            setGlobalTreeBak(null);
            setGlobalRenderAllNoUndo();
            return;
        }
        if (!globalTreeBak) {
            setGlobalTreeBak(globalTree);
            setGlobalTree(TreeNS.search(globalTree, event.currentTarget.value));
        } else {
            setGlobalTree(TreeNS.search(globalTree, event.currentTarget.value));
        }
        setGlobalRenderAllNoUndo();
    };

    const handleFocus = () => {
        setSelected(null);
    };

    return (
        <input
            type="text"
            className="search"
            placeholder="Search"
            value={ value }
            onChange={ handleChange }
            onFocus={ handleFocus }
        />
    );
};

export default SearchBox;
