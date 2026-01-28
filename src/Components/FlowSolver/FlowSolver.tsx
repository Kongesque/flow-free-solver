import React, { useState, useCallback } from 'react';
import { solve } from './Solver.tsx';

const FlowSolver = () => {
    const defaultSize = 5;
    const sizeOptions = [5, 6, 7, 8, 9, 10];

    // Lazy initialization for board to improve performance
    const initializeBoard = (boardSize: number) => {
        return Array(boardSize).fill(null).map(() => Array(boardSize).fill(0));
    };

    const [size, setSize] = useState(defaultSize);
    const [board, setBoard] = useState<number[][]>(() => initializeBoard(defaultSize));
    const [solvedBoard, setSolvedBoard] = useState<number[][] | null>(null);
    const [currentNum, setCurrentNum] = useState(1);
    const [clickCount, setClickCount] = useState(0);
    const [previousNum, setPreviousNum] = useState<number | null>(null);

    const resetBoard = useCallback((newSize: number = size) => {
        setBoard(initializeBoard(newSize));
        setSolvedBoard(null);
        setCurrentNum(1);
        setClickCount(0);
        setPreviousNum(null);
    }, [size]);

    const handleSizeChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
        const newSize = parseInt(event.target.value);
        setSize(newSize);
        resetBoard(newSize);
    };

    const handleCellClick = (rowIndex: number, colIndex: number) => {
        if (solvedBoard) return; // Disable editing if solved

        const cellValue = board[rowIndex][colIndex];
        let newBoard = board.map(row => [...row]);

        if (cellValue !== 0 && clickCount % 2 !== 1) {
            // Starting to edit an existing color? 
            // Logic from original:
            // If clicking existing number and we are not in "second click" mode?
            newBoard[rowIndex][colIndex] = 0;
            setClickCount(clickCount - 1); // This logic is bit obscure but preserving behavior
            setPreviousNum(currentNum);
            setCurrentNum(cellValue);
        } else if (cellValue === 0) {
            // Placing a number
            newBoard[rowIndex][colIndex] = currentNum;
            setClickCount(clickCount + 1);

            if ((clickCount + 1) % 2 === 0) {
                // Completed a pair?
                setCurrentNum((previousNum ?? currentNum) + 1);
                setPreviousNum(null);
            }
        } else {
            // Clicking existing non-0 when logic implies something else?
            // Original code: `newBoard = board` (no change)
            return;
        }

        setBoard(newBoard);
    };

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
        <main className='flex flex-col justify-center items-center min-h-screen p-5 bg-stoic-bg'>
            <header>
                <h1 className='text-stoic-primary text-4xl mb-8 text-center uppercase tracking-widest font-black'>Flow Free Solver</h1>
            </header>

            <div className="flex flex-col gap-[2px] bg-stoic-block-border p-[2px] rounded-lg shadow-2xl">
                {Array.from({ length: size }).map((_, y) => (
                    <div key={y} className="flex gap-[2px]">
                        {Array.from({ length: size }).map((_, x) => (
                            <button
                                key={x}
                                type="button"
                                className={`h-[60px] w-[60px] bg-stoic-block-bg border border-stoic-inblock-border p-0 m-0 appearance-none font-bold text-xl cursor-pointer flex items-center justify-center transition-colors hover:bg-stoic-block-hover text-stoic-primary`}
                                onClick={() => !solvedBoard && handleCellClick(x, y)}
                                aria-label={`Cell ${x},${y} ${currentBoard[x] && currentBoard[x][y] !== 0 ? `Color ${currentBoard[x][y]}` : 'Empty'}`}
                            >
                                {currentBoard[x] && currentBoard[x][y] !== 0 ? currentBoard[x][y] : ''}
                            </button>
                        ))}
                    </div>
                ))}
            </div>

            <div className="flex gap-4 mt-8">
                <select
                    className='p-2.5 text-base border border-stoic-block-border rounded-md bg-stoic-block-bg text-stoic-primary transition-all duration-300 focus:outline-none focus:border-stoic-accent'
                    value={size}
                    onChange={handleSizeChange}
                >
                    {sizeOptions.map(option => (
                        <option key={option} value={option}>{option}x{option}</option>
                    ))}
                </select>

                <button
                    className='py-2.5 px-6 text-base border-none rounded-md cursor-pointer transition-all duration-300 text-stoic-bg font-bold bg-stoic-accent hover:bg-stoic-accent-hover hover:-translate-y-0.5 shadow-lg'
                    onClick={solveBoard}
                >
                    Solve
                </button>
                <button
                    className='py-2.5 px-6 text-base border-none rounded-md cursor-pointer transition-all duration-300 text-stoic-primary font-bold bg-stoic-secondary hover:bg-stoic-secondary-hover hover:-translate-y-0.5 shadow-lg'
                    onClick={() => resetBoard()}
                >
                    Reset
                </button>
            </div>
        </main>
    );
};

export default FlowSolver;
