// @ts-ignore
import { init as lowLevelInit } from 'z3-solver/build/low-level/wrapper.__GENERATED__';
// @ts-ignore
import { createApi } from 'z3-solver/build/high-level';
import type { Board } from './astar-solver';

export async function solveZ3(board: Board): Promise<Board | null> {
    const baseUrl = (import.meta as any).env.BASE_URL || '/';

    if (import.meta.env.DEV) console.log('[Z3Solver] Dynamically importing Z3 module');

    // dynamic import z3 bc it's huge
    // @ts-ignore  
    const { default: initZ3 } = await import('z3-solver/build/z3-built');

    if (import.meta.env.DEV) console.log('[Z3Solver] Z3 module imported successfully');

    if (import.meta.env.DEV) console.log('[Z3Solver] Initializing Z3');

    // Initialize the Emscripten module with locateFile for WASM and worker
    const emModule = await initZ3({
        locateFile: (path: string) => {
            if (path.endsWith('.wasm')) {
                if (import.meta.env.DEV) console.log(`[Z3Solver] locateFile for WASM: ${path}`);
                return baseUrl + 'wasm/z3-built.wasm';
            }
            if (path.endsWith('.worker.js')) {
                if (import.meta.env.DEV) console.log(`[Z3Solver] locateFile for worker: ${path}`);
                return baseUrl + 'wasm/z3-built.worker.js';
            }
            if (import.meta.env.DEV) console.log(`[Z3Solver] locateFile for unknown: ${path}`);
            return path;
        },
        mainScriptUrlOrBlob: baseUrl + 'wasm/z3-built.js'
    });

    // Build low-level API from the initialized Emscripten module
    const lowLevel = await lowLevelInit(() => Promise.resolve(emModule));

    // Build high-level API from low-level
    const highLevel = createApi(lowLevel.Z3);

    // ready only took 3 days to figure this api out
    const { Context } = highLevel;
    const { Solver, Int, Sum, If } = Context('main');

    const solver = new Solver();
    const M = board.length;
    const N = board[0].length;

    // Create variables B_i_j
    const B: any[][] = [];
    for (let i = 0; i < M; i++) {
        const row: any[] = [];
        for (let j = 0; j < N; j++) {
            row.push(Int.const(`B_${i}_${j}`));
        }
        B.push(row);
    }

    // Add constraints
    for (let i = 0; i < M; i++) {
        for (let j = 0; j < N; j++) {
            if (board[i][j] > 0) {
                // Fixed value
                solver.add(B[i][j].eq(board[i][j]));
            } else {
                // part of flow must be > 0 
                solver.add(B[i][j].gt(0));
            }
        }
    }

    // Neighbor constraints
    for (let i = 0; i < M; i++) {
        for (let j = 0; j < N; j++) {
            const neighbors: any[] = [];

            // Check 4 directions
            const directions = [[-1, 0], [1, 0], [0, -1], [0, 1]];
            for (const [dx, dy] of directions) {
                const ni = i + dx;
                const nj = j + dy;

                if (ni >= 0 && ni < M && nj >= 0 && nj < N) {
                    // neighbor same color? +1
                    neighbors.push(If(B[i][j].eq(B[ni][nj]), 1, 0));
                }
            }

            const neighsSum = Sum(...(neighbors as [any, ...any[]]));

            if (board[i][j] > 0) {
                // Endpoint: must have exactly 1 neighbor of same color
                solver.add(neighsSum.eq(1));
            } else {
                // path needs exactly 2 neighbors (in/out)
                solver.add(neighsSum.eq(2));
            }
        }
    }

    // Check satisfiability
    const check = await solver.check();

    if (check === 'sat') {
        const model = solver.model();
        const solvedBoard: Board = board.map(row => [...row]);

        for (let i = 0; i < M; i++) {
            for (let j = 0; j < N; j++) {
                const val = model.eval(B[i][j]);
                const sVal = (val as any).asString();
                solvedBoard[i][j] = parseInt(sVal);
            }
        }
        return solvedBoard;
    } else {
        return null;
    }
}

