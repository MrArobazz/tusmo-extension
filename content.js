let dictionary = [];

fetch(browser.runtime.getURL('words.json'))
    .then(response => response.json())
    .then(data => {
        dictionary = data;
    })
    .catch(err => console.error("Error loading dictionary :", err));

const NB_ROWS = 6
let NB_LETTERS;
let no_attempt = 0;
let not_those_letters = [];
let misplaced_letters = {};
let tried_words = [];
let word = []

/* ---- Utils ---- */
function getCellsFromDoc() {
    const grids = document.querySelectorAll('.motus-grid');
    const grid = grids[grids.length - 1];
    if (!grid) return [];

    return grid.querySelectorAll(':scope > div');
}

/* ---- Utils ---- */

/* ---- Init and refresh ---- */

function getNewGridData() {
    const cells = getCellsFromDoc();

    NB_LETTERS = cells.length / NB_ROWS;
    no_attempt = 0;
    not_those_letters = [];
    misplaced_letters = {};
    tried_words = [];
    word = Array.from({length: NB_LETTERS}, () => '');
    word[0] = cells[0].textContent.trim().toLowerCase();
}

let oldUrl = "https://www.tusmo.xyz/";
browser.runtime.onMessage.addListener((message) => {
    if (message.type === "URL_CHANGED") {
        if (message.newUrl !== oldUrl) {
            oldUrl = message.newUrl;
            setTimeout(() => {
                console.log("New game.");
                getNewGridData();
            }, 1000);
        }
    }
});

/* ---- Init and refresh ---- */

/* ---- Get word from last attempt --- */

function getColorFromCell(cell) {
    const content = cell.querySelector('.cell-content');

    const classes = content ? Array.from(content.classList) : [];

    // y : good letter, wrong place
    // r : good letter, right place
    // - : not existing
    return classes.find(cls => ['y', 'r', '-'].includes(cls));
}

function getActualLine() {
    const cells = getCellsFromDoc();
    const cellsArray = Array.from(cells);

    const line = cellsArray.slice(no_attempt * NB_LETTERS, (no_attempt + 1) * NB_LETTERS);
    return Array.from(line).map(cell => ({
        letter: cell.textContent.trim().toLowerCase() || '.',
        color: getColorFromCell(cell),
    }));
}

function isValidAttempt() {
    const cell = getCellsFromDoc()[(no_attempt + 1) * NB_LETTERS];
    return cell && cell.textContent !== undefined && cell.textContent.trim() !== '';
}

function processCurrentAttempt() {
    const currentLine = getActualLine();
    tried_words.push(currentLine.map(cell => cell.letter).join(''));
    console.log(tried_words);
    const temp_misplaced_letters = {};

    currentLine.forEach((cell, index) => {
        const {letter, color} = cell;

        if (color === 'r') {
            if (misplaced_letters.hasOwnProperty(letter))
                if (misplaced_letters[letter] > 0)
                    misplaced_letters[letter]--;
            word[index] = letter;
        }
    })
    currentLine.forEach((cell, _) => {
        const {letter, color} = cell;

        if (color === 'y') {
            if (temp_misplaced_letters.hasOwnProperty(letter))
                temp_misplaced_letters[letter]++;
            else temp_misplaced_letters[letter] = 1;
        } else if (color === '-') {
            if (!word.includes(letter) && !temp_misplaced_letters[letter]) {
                if (!not_those_letters.includes(letter)) {
                    not_those_letters.push(letter);
                }
            }
        }
    });

    for (const letter in temp_misplaced_letters) {
        if (misplaced_letters.hasOwnProperty(letter)) {
            if (temp_misplaced_letters[letter] > misplaced_letters[letter]) {
                misplaced_letters[letter] = temp_misplaced_letters[letter];
            }
        } else
            misplaced_letters[letter] = temp_misplaced_letters[letter];
    }

    no_attempt++;
}

/* ---- Get word from last attempt --- */


/* ---- Find word ---- */

function findPossibleWords() {
    const initialLetter = word[0].toLowerCase();
    const candidates = dictionary[NB_LETTERS]?.[initialLetter];

    return candidates.filter(candidate => {
        for (let i = 0; i < NB_LETTERS; i++) {
            if (word[i] && word[i] !== candidate[i]) {
                return false;
            }
        }

        for (const letter of not_those_letters) {
            if (candidate.includes(letter)) {
                return false;
            }
        }

        for (const letter in misplaced_letters) {
            const countInCandidate = (candidate.match(new RegExp(letter, 'g')) || []).length;
            if (countInCandidate < misplaced_letters[letter]) {
                return false;
            }
        }

        for (const word of tried_words) {
            if (word === candidate) {
                return false;
            }
        }
        return true;
    });

}

function isLastWordValid() {
    const cell = getCellsFromDoc()[1];

    return cell.textContent === '.';
}


document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        setTimeout(() => {
            if (isValidAttempt()) {
                processCurrentAttempt();
                console.log("Possible words :", findPossibleWords());
            } else if (no_attempt > 0) {
                setTimeout(() => {
                    if (isLastWordValid()) {
                        getNewGridData();
                    }
                }, 1000);
            }
        }, 700);
    }
});

/* ---- Find word ---- */


/* ---- Dead functions ---- */
// Converts the flat array got from html in matrix
// function createGridMatrix(flatGrid, nbcolumns, nbrows = NB_ROWS) {
//     const matrix = [];
//     for (let i = 0; i < nbrows; i++) {
//         // Get nb elements from grid into a line of the matrix t
//         matrix.push(flatGrid.slice(i * nbcolumns, (i + 1) * nbcolumns));
//     }
//     return matrix;
// }
//

/* ---- Dead functions ---- */