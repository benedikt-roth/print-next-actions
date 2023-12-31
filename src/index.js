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
    destruct,
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

function mapProjectsForRender(data) {
    return data
        .map(folder => ({
            sectionName: folder.sectionName,
            sectionProjects: folder.sectionProjects
                // Exclude continuous projects
                .filter(project => !project.name.includes('(c)'))
                .map(project => ({
                    ...project,
                    dueDate: !!project.dueDate
                        ? dayjs(project.dueDate).format('DD.MM.YYYY')
                        : null,
                })),
        }))
        .filter(section => section.sectionProjects.length > 0)
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
        console.log('Skipping extraction of next actions.\n');
    }
    
    
    console.log('Generate HTML pages...');
    const fileContent = await fs.readFile(INPUT_FILE);
    const {tasks, agendaItems, currentProjects} = JSON.parse(fileContent);

    const contexts = getTagNames(tasks)
        .filter(tagName => tagName !== WAITING_FOR_TAG_NAME);
    const contextTemplate = (await fs.readFile('./resources/context.html')).toString();
    const projectsTemplate = (await fs.readFile('./resources/projects.html')).toString();
    const outDir = `/Users/roth/Desktop`;

    if (GENERATE_PDF) {
        await fs.mkdir(outDir + `/pdf`, {recursive: true});
    }
    await fs.mkdir(outDir + `/html`, {recursive: true});


    /**
     * Generate Due Soon page
     */
    const renderedCurrentProjects = mustache.render(projectsTemplate, {
        contextName: 'Current Projects',
        folders: mapProjectsForRender(currentProjects),
    });
    const CURRENT_PROJECTS_FILE_NAME = '00_Projects';
    await fs.writeFile(`${outDir}/html/${CURRENT_PROJECTS_FILE_NAME}.html`, renderedCurrentProjects);

    if (GENERATE_PDF) {
        await renderPDF(`${outDir}/html/${CURRENT_PROJECTS_FILE_NAME}.html`, `${outDir}/pdf/${CURRENT_PROJECTS_FILE_NAME}.pdf`);
    }

    /**
     * Generate Due Soon page
     */
    const renderedDueSoon = mustache.render(contextTemplate, {
        contextName: 'Due Soon',
        tasks: tasks
            .filter(task => !!task.task.effectiveDueDate)
            .sort((a, b) => new Date(a.task.effectiveDueDate) - new Date(b.task.effectiveDueDate))
            .map(mapTaskDataForRender),
    });
    const DUE_SOON_FILE_NAME = '01_due_soon';
    await fs.writeFile(`${outDir}/html/${DUE_SOON_FILE_NAME}.html`, renderedDueSoon);

    if (GENERATE_PDF) {
        await renderPDF(`${outDir}/html/${DUE_SOON_FILE_NAME}.html`, `${outDir}/pdf/${DUE_SOON_FILE_NAME}.pdf`);
    }


   /**
     * Generate Waiting For page
     */
    const renderedWaitingFor = mustache.render(contextTemplate, {
        contextName: 'Waiting For',
        tasks: tasks
            .filter(task => task.tag.name === WAITING_FOR_TAG_NAME)
            .sort(bySection)
            .map(mapTaskDataForRender),
    });
    const WAITING_FOR_FILE_NAME = '02_waiting_for';
    await fs.writeFile(`${outDir}/html/${WAITING_FOR_FILE_NAME}.html`, renderedWaitingFor);

    if (GENERATE_PDF) {
        await renderPDF(`${outDir}/html/${WAITING_FOR_FILE_NAME}.html`, `${outDir}/pdf/${WAITING_FOR_FILE_NAME}.pdf`);
    }


    /**
     * Generate context pages
     */
    console.log('Generate Context pages...');
    for (let i=0; i < contexts.length; i++) {
        const rendered = mustache.render(contextTemplate, {
            contextName: contexts[i],
            tasks: tasks
                .filter(item => item.tag.name === contexts[i])
                .filter(item => item.tag.name !== WAITING_FOR_TAG_NAME) // Exclude Waiting For items, since they are no tasks
                .sort((a, b) => a.metadata.section > b.metadata.section)
                .sort((a, b) => b.task.flagged - a.task.flagged)
                .sort((a, b) => new Date(b.task.effectiveDueDate) - new Date(a.task.effectiveDueDate))
                .map(mapTaskDataForRender),
        });
        await fs.writeFile(`${outDir}/html/10_${contexts[i]}.html`, rendered);

        if (GENERATE_PDF) {
            await renderPDF(`${outDir}/html/10_${contexts[i]}.html`, `${outDir}/pdf/10_${contexts[i]}.pdf`);
        }
    }

    console.log('Done generating context pages.\n');


    
    
    /**
     * Generate Agenda pages
    */
    console.log('Generate Agenda pages');

    const agendas = getTagNames(agendaItems);
    for (let i=0; i < agendas.length; i++) {
        const rendered = mustache.render(contextTemplate, {
            contextName: `Agenda: ${agendas[i]}`,
            tasks: agendaItems
                .filter(item => item.tag.name === agendas[i])
                .sort((a, b) => b.task.flagged - a.task.flagged)
                .sort((a, b) => new Date(b.task.effectiveDueDate) - new Date(a.task.effectiveDueDate))
                .map(mapTaskDataForRender),
        });
        await fs.writeFile(`${outDir}/html/30_${agendas[i]}.html`, rendered);

        if (GENERATE_PDF) {
            await renderPDF(`${outDir}/html/30_${agendas[i]}.html`, `${outDir}/pdf/30_${agendas[i]}.pdf`);
        }
    }

    console.log('Done generating agenda pages.\n');




    /**
     * Combine PDFs into one file named '_combined.pdf'
     */
    if (GENERATE_PDF) {
        const pdfs = (await fs.readdir(outDir + '/pdf'))
            .filter(file => path.extname(file) === '.pdf')
            .map(file => `${outDir}/pdf/${file}`);

        console.log('Merging PDFs...');
        await mergePDFs(pdfs, outDir + `/_combined.pdf`)
        exec(`open ${outDir}/_combined.pdf`);

        await destruct();
    }
}

run();
