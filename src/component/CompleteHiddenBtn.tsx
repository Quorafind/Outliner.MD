import * as React from 'react';
import { useBaseStore } from '../store/baseStore';

interface Props {
}

const CompleteHiddenBtn: React.FC<Props> = () => {
    const globalCompletedHidden = useBaseStore((state) => state.globalCompletedHidden);
    const changeHiddenComplete = useBaseStore((state) => state.changeHiddenComplete);

    const handleClick = () => {
        changeHiddenComplete();
        renderAll();
    };

    return (
        <a href="#" className="completed-hidden-button" onClick={ handleClick }>
            { globalCompletedHidden ? 'Show completed' : 'Hide completed' }
        </a>
    );
};

export default CompleteHiddenBtn;
