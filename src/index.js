require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const mustache = require('mustache');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const dayjs = require('dayjs');
const {getAllTags, getAllProjects, getTasksByLabelName} = require('./todoist')

const {
    getTagNames,
    renderPDF,
    mergePDFs,
    destruct,
} = require('./helper');

const GENERATE_PDF = !process.argv.includes('--no-pdf');

const formatIdx = process.argv.indexOf('--format');
const PAPER_FORMAT = formatIdx > -1
    ? process.argv[formatIdx+1]
    : 'FilofaxPersonal';

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

function mapProjectTaskDataForRender(task) {
    return {
        ...task,
        effectiveDueDate: !!task.effectiveDueDate
            ? dayjs(task.effectiveDueDate).format('DD. MM YYYY')
            : null,
    }
};

const WAITING_TAG_NAME = 'Waiting';
const TODAY_TAG_NAME = 'Today';

async function run() {
    /**
     * Cleanup existing files
     */
    try {
        await fs.rm(`${outDir}/pdf/_combined.pdf`);
    } catch (err) {
        // empty
    }

    console.log('Generate HTML pages...');
    // TODO: Extract data
    const {tasks, agendaItems} = {tasks: [], agendaItems: []};
    // TODO: Extract data
    const allProjects = await getAllProjects();
    const currentProjectsFolder = allProjects.find(project => project.name === 'Current Projects');
    // Current projects sections Business, Personal, etc.
    const sections = allProjects.filter(section => section.parent_id === currentProjectsFolder.id);
    // Get tags and omit "Waiting" tag, which is processed separately
    const contexts = (await getAllTags())
        .filter(tag => tag.name !== WAITING_TAG_NAME)
        .filter(tag => tag.name !== "5minutes")
        .filter(tag => tag.name !== "15minutes");

    
    const contextTemplate = (await fs.readFile('./resources/context.html')).toString();
    const projectsTemplate = (await fs.readFile('./resources/projects.html')).toString();
    const projectViewTemplate = (await fs.readFile('./resources/project.html')).toString();
    const outDir = 'C:/Users/ben/Desktop';
    
    if (GENERATE_PDF) {
        await fs.mkdir(outDir + `/pdf`, {recursive: true});
    }
    await fs.mkdir(outDir + `/html`, {recursive: true});
    
    
    /**
     * Generate Due Current Projects page
    */
   const renderedCurrentProjects = mustache.render(projectsTemplate, {
       contextName: 'Current Projects',
       folders: sections.map(section => ({
           sectionName: section.name,
           sectionProjects: allProjects.filter(project => project.parent_id === section.id),
           // TODO: Add dues dates, comments etc.
       })),
    });
    const CURRENT_PROJECTS_FILE_NAME = '00_Projects';
    await fs.writeFile(`${outDir}/html/${CURRENT_PROJECTS_FILE_NAME}.html`, renderedCurrentProjects);
    
    if (GENERATE_PDF) {
        await renderPDF(`${outDir}/html/${CURRENT_PROJECTS_FILE_NAME}.html`, `${outDir}/pdf/${CURRENT_PROJECTS_FILE_NAME}.pdf`, PAPER_FORMAT);
    }
    
    /**
     * Generate Due Soon page
     */
    /**
     * TODO: Implement due soon page
     * 
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
        await renderPDF(`${outDir}/html/${DUE_SOON_FILE_NAME}.html`, `${outDir}/pdf/${DUE_SOON_FILE_NAME}.pdf`, PAPER_FORMAT);
    }
    */


   /**
     * Generate Waiting For page
     */
    const renderedWaitingFor = mustache.render(contextTemplate, {
        contextName: 'Waiting',
        tasks: await getTasksByLabelName(WAITING_TAG_NAME),
    });
    const WAITING_FILE_NAME = '02_waiting';
    await fs.writeFile(`${outDir}/html/${WAITING_FILE_NAME}.html`, renderedWaitingFor);

    if (GENERATE_PDF) {
        await renderPDF(`${outDir}/html/${WAITING_FILE_NAME}.html`, `${outDir}/pdf/${WAITING_FILE_NAME}.pdf`, PAPER_FORMAT);
    }

    /**
     * Generate context pages
     */
    console.log('Generate Context pages...');
    const tagsWithoutAgendas = contexts.filter(tag => tag.name.indexOf('Agenda:'));
    for (let i=0; i < tagsWithoutAgendas.length; i++) {
        const tagName = tagsWithoutAgendas[i].name;
        const rendered = mustache.render(contextTemplate, {
            contextName: tagName,
            tasks: await getTasksByLabelName(tagName),
        });
        await fs.writeFile(`${outDir}/html/10_${tagName}.html`, rendered);

        if (GENERATE_PDF) {
            await renderPDF(`${outDir}/html/10_${tagName}.html`, `${outDir}/pdf/10_${tagName}.pdf`, PAPER_FORMAT);
        }
    }

    console.log('Done generating context pages.\n');

    process.exit();
    
    
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
            await renderPDF(`${outDir}/html/30_${agendas[i]}.html`, `${outDir}/pdf/30_${agendas[i]}.pdf`, PAPER_FORMAT);
        }
    }

    console.log('Done generating agenda pages.\n');


    /**
     * Generate active project detail pages
    */
    console.log('Generate project pages');

    const projectData = activeProjects.flatMap(section => 
            section.sectionProjects.map(project => ({
                ...project, 
                sectionName: section.sectionName
            }))
        )
        .sort((a, b) => a.sectionName - b.sectionName);

    for (let i=0; i < projectData.length; i++) {
        const rendered = mustache.render(projectViewTemplate, {
            projectName: `${projectData[i].name}`,
            sectionName: `${projectData[i].sectionName}`,
            tasks: [
                ...projectData[i].tasks
                    .filter(task => task.effectiveDueDate)
                    .sort((a, b) => new Date(a.effectiveDueDate) - new Date(b.effectiveDueDate)), // Sort by due date ascending
                ...projectData[i].tasks
                    .filter(task => !task.effectiveDueDate)
                    .sort((a, b) => b.flagged - a.flagged)
                ]
                .map(mapProjectTaskDataForRender),
        });
        const fileNameSuffix = `${projectData[i].sectionName} ${projectData[i].name}`
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '')
            .replace(/\s+/g, '_');
        await fs.writeFile(`${outDir}/html/40_${i}_${fileNameSuffix}.html`, rendered);

        if (GENERATE_PDF) {
            await renderPDF(`${outDir}/html/40_${i}_${fileNameSuffix}.html`, `${outDir}/pdf/40_${i}_${fileNameSuffix}.pdf`, PAPER_FORMAT);
        }
    }

    console.log('Done generating project pages.\n');


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
