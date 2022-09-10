export interface Tree {
    title: string;
    childNodes?: Tree[] | undefined;
    uuid?: string;
    uuidMap?: UUIDMap[];
    parent?: Tree | null;
    selected?: string | null;
    zoom?: Tree;
    collapsed?: boolean;
    completed?: boolean;
    zoomUUID?: string;
    completedHidden?: boolean;
    caretLoc?: number;
    diff?: DiffMap;
}

export interface Option {
    noparent?: boolean;
    nomouse?: boolean;
    clean?: boolean;
}

export interface UUIDMap {
    [key: string]: Tree;
}

export interface DiffMap {
    [key: string]: Tree;
}
