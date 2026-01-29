import React, { useState, useCallback } from 'react';

const FlowSolver = () => {
    const defaultSize = 5;
    const sizeOptions = [5, 6, 7, 8, 9, 10];

    // Vibrant color palette
    const COLORS: Record<number, string> = {
        1: '#FF3B30',  // Red
        2: '#007AFF',  // Blue
        3: '#34C759',  // Green
        4: '#FFCC00',  // Yellow
        5: '#AF52DE',  // Purple
        6: '#FF9500',  // Orange
        7: '#00C7BE',  // Teal
        8: '#FF2D92',  // Pink
        9: '#5856D6',  // Indigo
        10: '#A2845E', // Brown
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

    const resetBoard = useCallback((newSize: number = size) => {
        setBoard(initializeBoard(newSize));
        setSolvedBoard(null);
        setActiveColor(1);
        setIsPlacingSecond(false);
        setError(null);
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
                while (countColor(board, nextColor) >= 2 && nextColor <= 10) {
                    nextColor++;
                }
                if (nextColor > 10) return; // All colors placed
                setActiveColor(nextColor);
                setIsPlacingSecond(countColor(board, nextColor) === 1);
                return; // Don't place yet, let user click again with updated color
            }

            newBoard[x][y] = activeColor;

            if (currentCount === 1) {
                // This was the 2nd endpoint - advance to next color
                let nextColor = activeColor + 1;
                while (countColor(newBoard, nextColor) >= 2 && nextColor <= 10) {
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

    const [solverType, setSolverType] = useState<'astar' | 'z3'>('z3');

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

        worker.onmessage = (event) => {
            const result = event.data;
            setIsSolving(false);
            worker.terminate();

            if (result.board) {
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

        worker.postMessage({ board, type: solverType });
    };

    // Declarative Board Rendering
    const currentBoard = solvedBoard || board;

    return (
        <main className='flex flex-col justify-center items-center min-h-screen px-4 py-6 bg-stoic-bg safe-area-inset touch-manipulation overflow-auto'>
            {/* Header with clear hierarchy */}
            <header className='mb-4 sm:mb-6 md:mb-8 text-center flex flex-col items-center gap-2 selectable-text'>
                <h1 className='text-stoic-primary text-lg sm:text-xl md:text-2xl lg:text-3xl uppercase tracking-[0.1em] sm:tracking-[0.15em] font-bold'>
                    Flow Free Solver
                </h1>


            </header>

            {/* Grid - flat brutalist, responsive cell sizes */}
            <div
                className="flex flex-col bg-stoic-line border-2 border-stoic-line"
                style={{ gap: '2px' }}
            >
                {Array.from({ length: size }).map((_, y) => (
                    <div key={y} className="flex" style={{ gap: '2px' }}>
                        {Array.from({ length: size }).map((_, x) => {
                            const cellValue = currentBoard[x]?.[y] ?? 0;
                            const hasColor = cellValue !== 0;

                            // Dynamic cell size based on grid size for mobile fit
                            // Smaller grids = larger cells, larger grids = smaller cells
                            const cellSizeClass = size <= 6
                                ? 'w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16'
                                : size <= 8
                                    ? 'w-10 h-10 sm:w-12 sm:h-12 md:w-14 md:h-14'
                                    : 'w-8 h-8 sm:w-10 sm:h-10 md:w-12 md:h-12';

                            const circleSizeClass = size <= 6
                                ? 'w-9 h-9 sm:w-10 sm:h-10 md:w-12 md:h-12'
                                : size <= 8
                                    ? 'w-7 h-7 sm:w-8 sm:h-8 md:w-10 md:h-10'
                                    : 'w-5 h-5 sm:w-7 sm:h-7 md:w-8 md:h-8';

                            return (
                                <button
                                    key={x}
                                    type="button"
                                    className={`
                                        group
                                        ${cellSizeClass}
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
                                            className={`${circleSizeClass} rounded-full`}
                                            style={{ backgroundColor: COLORS[cellValue] || '#888' }}
                                        />
                                    ) : !solvedBoard && (
                                        <span
                                            className={`${circleSizeClass} rounded-full opacity-0 group-hover:opacity-50 transition-opacity duration-75`}
                                            style={{ backgroundColor: COLORS[activeColor] || '#888' }}
                                        />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                ))}
            </div>

            {/* Status indicator - contextual feedback */}
            <div className='mt-6 flex items-center gap-3 min-h-[28px] selectable-text'>
                {isSolving ? (
                    <span className='text-stoic-accent text-sm uppercase tracking-widest font-semibold flex items-center gap-2'>
                        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
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
                    <span className='text-stoic-accent text-sm uppercase tracking-widest font-semibold'>
                        ✓ Solved
                    </span>
                ) : (
                    <>
                        <span className='text-stoic-secondary text-sm uppercase tracking-wider'>Put</span>
                        <span
                            className="w-5 h-5 rounded-full"
                            style={{ backgroundColor: COLORS[activeColor] || '#888' }}
                        />
                        <span className='text-stoic-secondary text-sm uppercase tracking-wider'>
                            {isPlacingSecond ? '2nd' : '1st'}
                        </span>
                    </>
                )}
            </div>

            {/* Controls - responsive layout */}
            <div className="flex flex-wrap items-center justify-center gap-2 sm:gap-3 mt-4 sm:mt-6">
                <div className="relative">
                    <select
                        className='h-10 sm:h-11 pl-3 pr-8 text-xs sm:text-sm border border-stoic-line bg-stoic-bg text-stoic-primary uppercase tracking-wide focus:outline-none focus:border-stoic-accent cursor-pointer appearance-none'
                        value={size}
                        onChange={handleSizeChange}
                    >
                        {sizeOptions.map(option => (
                            <option key={option} value={option}>{option}×{option}</option>
                        ))}
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stoic-secondary pointer-events-none text-xs sm:text-sm">▼</span>
                </div>

                <div className="relative">
                    <select
                        className='h-10 sm:h-11 pl-3 pr-8 text-xs sm:text-sm border border-stoic-line bg-stoic-bg text-stoic-primary uppercase tracking-wide focus:outline-none focus:border-stoic-accent cursor-pointer appearance-none'
                        value={solverType}
                        onChange={(e) => setSolverType(e.target.value as 'astar' | 'z3')}
                    >
                        <option value="astar">A* Solver</option>
                        <option value="z3">SAT Solver (Z3)</option>
                    </select>
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-stoic-secondary pointer-events-none text-xs sm:text-sm">▼</span>
                </div>

                <button
                    className='h-10 sm:h-11 px-4 sm:px-6 text-xs sm:text-sm border-2 border-stoic-accent bg-stoic-accent text-stoic-bg font-bold uppercase tracking-wider hover:bg-transparent hover:text-stoic-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-stoic-accent disabled:hover:text-stoic-bg select-none flex items-center gap-2'
                    onClick={solveBoard}
                    disabled={isSolving}
                >
                    {isSolving && (
                        <svg className="animate-spin h-3 w-3 sm:h-4 sm:w-4" viewBox="0 0 24 24" fill="none">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                            <path className="opacity-100" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                    )}
                    {isSolving ? 'Solving' : 'Solve'}
                </button>

                <button
                    className='h-10 sm:h-11 px-3 sm:px-5 text-xs sm:text-sm border border-stoic-line bg-transparent text-stoic-secondary uppercase tracking-wider hover:border-stoic-secondary hover:text-stoic-primary transition-colors select-none'
                    onClick={() => resetBoard()}
                >
                    Reset
                </button>
            </div>

            <footer className="mt-8 px-4 max-w-2xl text-center text-stoic-secondary text-xs selectable-text">
                <p className="mb-2">
                    Solve Flow Free puzzles (Number Link) instantly using AI algorithms: backtracking, BFS, and A*. Connect colored dots without crossing paths.
                </p>
                <p className="mb-2">
                    This online Flow Free solver handles puzzles from 5×5 to 10×10 grids.
                    Perfect for learning puzzle-solving algorithms or quickly solving challenging Number Link puzzles.
                </p>
                <p className="mb-2">
                    <a href="https://en.wikipedia.org/wiki/Numberlink" target="_blank" rel="noopener noreferrer nofollow" className="underline hover:text-stoic-accent">Learn more about Number Link on Wikipedia</a> •
                    <a href="https://github.com/Kongesque/flow-free-solver" target="_blank" rel="noopener noreferrer" className="underline hover:text-stoic-accent ml-1">View source code on GitHub</a>
                </p>
            </footer>
        </main>
    );
};

export default FlowSolver;
