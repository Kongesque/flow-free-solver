export type Cell = [number, number];
export type Board = number[][];

const directions: Cell[] = [[-1, 0], [1, 0], [0, -1], [0, 1]];

class MinHeap<T> {
  private heap: T[] = [];
  private compare: (a: T, b: T) => number;

  constructor(compare: (a: T, b: T) => number) {
    this.compare = compare;
  }

  push(item: T) {
    this.heap.push(item);
    this.bubbleUp(this.heap.length - 1);
  }

  pop(): T | undefined {
    if (this.heap.length === 0) return undefined;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0 && bottom !== undefined) {
      this.heap[0] = bottom;
      this.bubbleDown(0);
    }
    return top;
  }

  get length() {
    return this.heap.length;
  }

  private bubbleUp(index: number) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.compare(this.heap[index], this.heap[parentIndex]) < 0) {
        [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
        index = parentIndex;
      } else {
        break;
      }
    }
  }

  private bubbleDown(index: number) {
    while (true) {
      const leftChild = 2 * index + 1;
      const rightChild = 2 * index + 2;
      let smallest = index;

      if (leftChild < this.heap.length && this.compare(this.heap[leftChild], this.heap[smallest]) < 0) {
        smallest = leftChild;
      }
      if (rightChild < this.heap.length && this.compare(this.heap[rightChild], this.heap[smallest]) < 0) {
        smallest = rightChild;
      }
      if (smallest !== index) {
        [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
        index = smallest;
      } else {
        break;
      }
    }
  }
}

class Queue<T> {
  private items: Record<number, T> = {};
  private head = 0;
  private tail = 0;

  push(item: T) {
    this.items[this.tail] = item;
    this.tail++;
  }

  shift(): T | undefined {
    if (this.head === this.tail) {
      return undefined;
    }
    const item = this.items[this.head];
    delete this.items[this.head];
    this.head++;
    return item;
  }

  get length() {
    return this.tail - this.head;
  }
}

const findPairs = (board: Board, number: number): [Cell | null, Cell | null] => {
  let startCell: Cell | null = null;
  let endCell: Cell | null = null;
  for (let i = 0; i < board.length; i++) {
    for (let j = 0; j < board[i].length; j++) {
      if (board[i][j] === number) {
        if (startCell === null) {
          startCell = [i, j];
        } else {
          endCell = [i, j];
          return [startCell, endCell];
        }
      }
    }
  }
  return [startCell, endCell];
}

const aStar = (board: Board, start: Cell, end: Cell): number => {
  const n = board.length;
  // Use a flat visited array for better performance if board size is small? 
  // But n is small (up to 10), so n*n is 100.
  const visited: boolean[][] = Array(n).fill(null).map(() => Array(n).fill(false));

  // [f, g, currentPosition (x,y)]
  // We don't need to store the full path in A* queue if we just want distance?
  // Previous code stored path but returned `g + 1`. It didn't use the path for anything inside A*.
  // It stored `path` in the tuple but didn't use it except to push to next state.
  // Wait, line 47: `priorityQueue.push([fNew, gNew, [nx, ny], [...path, [nx, ny]]])`
  // But the function returns `number` (distance).
  // So we don't need the path!

  const pq = new MinHeap<[number, number, number, number]>((a, b) => a[0] - b[0]);
  pq.push([0, 0, start[0], start[1]]);

  visited[start[0]][start[1]] = true;

  while (pq.length > 0) {
    const [f, g, x, y] = pq.pop()!;

    if (x === end[0] && y === end[1]) {
      return g;
    }

    // Since we bubble up, we might pop a node that was added with higher cost before a better path was found?
    // A* typically doesn't need to check if visited if we have consistent heuristic, 
    // but with re-expansion prevention:
    // Actually, simple visited check on expansion is enough for consistent heuristic.
    // The previous code marked visited on *generation* (when pushing neighbors), line 43.
    // That's more like BFS/Dijkstra with unit weights or consistent heuristic.
    // Let's stick to the previous visited logic but optimized.

    for (const [dx, dy] of directions) {
      const nx = x + dx;
      const ny = y + dy;

      if (nx >= 0 && nx < n && ny >= 0 && ny < n && !visited[nx][ny]) {
        if (nx === end[0] && ny === end[1]) {
          return g + 1;
        }
        if (board[nx][ny] === 0) {
          visited[nx][ny] = true;
          const gNew = g + 1;
          const hNew = Math.abs(nx - end[0]) + Math.abs(ny - end[1]);
          const fNew = gNew + hNew;
          pq.push([fNew, gNew, nx, ny]);
        }
      }
    }
  }

  return Infinity;
}

const applyPath = (board: Board, path: Cell[], number: number): Board => {
  const newBoard = board.map(row => [...row]);
  for (const [x, y] of path) {
    newBoard[x][y] = number;
  }
  return newBoard;
}

const lookaheadHeuristics = (board: Board, pairs: Record<number, [Cell | null, Cell | null]>, currentNumber: number): number | null => {
  for (let number = currentNumber; number <= Object.keys(pairs).length; number++) {
    const [startCell, endCell] = pairs[number];
    if (startCell && endCell) {
      const minDist = aStar(board, startCell, endCell);
      if (minDist === Infinity) {
        return Infinity;
      }
    }
  }
  return null;
}

const explorePathsForNumber = (
  board: Board,
  sumPath: number,
  number: number,
  pairs: Record<number, [Cell | null, Cell | null]>,
  nodeCount: number,
  startTime: number,
  timeout: number
): [Board | null, number] => {
  if (!pairs[number])
    throw new Error(`No Solution Exists`);

  const [startCell, endCell] = pairs[number];
  if (!startCell || !endCell) return [null, nodeCount];

  const minDist = aStar(board, startCell, endCell);
  if (minDist === Infinity) return [null, nodeCount];

  const lookAhead = lookaheadHeuristics(board, pairs, number + 1);
  if (lookAhead === Infinity) return [null, nodeCount];

  // BFS Queue: [x, y, path]
  const queue = new Queue<[number, number, Cell[]]>();
  queue.push([startCell[0], startCell[1], [startCell]]);

  // Convert path to string set for visited?
  // But we are doing BFS here to find *all simple paths* from start to end?
  // No, we are finding paths to then recurse on.
  // The previous implementation used visitedPaths to avoid exploring the exact same path sequence again?
  // Wait, `queue` stores partial paths.
  // `visitedPaths` check was on `queue.shift()`.
  // It says `if (!visitedPaths.has(pathTuple))`.
  // And it adds to `visitedPaths` ONLY when it reaches the destination (line 113).
  // So it essentially ensures we don't recurse on the exact same 1->2 connection path twice.
  // But BFS naturally generates unique paths?
  // Ah, maybe the graph allows multiple ways to form the same path if cycles? No.
  // A path is a sequence of cells.
  // If we have unique paths, we don't need this check unless we are doing something else.
  // Basically, we iterate ALL valid paths for this color.

  // Wait, the inner loop just does BFS.
  // But it pushes to queue even if visited in `path` check: `!path.some(...)`. (Loop avoidance).

  // I will keep the logic structure.

  const visitedPaths = new Set<string>();

  while (queue.length > 0) {
    if (performance.now() - startTime > timeout) {
      throw new Error('Timeout Exceeded');
    }

    const current = queue.shift()!;
    const [cx, cy, path] = current;

    // If reached end
    if (cx === endCell[0] && cy === endCell[1]) {
      if (minDist <= path.length) {
        // Optimization: Avoid stringify if possible, but path is array of arrays.
        // Just use the path length + sum coords/hash?
        // Or stick to stringify but only when a solution is found.
        // Since this happens only when we reach the target, it's not as frequent as inner loop.

        // Let's rely on the fact that BFS generates paths in order of length.
        // We want to try *every* valid path for this number?
        // The code says: `if (!visitedPaths.has(pathTuple))` -> recurse.

        const pathTuple = JSON.stringify(path);
        if (!visitedPaths.has(pathTuple)) {
          visitedPaths.add(pathTuple);
          const boardCopy = board.map(row => [...row]);
          const newBoard = applyPath(boardCopy, path, number);

          nodeCount++;

          const nextNum = number + 1;
          // If nextNum exists (aka number < maxNum)
          // The original code check `if (nextNum)` is effectively `if (true)` unless number is 0?
          // Actually `pairs` has keys 1...N.

          if (pairs[nextNum]) {
            const newSumPath = sumPath + path.length;
            if (newSumPath === board.length ** 2) {
              return [newBoard, nodeCount];
            }

            const [result, newNodeCount] = explorePathsForNumber(newBoard, newSumPath, nextNum, pairs, nodeCount, startTime, timeout);
            nodeCount = newNodeCount;

            if (result) {
              return [result, nodeCount];
            }
          } else {
            // All numbers done?
            // If we are at the last number.
            // Check if board is full?
            const newSumPath = sumPath + path.length;
            if (newSumPath === board.length * board.length) {
              return [newBoard, nodeCount];
            }
            // If board not full but all numbers connected, is it solved?
            // Flow Free requires all cells filled.
          }
        }
      }
      continue; // Don't extend paths from the endpoint
    }

    for (const [dx, dy] of directions) {
      const nx = cx + dx;
      const ny = cy + dy;

      // Check bounds
      if (nx >= 0 && nx < board.length && ny >= 0 && ny < board[0].length) {
        // Check if not in current path (avoid cycles)
        // This `path.some` is O(path_length).
        // We can use a fast lookup for the current path?
        // But path changes every step.
        // For small boards (5x5 to 10x10), path length is small < 100.
        // O(L) is fine.

        let inPath = false;
        for (let i = 0; i < path.length; i++) {
          if (path[i][0] === nx && path[i][1] === ny) {
            inPath = true;
            break;
          }
        }
        if (inPath) continue;

        const isEnd = (nx === endCell[0] && ny === endCell[1]);
        if (board[nx][ny] === 0 || isEnd) {
          // Heuristic Pruning/Neighbor check:
          // "if path.length === 1 || path.length === path.length - 1 || ..."
          // The original code line 142 is weird: `path.length === path.length - 1` is always false.
          // Oh, wait, `path.length === 1` means we just started.
          // The original code logic for neighbor check seems to try to enforce not blocking neighbors?
          // `directions.filter(...) <= 1` means "if this new cell has at most 1 neighbor in the current path?"
          // It seems to be checking for "bottlenecks" or "touching itself"?
          // Actually, let's preserve the logic or simplify if we understand it.
          // It looks like a simpler check: `board[nx][ny] === 0`.
          // The complex condition might be an optimization to avoid creating walled-off areas, but it's hard to parse.
          // "directions.filter(([dx, dy]) => path.some(([x, y]) => x === nx + dx && y === ny + dy)).length"
          // Counts how many neighbors of (nx, ny) are ALREADY in the path.
          // If > 1, it means we are touching our own path from another side?
          // That would form a loop or block?
          // For Flow Free, simple paths shouldn't touch themselves adjacent except previous step?
          // Let's keep it if possible, but correct the syntax errors logic. 

          // Actually, line 142 in original:
          // `path.length === 1 || path.length === path.length - 1` ??
          // This looks like a bug in original code or bad copy.
          // I will remove the dubious condition and rely on standard backtracking + lookahead.

          queue.push([nx, ny, [...path, [nx, ny]]]);
        }
      }
    }
  }

  return [null, nodeCount];
}

const solveBoard = (board: Board): [Board | null, number, number] => {
  const startTime = performance.now();
  const pairs: Record<number, [Cell | null, Cell | null]> = {};
  let sumPath = 0;

  // Use proper types
  const maxNum = Math.max(...board.flat());

  // Validate all pairs function
  for (let number = 1; number <= maxNum; number++) {
    pairs[number] = findPairs(board, number);
    if (!pairs[number][0] || !pairs[number][1]) {
      // If a number is on board but missing pair, it's invalid board.
      // But if number is not on board at all?
      // Flow usually has sequential numbers.
      // If maxNum is 5, we expect 1,2,3,4,5.
      // If 3 is missing?
      // Let's assume sequential.
      throw new Error(`Number ${number} does not have a pair`);
    }
  }

  const firstNum = 1;
  let nodeCount = 0;

  try {
    const [finalBoard, finalNodeCount] = explorePathsForNumber(board, sumPath, firstNum, pairs, nodeCount, startTime, 15000); // 15s timeout
    const endTime = performance.now();
    return [finalBoard, finalNodeCount, endTime - startTime];
  } catch (e: any) {
    return [null, nodeCount, performance.now() - startTime];
  }
}

export type SolveResult = {
  board: Board | null;
  timedOut: boolean;
  timeTaken: number;
  nodeCount: number;
};

export const solve = (board: any): SolveResult => {
  try {
    // Validate input board
    if (!board || board.length === 0) {
      return { board: null, timedOut: false, timeTaken: 0, nodeCount: 0 };
    }

    // Ensure board is number[][]
    // The component passes number[][] so it's fine.

    const [solvedBoard, finalNodeCount, timeTaken] = solveBoard(board);
    const timedOut = solvedBoard === null && timeTaken >= 14900; // ~15s timeout
    console.log(`Solved in ${timeTaken.toFixed(2)}ms, nodes: ${finalNodeCount}`);
    return { board: solvedBoard, timedOut, timeTaken, nodeCount: finalNodeCount };
  } catch (error: any) {
    console.error(error);
    return { board: null, timedOut: false, timeTaken: 0, nodeCount: 0 };
  }
};