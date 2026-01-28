import React, { useState, useCallback } from 'react';
import { solve } from './Solver.tsx';

const FlowSolver = () => {
    const defaultSize = 5;
    const sizeOptions = [5, 6, 7, 8, 9, 10];

    // Vibrant brutalist color palette
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

    const resetBoard = useCallback((newSize: number = size) => {
        setBoard(initializeBoard(newSize));
        setSolvedBoard(null);
        setActiveColor(1);
        setIsPlacingSecond(false);
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

    const solveBoard = async () => {
        // Run solve async to avoid blocking UI immediately (though logic is sync, React batching helps)
        // With heavy computation, ideally use Web Worker, but for now just function call.
        // We can wrap in setTimeout to allow render before freeze.
        setTimeout(() => {
            const solved = solve(board);
            if (solved) {
                setSolvedBoard(solved);
            } else {
                alert("No solution found!");
            }
        }, 10);
    };

    // Declarative Board Rendering
    const currentBoard = solvedBoard || board;

    return (
        <main className='flex flex-col justify-center items-center min-h-screen px-6 py-16 bg-stoic-bg'>
            <header className='mb-8'>
                <h1 className='text-stoic-primary text-2xl md:text-3xl text-center uppercase tracking-[0.2em] font-bold'>Flow Free Solver</h1>
            </header>

            <div className="flex flex-col border border-stoic-line">
                {Array.from({ length: size }).map((_, y) => (
                    <div key={y} className="flex">
                        {Array.from({ length: size }).map((_, x) => (
                            <button
                                key={x}
                                type="button"
                                className={`w-12 h-12 md:w-14 md:h-14 bg-stoic-block-bg border-r border-b border-stoic-line last:border-r-0 p-0 m-0 appearance-none cursor-pointer flex items-center justify-center hover:bg-stoic-block-hover active:bg-stoic-line`}
                                onClick={() => !solvedBoard && handleCellClick(x, y)}
                                aria-label={`Cell ${x},${y} ${currentBoard[x] && currentBoard[x][y] !== 0 ? `Color ${currentBoard[x][y]}` : 'Empty'}`}
                            >
                                {currentBoard[x] && currentBoard[x][y] !== 0 && (
                                    <span
                                        className="w-8 h-8 md:w-9 md:h-9 rounded-full"
                                        style={{ backgroundColor: COLORS[currentBoard[x][y]] || '#888' }}
                                    />
                                )}
                            </button>
                        ))}
                    </div>
                ))}
            </div>

            <p className='text-sm text-center mt-4 uppercase tracking-wide flex items-center justify-center gap-2'>
                <span className='text-stoic-secondary'>Placing:</span>
                <span
                    className="w-4 h-4 rounded-full inline-block"
                    style={{ backgroundColor: COLORS[activeColor] || '#888' }}
                />
                <span className='text-stoic-secondary'>({isPlacingSecond ? '2nd' : '1st'} point)</span>
            </p>

            <div className="flex flex-wrap justify-center gap-3 mt-6">
                <select
                    className='h-11 px-4 text-sm border border-stoic-line bg-stoic-bg text-stoic-primary uppercase tracking-wide focus:outline-none focus:border-stoic-accent cursor-pointer'
                    value={size}
                    onChange={handleSizeChange}
                >
                    {sizeOptions.map(option => (
                        <option key={option} value={option}>{option}×{option}</option>
                    ))}
                </select>

                <button
                    className='h-11 px-6 text-sm border border-stoic-accent bg-stoic-accent text-stoic-bg font-semibold uppercase tracking-wide hover:bg-transparent hover:text-stoic-accent transition-colors'
                    onClick={solveBoard}
                >
                    Solve
                </button>
                <button
                    className='h-11 px-6 text-sm border border-stoic-line bg-transparent text-stoic-secondary font-semibold uppercase tracking-wide hover:bg-stoic-line hover:text-stoic-primary transition-colors'
                    onClick={() => resetBoard()}
                >
                    Reset
                </button>
            </div>
        </main>
    );
};

export default FlowSolver;
