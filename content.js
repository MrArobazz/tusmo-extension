(() => {

    let dictionary = [];

    fetch(browser.runtime.getURL('words.json'))
        .then(response => response.json())
        .then(data => {
            dictionary = data;
        })
        .catch(err => console.error("Error loading dictionary :", err));

    /* ---- UI ---- */

    function createUi() {
        const overlay = document.createElement("div");
        overlay.id = 'tusmo-helper-ui';
        overlay.style = `
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: red;
            padding: 15px;
            border-radius: 8px;
            box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
            z-index: 9999;
            min-width: 250px;
            font-family: Arial, sans-serif;
        `;

        const title = document.createElement("h3");
        title.textContent = 'Tusmo Helper';
        title.style = `
            margin: 0 0 15px 0;
            color: #2c3e50;
            border-bottom: 2px solid #3498db;
            padding-bottom: 8px;
        `;

        const counter = document.createElement("div");
        counter.id = 'misplaced-counter';
        counter.style.marginBottom = '10px';

        const counterTitle = document.createElement("div");
        counterTitle.textContent = 'Lettres mal placées:';
        counterTitle.style.fontWeight = 'bold';

        const lettersContainer = document.createElement("div");
        lettersContainer.id = 'letters-container';
        lettersContainer.style = `
            display: flex;
            gap: 8px;
            flex-wrap: wrap;
            margin-top: 5px;
        `;

        counter.append(counterTitle, lettersContainer);

        const wordDisplay = document.createElement("div");
        wordDisplay.id = 'word-display';
        wordDisplay.style = `
            font-size: 1.2em;
            margin: 10px 0;
            min-height: 1.5em;
        `;

        const controls = document.createElement('div');
        controls.style.display = 'flex';
        controls.style.gap = '5px';

        const prevBtn = document.createElement("button");
        prevBtn.textContent = '←';

        const nextBtn = document.createElement("button");
        nextBtn.textContent = '→';

        const refreshBtn = document.createElement("button");
        refreshBtn.textContent = '🔄';
        refreshBtn.title = 'Rafraichir la grille';

        controls.append(prevBtn, nextBtn, refreshBtn);
        overlay.append(title, counter, wordDisplay, controls);
        document.body.appendChild(overlay);

        return {
            counter,
            wordDisplay,
            prevBtn,
            nextBtn,
            refreshBtn,
        };
    }

    let currentWordIndex = 0;
    let possibleWords = [];
    const ui = createUi();

    function updateUI() {
        const lettersContainer = document.getElementById('letters-container');
        lettersContainer.innerHTML = '';

        for (const [letter, count] of Object.entries(misplaced_letters)) {
            const badge = document.createElement("div");
            badge.style = `
                background: #f1c40f;
                color: black;
                padding: 3px 8px;
                border-radius: 12px;
                font-size: 0.9em;
            `;
            badge.textContent = `${letter.toUpperCase()}: ${count}`;
            lettersContainer.appendChild(badge);
        }

        if (Object.keys(misplaced_letters).length === 0) {
            const emptyText = document.createElement('div');
            emptyText.textContent = 'Aucune lettre mal placée';
            emptyText.style.color = '#95a5a6';
            lettersContainer.appendChild(emptyText);
        }

        possibleWords = findPossibleWords();
        currentWordIndex = possibleWords.length > 0 ? currentWordIndex % possibleWords.length : -1;

        ui.wordDisplay.textContent = possibleWords.length > 0
            ? possibleWords[currentWordIndex]
            : "Aucune suggestion disponible";
    }

    ui.prevBtn.addEventListener('click', () => {
        if (possibleWords.length > 0) {
            currentWordIndex = (currentWordIndex -1 + possibleWords.length) % possibleWords.length;
            updateUI();
        }
    });

    ui.nextBtn.addEventListener('click', () => {
        if (possibleWords.length > 0) {
            currentWordIndex = (currentWordIndex + 1) % possibleWords.length;
            updateUI();
        }
    });

    ui.refreshBtn.addEventListener('click', () => {
        getNewGridData();
        for (let i = 0; i < no_attempt; i++) {
            processCurrentAttempt();
        }
        updateUI();
    });

    const style = document.createElement("style");
    style.textContent = `
        #tusmo-helper-ui button {
            padding: 5px 10px;
            cursor: pointer;
            background: #00000;
            border: 1px solid #ddd;
            border-radius: 4px;
        }
        
        #tusmo-helper-ui button:hover {
            background: #e0e0e0;
        }
    `;
    document.head.appendChild(style);

    /* ---- UI ---- */

    const NB_ROWS = 6
    let nbLetters;
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

        nbLetters = cells.length / NB_ROWS;
        no_attempt = 0;
        not_those_letters = new Set();
        misplaced_letters = {};
        tried_words = [];
        word = Array.from({length: nbLetters}, () => '');
        word[0] = cells[0].textContent.trim().toLowerCase();
    }

    function uiMounted() {
        return document.querySelector('.game-wrapper');
    }

    let oldUrl = "https://www.tusmo.xyz/";
    browser.runtime.onMessage.addListener((message) => {
        if (message.type === "URL_CHANGED") {
            if (message.newUrl !== oldUrl) {
                oldUrl = message.newUrl;
                console.log(oldUrl);
                const handle = setInterval(() => {
                    if (uiMounted()) {
                        console.log("New game.");
                        clearInterval(handle);
                        getNewGridData();
                    }
                }, 500);
                setTimeout(() => {
                    clearInterval(handle);
                }, 10000);
            }
        }
    })

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

        const line = cellsArray.slice(no_attempt * nbLetters, (no_attempt + 1) * nbLetters);
        return Array.from(line).map(cell => ({
            letter: cell.textContent.trim().toLowerCase() || '.',
            color: getColorFromCell(cell),
        }));
    }

    function isValidAttempt() {
        const line = getActualLine();

        return !line.some(cell => cell.letter === '.');
    }

    function processCurrentAttempt() {
        const currentLine = getActualLine();
        tried_words.push(currentLine.map(cell => cell.letter).join(''));

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
                    not_those_letters.add(letter);
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
        const candidates = dictionary[nbLetters][initialLetter];

        return candidates.filter(candidate => {
            for (let i = 0; i < nbLetters; i++) {
                if (word[i] && word[i] !== candidate[i]) return false;
            }

            for (const letter of not_those_letters.values()) {
                if (candidate.includes(letter)) return false;
            }

            for (const letter in misplaced_letters) {
                const countInCandidate = (candidate.match(new RegExp(letter, 'g')) || []).length;
                if (countInCandidate < misplaced_letters[letter]) {
                    return false;
                }
            }

            return !tried_words.includes(candidate);
        });

    }

    function isThereANewGrid() {
        const cell = getCellsFromDoc()[1];

        return cell.textContent === '.';
    }

    function isReadyToParse() {
        const cell = getCellsFromDoc()[(no_attempt + 1) * nbLetters];
        return cell && cell.textContent !== undefined && cell.textContent.trim() !== '';
    }

    let isProcessing = false;
    document.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' && !isProcessing) {
            isProcessing = true;
            if (isValidAttempt()) {
                const handle = setInterval(() => {
                    if (isReadyToParse()) {
                        clearInterval(handle);
                        processCurrentAttempt();
                        updateUI();
                    } else if (isThereANewGrid()) {
                        clearInterval(handle);
                        getNewGridData();
                        updateUI();
                    }
                }, 500);
                setTimeout(() => {
                    clearInterval(handle);
                }, 10000);
            }
            isProcessing = false;
        }
    })

    /* ---- Find word ---- */
})()