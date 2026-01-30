// worker thread to keep ui smooth

import { solve as solveAStar } from '../logic/astar-solver.js';
import { solveZ3 } from '../logic/z3-solver.js';


const COLOR_CHARS = [
    '', 'R', 'B', 'Y', 'G', 'O', 'C', 'M', 'm', 'P', 'A', 'W', 'g', 'T', 'b', 'c', 'p'
];

let cSolverInstance: any = null;

async function solveHeuristicBFS(board: number[][]): Promise<any> {
    if (!cSolverInstance) {
        try {
            // @ts-ignore
            // loading wasm module manually bc vite/worker types are annoying
            const module = await import('../../../public/wasm/flow_solver_c.js');
            const createFlowSolver = module.default;
            cSolverInstance = await createFlowSolver({
                locateFile: (path: string) => {
                    if (path.endsWith('.wasm')) {
                        // The WASM file is served from public/wasm/
                        return '/wasm/flow_solver_c.wasm';
                    }
                    return path;
                }
            });
        } catch (e) {
            console.error('Failed to load WASM solver', e);
            throw new Error('Could not load C solver WASM');
        }
    }

    // 1. serialize board
    // max size 15 for c solver iirc
    const size = board.length;
    let inputStr = "";

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {

            // board is [col][row] so this is [c][r]. 
            // confusing but it works
            const cellVal = board[c][r];

            if (cellVal > 0 && cellVal < COLOR_CHARS.length) {
                inputStr += COLOR_CHARS[cellVal];
            } else {
                inputStr += ".";
            }
        }
        inputStr += "\n";
    }

    // 2. Call WASM function
    const solve = cSolverInstance.cwrap('solve_puzzle_wasm', 'string', ['string']);
    const jsonResult = solve(inputStr);

    if (!jsonResult || jsonResult.startsWith('Error')) {
        return null;
    }

    // 3. Parse JSON result
    try {
        const solvedBoard = JSON.parse(jsonResult);

        // json result is row-major, need to transpose back to [x][y]
        // logic is kinda backwards here but correct matches the c output

        const newBoard = Array(size).fill(null).map(() => Array(size).fill(0));
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // map ascii code back to color id
                // if 'R' -> 1 etc

                const code = solvedBoard[y][x];
                if (code === 0) {
                    newBoard[x][y] = 0;
                } else {
                    const char = String.fromCharCode(code);
                    const id = COLOR_CHARS.indexOf(char);
                    newBoard[x][y] = id > 0 ? id : 0;
                }
            }
        }
        return newBoard;

    } catch (e) {
        console.error("Failed to parse solver output", jsonResult, e);
        return null;
    }
}

self.onmessage = async (event: MessageEvent<{ board: number[][], type: 'astar' | 'z3' | 'heuristic_bfs' }>) => {
    const { board, type } = event.data;

    try {
        if (type === 'z3') {
            const result = await solveZ3(board);
            if (result) {
                self.postMessage({ board: result, timedOut: false, timeTaken: 0, nodeCount: 0 });
            } else {
                self.postMessage({ board: null, timedOut: false, timeTaken: 0, nodeCount: 0 });
            }
        } else if (type === 'heuristic_bfs') {
            const result = await solveHeuristicBFS(board);
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
