const fs = require('fs').promises;
const path = require('path');
const mustache = require('mustache');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const {
    getTagNames,
    renderPDF,
    mergePDFs,
} = require('./helper');

const INPUT_FILE = '/Users/roth/Desktop/next_actions.json';
const AUTOMATION_SCRIPT = '/Users/roth/Desktop/extract_next_actions.scpt';

async function run() {
    console.log('Extract next actions from OmniFocus');
    await exec(`osascript -l JavaScript ${AUTOMATION_SCRIPT}`);
    console.log('Done extracting.');
    
    
    console.log('Generate PDF files.');
    const fileContent = await fs.readFile(INPUT_FILE);
    const tasks = JSON.parse(fileContent);

    const contexts = getTagNames(tasks);
    const template = (await fs.readFile('./resources/context.html')).toString();
     const outDir = `/Users/roth/Desktop`;

    await fs.mkdir(outDir + `/pdf`, {recursive: true});
    await fs.mkdir(outDir + `/html`, {recursive: true});

    for (let i=0; i < contexts.length-1; i++) {
        const rendered = mustache.render(template, {
            context: contexts[i],
            tasks: tasks.filter(item => item.tag.name === contexts[i]),
        });
        await fs.writeFile(`${outDir}/html/${contexts[i]}.html`, rendered);
        await renderPDF(`${outDir}/html/${contexts[i]}.html`, `${outDir}/pdf/${contexts[i]}.pdf`);
    }

    const pdfs = (await fs.readdir(outDir + '/pdf'))
        .filter(file => path.extname(file) === '.pdf')
        .map(file => `${outDir}/pdf/${file}`);

    await mergePDFs(pdfs, outDir + `/pdf/_combined.pdf`)
}

run();
