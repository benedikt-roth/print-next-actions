const fs = require('fs').promises;
const path = require('path');
const mustache = require('mustache');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const dayjs = require('dayjs');

const {
    getTagNames,
    renderPDF,
    mergePDFs,
} = require('./helper');

const INPUT_FILE = '/Users/roth/Desktop/next_actions.json';
const AUTOMATION_SCRIPT = './resources/extract_next_actions.scpt';

const GENERATE_PDF = !process.argv.includes('--no-pdf');

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

    /**
     * Generate context pages
     */
    for (let i=0; i < contexts.length-1; i++) {
        const rendered = mustache.render(template, {
            contextName: contexts[i],
            tasks: tasks
                .filter(item => item.tag.name === contexts[i])
                .sort((a, b) => a.metadata.section > b.metadata.section)
                .sort((a, b) => new Date(b.task.effectiveDueDate) - new Date(a.task.effectiveDueDate))
                .map(item => ({
                    ...item,
                    task: {
                        ...item.task,
                        effectiveDueDate: !!item.task.effectiveDueDate
                            ? dayjs(item.task.effectiveDueDate).format('DD. MM YYYY')
                            : null,
                    },
                })),
        });
        await fs.writeFile(`${outDir}/html/${contexts[i]}.html`, rendered);

        if (GENERATE_PDF) {
            await renderPDF(`${outDir}/html/${contexts[i]}.html`, `${outDir}/pdf/${contexts[i]}.pdf`);
        }
    }

    if (GENERATE_PDF) {
        const pdfs = (await fs.readdir(outDir + '/pdf'))
            .filter(file => path.extname(file) === '.pdf')
            .map(file => `${outDir}/pdf/${file}`);

        try {
            await fs.rm(`${outDir}/pdf/_combined.pdf`);
        } catch (err) {
            // empty
        }

        console.log('merge pdfs');
        await mergePDFs(pdfs, outDir + `/pdf/_combined.pdf`)
        exec(`open ${outDir}/pdf/_combined.pdf`);
    }
}

run();
