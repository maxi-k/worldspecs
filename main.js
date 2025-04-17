import DB from './components/db.js'
import ResultTable from './components/ResultTable.js'

// Helpers for encoding query in URL
function base64Encode(str) {
    return btoa(encodeURIComponent(str)); // Encode to Base64
}

function base64Decode(str) {
    try {
        return decodeURIComponent(atob(str)); // Decode from Base64
    } catch (e) {
        return ""; // Handle invalid Base64
    }
}

function getQueryParam(name) {
    const params = new URLSearchParams(window.location.search);
    return params.get(name);
}


const defaultQuery = "SELECT *\nFROM aws";

// Text Editor with Syntax Highlighting
let editor;
let rmodule;
document.addEventListener("DOMContentLoaded", async function () {
    const base64Query = getQueryParam("query");
    const initialContent = base64Query ? base64Decode(base64Query) : defaultQuery;
    editor = CodeMirror.fromTextArea(document.getElementById("sql-editor"), {
        mode: "text/x-sql", // SQL mode
        lineNumbers: true, // Show line numbers
        matchBrackets: true, // Highlight matching brackets
        autoCloseBrackets: true // Auto-close brackets
    });
    editor.setValue(initialContent);

    // await import other js file lazily
    try {
        // prepare output area
        let reval = document.getElementById("r-eval");
        // append editor and graphic output area
        reval.innerHTML += '<textarea id="r-editor" class="form-control" rows="10" placeholder="Enter R code here"></textarea>';
        reval.innerHTML += '<button id="execute-r">Plot [Ctrl+Enter]</button>';
        reval.innerHTML += '<div id="r-status" class="output">Loading R...</div>';
        reval.innerHTML += '<div id="r-output" class="output"></div>';
        // load module
        rmodule = await import('./static/plot.js')

        await rmodule.initializeR('r-status')
        console.log("R module loaded successfully");


        let editor = document.getElementById("r-editor");
        let out = document.getElementById("r-output");
        let submit = document.getElementById("execute-r");
        // code mirror editor
        let r_editor = CodeMirror.fromTextArea(editor, {
            mode: "text/x-rsrc", // R mode
            lineNumbers: true, // Show line numbers
            matchBrackets: true, // Highlight matching brackets
            autoCloseBrackets: true, // Auto-close brackets
            extraKeys: {
                "Ctrl-Enter": function (cm) {
                    submit.click();
                }
            }
        });

        // initialize R repl
        await rmodule.makeRRepl(r_editor, out, 'r-output', submit);
        await recreateTable();
        submit.click();
    } catch (error) {
        console.error("Failed to load R module", error);
        alert("Failed to load R module");
    }
});


const db = await DB.create();
const resultTable = new ResultTable('#ec2-instances');

async function createTable() {
    let sql = editor.getValue();
    const result = await db.query(sql);

    if ("error" in result) {
        $("#error-msg").text(result.error);
        console.log("result error");
        return resultTable.render([], [], sql);
    }

    // Set table in R context
    if (rmodule) {
        rmodule.onDataUpdate(result);
    }

    return resultTable.render(result.columns, result.rows, sql);
}

const recreateTable = async () => {
    await createTable();
}

$(document).ready(async function () {
    $("#load-table").on("click", async function (e) {
        e.preventDefault();
        $("#error-msg").text("");
        recreateTable();
    });

    $("#tabs").tabs();

    document.addEventListener('keydown', async function (event) {
        if (event.ctrlKey && event.key == "Enter") {
            $("#error-msg").text("");
            recreateTable();
        }
    });
});
