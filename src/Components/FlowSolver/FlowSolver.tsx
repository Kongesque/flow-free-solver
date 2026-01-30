import React, { useState, useCallback, useEffect, useRef } from 'react';
import { savePuzzleState, loadPuzzleState, clearPuzzleState } from '../../hooks/useStorage';

const FlowSolver = () => {
    const defaultSize = 5;
    const sizeOptions = [5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

    // color palette
    const COLORS: Record<number, string> = {
        1: '#FF0000',  // R - Red
        2: '#0000FF',  // B - Blue
        3: '#FFFF00',  // Y - Yellow
        4: '#008000',  // G - Green
        5: '#FFA500',  // O - Orange
        6: '#00FFFF',  // C - Cyan
        7: '#FF00FF',  // M - Magenta
        8: '#800000',  // m - Maroon
        9: '#800080',  // P - Purple
        10: '#808080', // A - Gray
        11: '#FFFFFF', // W - White
        12: '#00FF00', // g - Bright Green
        13: '#D2B48C', // T - Tan
        14: '#00008B', // b - Dark Blue
        15: '#008B8B', // c - Dark Cyan
        16: '#FFC0CB', // p - Pink
    };

    const initializeBoard = (boardSize: number) => {
        return Array(boardSize).fill(null).map(() => Array(boardSize).fill(0));
    };

    const [size, setSize] = useState(defaultSize);
    const [board, setBoard] = useState<number[][]>(() => initializeBoard(defaultSize));
    const [solvedBoard, setSolvedBoard] = useState<number[][] | null>(null);

    // UX: Track current color being placed and whether we're placing first or second endpoint
    const [activeColor, setActiveColor] = useState(1);
    const [isPlacingSecond, setIsPlacingSecond] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isSolving, setIsSolving] = useState(false);
    const [solverType, setSolverType] = useState<'astar' | 'z3' | 'heuristic_bfs'>('heuristic_bfs');

    const [solveTime, setSolveTime] = useState<number | null>(null);

    // Prevent hover preview flash during reset
    const [isResetting, setIsResetting] = useState(false);

    // IndexedDB: Track if initial load is complete
    const [isLoaded, setIsLoaded] = useState(false);
    const saveTimeoutRef = useRef<number | null>(null);

    // Load saved state on mount
    useEffect(() => {
        loadPuzzleState().then((saved) => {
            if (saved) {
                setSize(saved.size);
                setBoard(saved.board);
                setSolverType(saved.solverType);
                setActiveColor(saved.activeColor);
                setIsPlacingSecond(saved.isPlacingSecond);
            }
            setIsLoaded(true);
        });
    }, []);

    // Auto-save state on changes (debounced 500ms)
    useEffect(() => {
        if (!isLoaded) return; // Don't save until initial load is complete

        if (saveTimeoutRef.current) {
            clearTimeout(saveTimeoutRef.current);
        }

        saveTimeoutRef.current = window.setTimeout(() => {
            savePuzzleState({
                size,
                board,
                solverType,
                activeColor,
                isPlacingSecond,
            });
        }, 500);

        return () => {
            if (saveTimeoutRef.current) {
                clearTimeout(saveTimeoutRef.current);
            }
        };
    }, [size, board, solverType, activeColor, isPlacingSecond, isLoaded]);

    const resetBoard = useCallback((newSize: number = size) => {
        // Prevent hover preview flash by setting isResetting before state changes
        setIsResetting(true);
        setBoard(initializeBoard(newSize));
        setSolvedBoard(null);
        setActiveColor(1);
        setIsPlacingSecond(false);
        setError(null);
        setSolveTime(null);
        // Clear saved state on reset
        clearPuzzleState();
        // Re-enable hover preview after React has completed the render cycle
        requestAnimationFrame(() => setIsResetting(false));
    }, [size]);

    const handleSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = parseInt(event.target.value);
        setSize(newSize);
        resetBoard(newSize);
    };

    // Helper: count occurrences of a color on the board
    const countColor = (board: number[][], color: number) =>
        board.flat().filter(c => c === color).length;

    // UX Best Practices:
    // 1. Simple mental model: Click empty = place, Click filled = remove
    // 2. Clear feedback: Show which color is being placed
    // 3. Predictable: Same action = same result
    // 4. Forgiving: Easy to undo mistakes
    const handleCellClick = useCallback((x: number, y: number) => {
        if (solvedBoard) return;

        const cellValue = board[x][y];
        const newBoard = board.map(row => [...row]);

        if (cellValue !== 0) {
            // REMOVE: Clicking a filled cell removes it
            newBoard[x][y] = 0;

            // Determine how many of this color remain
            const remaining = countColor(newBoard, cellValue);

            if (remaining === 1) {
                // One endpoint left - switch to complete this pair
                setActiveColor(cellValue);
                setIsPlacingSecond(true);
            } else if (remaining === 0) {
                // Both removed - find the lowest incomplete color
                let lowestIncomplete = 1;
                while (countColor(newBoard, lowestIncomplete) === 2) {
                    lowestIncomplete++;
                }
                setActiveColor(lowestIncomplete);
                setIsPlacingSecond(countColor(newBoard, lowestIncomplete) === 1);
            }
            // If remaining === 2 (impossible here) or other cases, don't change active color
        } else {
            // PLACE: Clicking empty cell places the active color
            // BUG FIX: Check if this color already has 2 endpoints
            const currentCount = countColor(board, activeColor);
            if (currentCount >= 2) {
                // Color is complete - find next available
                let nextColor = activeColor;
                while (countColor(board, nextColor) >= 2 && nextColor <= 16) {
                    nextColor++;
                }
                if (nextColor > 16) return; // All colors placed
                setActiveColor(nextColor);
                setIsPlacingSecond(countColor(board, nextColor) === 1);
                return; // Don't place yet, let user click again with updated color
            }

            newBoard[x][y] = activeColor;

            if (currentCount === 1) {
                // This was the 2nd endpoint - advance to next color
                let nextColor = activeColor + 1;
                while (countColor(newBoard, nextColor) >= 2 && nextColor <= 16) {
                    nextColor++;
                }
                setActiveColor(nextColor);
                setIsPlacingSecond(false);
            } else {
                // This was the 1st endpoint
                setIsPlacingSecond(true);
            }
        }

        setBoard(newBoard);
    }, [board, solvedBoard, activeColor]);



    const solveBoard = async () => {
        // Clear any previous error and set loading
        setError(null);
        setIsSolving(true);

        // Use Web Worker to run solver in background thread
        // This keeps CSS animations responsive
        const worker = new Worker(
            new URL('./solver.worker.ts', import.meta.url),
            { type: 'module' }
        );

        const startTime = performance.now();

        worker.postMessage({ board, type: solverType });

        worker.onmessage = (event) => {
            const result = event.data;
            setIsSolving(false);
            worker.terminate();

            if (result.board) {
                const endTime = performance.now();
                setSolveTime(endTime - startTime);
                setSolvedBoard(result.board);
            } else if (result.timedOut) {
                setError('Timed out (15s limit)');
                // Auto-dismiss error after 4 seconds
                setTimeout(() => setError(null), 4000);
            } else if (result.error) {
                setError('Solver error: ' + result.error);
                setTimeout(() => setError(null), 3000);
            } else {
                setError('No solution found');
                // Auto-dismiss error after 3 seconds
                setTimeout(() => setError(null), 3000);
            }
        };

        worker.onerror = (error) => {
            console.error('Worker error:', error);
            setIsSolving(false);
            setError('Solver error');
            setTimeout(() => setError(null), 3000);
            worker.terminate();
        };
    };

    // Declarative Board Rendering
    const currentBoard = solvedBoard || board;

    return (

        <main className='flex flex-col justify-center items-center h-[100dvh] w-full bg-stoic-bg safe-area-inset touch-manipulation overflow-hidden gap-6 sm:gap-8'>
            {/* Header with clear hierarchy */}
            <header className='text-center flex flex-col items-center gap-1 selectable-text shrink-0'>
                <h1 className='text-stoic-primary text-xl sm:text-2xl md:text-3xl uppercase tracking-[0.2em] font-bold'>
                    Flow Free Solver
                </h1>
            </header>

            {/* Grid - Core Interaction Area */}
            <article
                aria-label="Puzzle Grid Board"
                className="grid bg-stoic-line border-2 border-stoic-line mx-auto shrink-0"
                style={{
                    gap: '2px',
                    gridTemplateColumns: `repeat(${size}, 1fr)`,
                    gridTemplateRows: `repeat(${size}, 1fr)`,
                    width: 'min(90vw, 55vh)',
                    height: 'min(90vw, 55vh)'
                }}
            >
                {Array.from({ length: size }).map((_, y) =>
                    Array.from({ length: size }).map((_, x) => {
                        const cellValue = currentBoard[x]?.[y] ?? 0;
                        const hasColor = cellValue !== 0;

                        return (
                            <button
                                key={`${x}-${y}`}
                                type="button"
                                className={`
                                    group
                                    w-full h-full
                                    bg-stoic-block-bg
                                    p-0 m-0 appearance-none cursor-pointer 
                                    flex items-center justify-center 
                                    transition-all duration-150
                                    touch-manipulation
                                    select-none
                                    ${solvedBoard ? 'cursor-default' : 'hover:bg-stoic-block-hover active:scale-95 active:bg-stoic-block-hover'}
                                `}
                                onClick={() => !solvedBoard && handleCellClick(x, y)}
                                aria-label={`Cell ${x},${y} ${hasColor ? `Color ${cellValue}` : 'Empty'}`}
                            >
                                {hasColor ? (
                                    <span
                                        className="rounded-full w-[70%] h-[70%]"
                                        style={{ backgroundColor: COLORS[cellValue] || '#888' }}
                                    />
                                ) : !solvedBoard && !isResetting && (
                                    <span
                                        className="rounded-full w-[70%] h-[70%] opacity-0 group-hover:opacity-50 transition-opacity duration-75"
                                        style={{ backgroundColor: COLORS[activeColor] || '#888' }}
                                    />
                                )}
                            </button>
                        );
                    })
                )}
            </article>

            {/* Controls & Status Section */}
            <section aria-label="Game Controls" className="flex flex-col items-center gap-6 shrink-0 z-10">
                {/* Status indicator - contextual feedback */}
                <div role="status" className='flex items-center gap-3 min-h-[28px] selectable-text'>
                    {isSolving ? (
                        <span className='text-stoic-accent text-sm uppercase tracking-widest font-semibold flex items-center gap-2'>
                            <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                            Solving…
                        </span>
                    ) : error ? (
                        <span className='text-sm uppercase tracking-widest font-semibold animate-pulse'
                            style={{ color: '#FF3B30' }}
                        >
                            ✗ {error}
                        </span>
                    ) : solvedBoard ? (
                        <span className='text-stoic-accent text-sm uppercase tracking-widest font-semibold flex items-center gap-2'>
                            ✓ Solved
                            {solveTime !== null && (
                                <span className="text-stoic-secondary text-xs opacity-75">
                                    ({solveTime < 1000 ? `${Math.round(solveTime)}ms` : `${(solveTime / 1000).toFixed(2)}s`})
                                </span>
                            )}
                        </span>
                    ) : (
                        <div className='flex items-center gap-3'>
                            <span className='text-stoic-primary text-sm uppercase tracking-wider font-medium'>Place</span>
                            <div className="flex items-center gap-3">
                                <span
                                    className="w-4 h-4 rounded-full"
                                    style={{ backgroundColor: COLORS[activeColor] || '#888' }}
                                />
                                <span className='text-stoic-primary text-sm uppercase tracking-wider font-medium'>
                                    {isPlacingSecond ? 'End' : 'Start'}
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Controls - responsive layout */}
                <div className="flex flex-wrap items-center justify-center gap-3">
                    <div className="relative">
                        <select
                            className='h-9 sm:h-10 pl-3 pr-7 text-xs border border-stoic-line bg-stoic-bg text-stoic-primary uppercase tracking-wide focus:outline-none focus:border-stoic-accent cursor-pointer appearance-none'
                            value={size}
                            onChange={handleSizeChange}
                            aria-label="Grid Size"
                        >
                            {sizeOptions.map(option => (
                                <option key={option} value={option}>{option}×{option}</option>
                            ))}
                        </select>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stoic-secondary pointer-events-none text-[10px]">▼</span>
                    </div>

                    <div className="relative">
                        <select
                            className='h-9 sm:h-10 pl-3 pr-7 text-xs border border-stoic-line bg-stoic-bg text-stoic-primary uppercase tracking-wide focus:outline-none focus:border-stoic-accent cursor-pointer appearance-none'
                            value={solverType}
                            onChange={(e) => setSolverType(e.target.value as 'astar' | 'z3' | 'heuristic_bfs')}
                            aria-label="Solver Algorithm"
                        >
                            <option value="astar">A*</option>
                            <option value="z3">SAT (Z3)</option>
                            <option value="heuristic_bfs">Heuristic BFS</option>
                        </select>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stoic-secondary pointer-events-none text-[10px]">▼</span>
                    </div>

                    <button
                        className='h-9 sm:h-10 px-4 text-xs border-2 border-stoic-accent bg-stoic-accent text-stoic-bg font-bold uppercase tracking-wider hover:bg-transparent hover:text-stoic-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-stoic-accent disabled:hover:text-stoic-bg select-none flex items-center gap-2'
                        onClick={solveBoard}
                        disabled={isSolving}
                    >
                        {isSolving && (
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                                <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                            </svg>
                        )}
                        {isSolving ? 'Solving' : 'Solve'}
                    </button>

                    <button
                        className='h-9 sm:h-10 px-3 text-xs border border-stoic-line bg-transparent text-stoic-secondary uppercase tracking-wider hover:border-stoic-secondary hover:text-stoic-primary transition-colors select-none'
                        onClick={() => resetBoard()}
                    >
                        Reset
                    </button>
                </div>
            </section>

            <footer className="px-6 max-w-lg text-center text-stoic-secondary text-xs leading-relaxed selectable-text shrink-0">
                <p>
                    Solve any Flow Free or Numberlink puzzle instantly.
                    <br className="hidden sm:block" />
                    Powered by SAT (Z3) & A* search · 5×5 to 15×15 grids.
                </p>
                <p className="mt-2 text-stoic-secondary/70">
                    <strong className="text-stoic-secondary">Tips:</strong> Click to place endpoints, click again to remove.                </p>
                <div className="mt-2 flex justify-center gap-4">
                    <a href="https://www.kongesque.com/" target="_blank" rel="noopener noreferrer" className="hover:text-stoic-primary hover:underline transition-colors">Author</a>
                    <a href="https://github.com/Kongesque/flow-free-solver" target="_blank" rel="noopener noreferrer" className="hover:text-stoic-primary hover:underline transition-colors">GitHub</a>
                    <a href="https://en.wikipedia.org/wiki/Numberlink" target="_blank" rel="noopener noreferrer nofollow" className="hover:text-stoic-primary hover:underline transition-colors">Wikipedia</a>
                </div>
            </footer>
        </main>
    );

};

export default FlowSolver;
