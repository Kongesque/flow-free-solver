// Web Worker for running solver in background thread
// This keeps the UI responsive during computation

import { solve as solveAStar } from './Solver.tsx';
import { solveZ3 } from './Z3Solver';

self.onmessage = async (event: MessageEvent<{ board: number[][], type: 'astar' | 'z3' }>) => {
    const { board, type } = event.data;

    try {
        if (type === 'z3') {
            const result = await solveZ3(board);
            // Match the existing return shape roughly, or normalized it?
            // Existing solveAStar returns { board, timedOut, timeTaken, nodeCount }
            // Let's wrap Z3 result
            if (result) {
                self.postMessage({ board: result, timedOut: false, timeTaken: 0, nodeCount: 0 });
            } else {
                self.postMessage({ board: null, timedOut: false, timeTaken: 0, nodeCount: 0 });
            }
        } else {
            const result = solveAStar(board);
            self.postMessage(result);
        }
    } catch (e) {
        console.error(e);
        self.postMessage({ board: null, timedOut: false, error: String(e), timeTaken: 0, nodeCount: 0 });
    }
};
