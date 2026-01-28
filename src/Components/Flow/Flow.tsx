import React, { useState, useEffect, useCallback } from 'react';
import './Flow.css';
import { solve } from './Solver.tsx';

const Flow = () => {
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
        <main className='container'>
            <header>
                <h1 className='title'>Flow Free Solver</h1>
            </header>



            <div className="board">
                {Array.from({ length: size }).map((_, y) => (
                    <div key={y} className={`row${y + 1}`}>
                        {Array.from({ length: size }).map((_, x) => (
                            <button
                                key={x}
                                type="button"
                                className="boxes"
                                onClick={() => !solvedBoard && handleCellClick(x, y)}
                                aria-label={`Cell ${x},${y} ${currentBoard[x] && currentBoard[x][y] !== 0 ? `Color ${currentBoard[x][y]}` : 'Empty'}`}
                            >
                                {currentBoard[x] && currentBoard[x][y] !== 0 ? currentBoard[x][y] : ''}
                            </button>
                        ))}
                    </div>
                ))}
            </div>

            <div className="control">
                <select className='size-dropdown' value={size} onChange={handleSizeChange}>
                    {sizeOptions.map(option => (
                        <option key={option} value={option}>{option}x{option}</option>
                    ))}
                </select>

                <button className='solve' onClick={solveBoard}>Solve</button>
                <button className='reset' onClick={() => resetBoard()}>Reset</button>
            </div>
        </main>
    );
};

export default Flow;
