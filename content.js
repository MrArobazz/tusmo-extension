let dictionnary = [];

fetch(browser.runtime.getURL('words.json'))
    .then(response => response.json())
    .then(data => {
        dictionnary = data;
    })
    .catch(err => console.error("Erreur de chargement du dictionnaire :", err));

const NB_ROWS = 6
let NB_LETTERS;
let no_attempt = 0;
let not_those_letters = [];
let misplaced_letters = {};
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
    word = Array.from({length: NB_LETTERS}, () => '');
    word[0] = cells[0].textContent.trim().toLowerCase();
}

let oldUrl = "https://www.tusmo.xyz/";
browser.runtime.onMessage.addListener((message) => {
    if (message.type === "URL_CHANGED") {
        if (message.newUrl !== oldUrl) {
            oldUrl = message.newUrl;
            setTimeout(() => {
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
    const temp_misplaced_letters = {};
    // todo : il va spam les lettres mal placées au même endroit, il faudrait inscrire là où ce n'est pas le bon endroit
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
    const candidates = dictionnary[NB_LETTERS]?.[initialLetter];

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
        return true;
    });

}


document.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
        setTimeout(() => {
            if (isValidAttempt()) {
                console.log("Essai numéro ", no_attempt);
                processCurrentAttempt();
                console.log("Mot reconstruit :", word);
                console.log("Lettres mal placées :", misplaced_letters);
                console.log("Lettres exclues :", not_those_letters);
                const possibleWords = findPossibleWords();
                console.log("Mots possibles :", possibleWords);
            }
        }, 500);
    }
});

/* ---- Find word ---- */


/* ---- Dead functions ---- */
// Converts the flat array got from html in matrix
// function createGridMatrix(flatGrid, nbcolumns, nbrows = NB_ROWS) {
//     const matrix = [];
//     for (let i = 0; i < nbrows; i++) {
//         // Get nb elements from grid into a line of the matrix
//         matrix.push(flatGrid.slice(i * nbcolumns, (i + 1) * nbcolumns));
//     }
//     return matrix;
// }
//

/* ---- Dead functions ---- */