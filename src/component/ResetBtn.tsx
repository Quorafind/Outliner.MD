import * as React from 'react';
import { useBaseStore } from '../store/baseStore';
import { TreeNS } from '../utils/tree';

interface Props {
}

const ResetBtn: React.FC<Props> = () => {
    const setGlobalTree = useBaseStore((state) => state.setGlobalTree);

    const handleClick = () => {
        setGlobalTree(TreeNS.makeDefaultTree());
        renderAll();
    };

    return (
        <a href="#" onClick={ handleClick }>
            Reset
        </a>
    );
};

export default ResetBtn;
