// Web Worker for running solver in background thread
// This keeps the UI responsive during computation

import { solve } from './Solver.tsx';

self.onmessage = (event: MessageEvent<number[][]>) => {
    const board = event.data;
    const result = solve(board);
    self.postMessage(result);
};
