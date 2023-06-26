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
const EXTRACT_ACTIONS = !process.argv.includes('--no-extract');

function bySection( a, b ) {
    if ( a.metadata.section < b.metadata.section ){
      return 1;
    }
    if ( a.metadata.section > b.metadata.section ){
      return -1;
    }
    return 0;
  }
  

function mapTaskDataForRender(item) {
    return {
        ...item,
        task: {
            ...item.task,
            effectiveDueDate: !!item.task.effectiveDueDate
                ? dayjs(item.task.effectiveDueDate).format('DD. MM YYYY')
                : null,
        },
    };
}

const WAITING_FOR_TAG_NAME = 'Waiting For';

async function run() {
    /**
     * Cleanup existing files
     */
    try {
        await fs.rm(`${outDir}/pdf/_combined.pdf`);
    } catch (err) {
        // empty
    }

    if (EXTRACT_ACTIONS) {
        console.log('Extract next actions from OmniFocus');
        await exec(`osascript -l JavaScript ${AUTOMATION_SCRIPT}`);
        console.log('Done extracting.');
    } else {
        console.log('Skipping extraction of next actions.');
    }
    
    
    console.log('Generate pages...');
    const fileContent = await fs.readFile(INPUT_FILE);
    const {tasks, agendaItems} = JSON.parse(fileContent);

    const contexts = getTagNames(tasks);
    const template = (await fs.readFile('./resources/context.html')).toString();
    const outDir = `/Users/roth/Desktop`;

    if (GENERATE_PDF) {
        await fs.mkdir(outDir + `/pdf`, {recursive: true});
    }
    await fs.mkdir(outDir + `/html`, {recursive: true});

    /**
     * Generate context pages
     */
    for (let i=0; i < contexts.length; i++) {
        const rendered = mustache.render(template, {
            contextName: contexts[i],
            tasks: tasks
                .filter(item => item.tag.name === contexts[i])
                .filter(item => item.tag.name !== WAITING_FOR_TAG_NAME) // Exclude Waiting For items, since they are no tasks
                .sort((a, b) => a.metadata.section > b.metadata.section)
                .sort((a, b) => b.task.flagged - a.task.flagged)
                .sort((a, b) => new Date(b.task.effectiveDueDate) - new Date(a.task.effectiveDueDate))
                .map(mapTaskDataForRender),
        });
        await fs.writeFile(`${outDir}/html/${contexts[i]}.html`, rendered);

        if (GENERATE_PDF) {
            await renderPDF(`${outDir}/html/${contexts[i]}.html`, `${outDir}/pdf/${contexts[i]}.pdf`);
        }
    }

    console.log('Done generating agenda pages.');
    
    /**
     * Generate Agenda pages
    */
    console.log('Generate Agenda pages');

    const agendas = getTagNames(agendaItems);
    for (let i=0; i < agendas.length; i++) {
        const rendered = mustache.render(template, {
            contextName: agendas[i],
            tasks: agendaItems
                .filter(item => item.tag.name === agendas[i])
                .sort((a, b) => b.task.flagged - a.task.flagged)
                .sort((a, b) => new Date(b.task.effectiveDueDate) - new Date(a.task.effectiveDueDate))
                .map(mapTaskDataForRender),
        });
        await fs.writeFile(`${outDir}/html/02_${agendas[i]}.html`, rendered);

        if (GENERATE_PDF) {
            await renderPDF(`${outDir}/html/02_${agendas[i]}.html`, `${outDir}/pdf/02_${agendas[i]}.pdf`);
        }
    }

    console.log('Done generating section pages.');


    /**
     * Generate Due Soon page
     */
    const renderedDueSoon = mustache.render(template, {
        contextName: 'Due Soon',
        tasks: tasks
            .filter(task => !!task.task.effectiveDueDate)
            .sort((a, b) => new Date(a.task.effectiveDueDate) - new Date(b.task.effectiveDueDate))
            .map(mapTaskDataForRender),
    });
    const DUE_SOON_FILE_NAME = '00_due_soon';
    await fs.writeFile(`${outDir}/html/${DUE_SOON_FILE_NAME}.html`, renderedDueSoon);

    if (GENERATE_PDF) {
        await renderPDF(`${outDir}/html/${DUE_SOON_FILE_NAME}.html`, `${outDir}/pdf/${DUE_SOON_FILE_NAME}.pdf`);
    }

    /**
     * Generate Waiting For page
     */
    const renderedWaitingFor = mustache.render(template, {
        contextName: 'Waiting For',
        tasks: tasks
            .filter(task => task.tag.name === WAITING_FOR_TAG_NAME)
            .sort(bySection)
            .map(mapTaskDataForRender),
    });
    const WAITING_FOR_FILE_NAME = '01_waiting_for';
    await fs.writeFile(`${outDir}/html/${WAITING_FOR_FILE_NAME}.html`, renderedWaitingFor);

    if (GENERATE_PDF) {
        await renderPDF(`${outDir}/html/${WAITING_FOR_FILE_NAME}.html`, `${outDir}/pdf/${WAITING_FOR_FILE_NAME}.pdf`);
    }



    /**
     * Combine PDFs into one file named '_combined.pdf'
     */
    if (GENERATE_PDF) {
        const pdfs = (await fs.readdir(outDir + '/pdf'))
            .filter(file => path.extname(file) === '.pdf')
            .map(file => `${outDir}/pdf/${file}`);

        console.log('merge pdfs');
        await mergePDFs(pdfs, outDir + `/pdf/_combined.pdf`)
        exec(`open ${outDir}/pdf/_combined.pdf`);
    }
}

run();
