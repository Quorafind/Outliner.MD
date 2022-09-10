import * as React from 'react';
import { useBaseStore } from '../store/baseStore';

interface Props {
}

const DataSavedBtn: React.FC<Props> = () => {
    const globalDataSaved = useBaseStore((state) => state.globalDataSaved);

    return <span className="saved-text">{ globalDataSaved ? 'Saved' : 'Unsaved' }</span>;
};

export default DataSavedBtn;

