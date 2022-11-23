import { Tree } from "../types/tree";

export default class UndoRing {
    length: number;
    ring: Tree[];
    start: number;
    end: number;
    current: number;
    pending: Tree | null;

    constructor(obj: Tree, length: number) {
        this.length = length;
        this.ring = [];
        // TODO should I remove this?
        for (let i = 0; i < this.length; i++) {
            this.ring.push({ childNodes: [{ title: 'nothing' }] });
        }
        this.ring[0] = obj;
        this.start = 0;
        this.end = 0;
        this.current = 0;
        this.pending = null;
    }

    undo() {
        if (this.pending) {
            this.commit();
        }
        if (this.current == this.end) {
            return this.ring[this.current];
        }
        this.current = (this.current + this.length - 1) % this.length;
        return this.ring[this.current];
    }

    redo() {
        if (this.pending) {
            this.commit();
        }
        if (this.current == this.start) {
            return this.ring[this.current];
        }
        this.current = (this.current + 1) % this.length;
        return this.ring[this.current];
    }

    addPending(obj) {
        this.pending = obj;
    }

    commit() {
        if (this.pending) {
            this.start = this.current;
            if (this.bufferFull()) {
                this._pop();
            }
            this.current = this.start = (this.start + 1) % this.length;
            this.ring[this.start] = this.pending;

            this.pending = null;
        }
    }

    _pop() {
        this.end = (this.end + 1) % this.length;
    }

    bufferFull() {
        return (
            this.end - this.start === 1 ||
            (this.end === 0 && this.start === this.length - 1)
        );
    }
}
