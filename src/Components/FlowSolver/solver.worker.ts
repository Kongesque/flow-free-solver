// Web Worker for running solver in background thread
// This keeps the UI responsive during computation

import { solve as solveAStar } from './Solver.tsx';
import { solveZ3 } from './Z3Solver';


const COLOR_CHARS = [
    '', 'R', 'B', 'Y', 'G', 'O', 'C', 'M', 'm', 'P', 'A', 'W', 'g', 'T', 'b', 'c', 'p'
];

let cSolverInstance: any = null;

async function solveCSolver(board: number[][]): Promise<any> {
    if (!cSolverInstance) {
        try {
            // Import the Emscripten module from src folder
            // @ts-ignore
            const module = await import('../../wasm/flow_solver_c.js');
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

    // 1. Convert board to string format
    // Each line is a row. Chars are color codes or '.' for empty.
    const size = board.length;
    let inputStr = "";

    // Check constraints: max size 15 usually for C solver? Limit is defined in C code MAX_SIZE=15.
    // If larger, it might fail.

    for (let r = 0; r < size; r++) {
        for (let c = 0; c < size; c++) {

            // Existing code seems to use board[col][row]? 
            // Let's verify FlowSolver.tsx: handleCellClick(x, y) -> board[x][y].
            // Usually x is column, y is row.
            // But loops in renderer: map((_, y) => map((_, x) => ... currentBoard[x][y]
            // So board is [col][row].
            // To print rows, we loop y then x.

            const cellVal = board[c][r]; // Wait, loop outer r (y), inner c (x).
            // So board[c][r] is board[x][y]. Correct.

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

        // Convert back to [col][row] format if needed?
        // JSON is [[row0...], [row1...]] usually?
        // C code:
        // for (size_t i=0; i<info.size; ++i) { // i is row? or col?
        //    for (size_t j=0; j<info.size; ++j) {
        //        ptr += sprintf(ptr, "%d", ...);	
        // C code `pos_from_coords(j, i)` implies j=x, i=y.
        // So outer loop i is Y (rows). Inner loop j is X (cols).
        // So JSON is [[(0,0), (1,0)...], [(0,1)...]].
        // Effectively row-major.

        // Frontend expects board[x][y].
        // So we need to transpose or map correctly.
        // solvedBoard[y][x] -> newBoard[x][y]

        const newBoard = Array(size).fill(null).map(() => Array(size).fill(0));
        for (let y = 0; y < size; y++) {
            for (let x = 0; x < size; x++) {
                // If solvedBoard[y][x] is ASCII code, convert to ID
                // Wait, C code returns ASCII code of the char.
                // We need to map ASCII 'R' -> 1.
                // We can use COLOR_CHARS.indexOf(String.fromCharCode(code))

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

self.onmessage = async (event: MessageEvent<{ board: number[][], type: 'astar' | 'z3' | 'c_solver' }>) => {
    const { board, type } = event.data;

    try {
        if (type === 'z3') {
            const result = await solveZ3(board);
            if (result) {
                self.postMessage({ board: result, timedOut: false, timeTaken: 0, nodeCount: 0 });
            } else {
                self.postMessage({ board: null, timedOut: false, timeTaken: 0, nodeCount: 0 });
            }
        } else if (type === 'c_solver') {
            const result = await solveCSolver(board);
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
