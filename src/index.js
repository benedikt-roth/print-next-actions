require('dotenv').config();

const fs = require('fs').promises;
const path = require('path');
const mustache = require('mustache');
const util = require('util');
const exec = util.promisify(require('child_process').exec);
const dayjs = require('dayjs');
const {
    getAllTags,
    getAllProjects,
    getTasksByProjectId,
    getTasksByLabelName,
    getTasksWithDueDate,
} = require('./todoist')

const {
    renderPDF,
    mergePDFs,
    destruct,
} = require('./helper');

const GENERATE_PDF = !process.argv.includes('--no-pdf');

const formatIdx = process.argv.indexOf('--format');
const PAPER_FORMAT = formatIdx > -1
    ? process.argv[formatIdx+1]
    : 'FilofaxPersonal';

const WAITING_TAG_NAME = 'Waiting';

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
    const outDir = './dist';
    
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
    const renderedDueSoon = mustache.render(contextTemplate, {
        contextName: 'Due Soon and priority',
        tasks: await getTasksWithDueDate(),
    });
    const DUE_SOON_FILE_NAME = '01_due_soon';
    await fs.writeFile(`${outDir}/html/${DUE_SOON_FILE_NAME}.html`, renderedDueSoon);

    if (GENERATE_PDF) {
        await renderPDF(`${outDir}/html/${DUE_SOON_FILE_NAME}.html`, `${outDir}/pdf/${DUE_SOON_FILE_NAME}.pdf`, PAPER_FORMAT);
    }


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

    
    
    /**
     * Generate Agenda pages
     */
    console.log('Generate Agenda pages');

    const agendaTags = contexts.filter(tag => tag.name.indexOf('Agenda:') === 0);
    for (let i=0; i < agendaTags.length; i++) {
        const rendered = mustache.render(contextTemplate, {
            contextName: agendaTags[i].name,
            tasks: await getTasksByLabelName(agendaTags[i].name),
        });

        const fileName = agendaTags[i].name
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, '') // remove non-alphanumeric and non-space
            .replace(/\s+/g, '_'); // replace spaces with underscores
        await fs.writeFile(`${outDir}/html/30_${fileName}.html`, rendered);

        if (GENERATE_PDF) {
            await renderPDF(`${outDir}/html/30_${fileName}.html`, `${outDir}/pdf/30_${fileName}.pdf`, PAPER_FORMAT);
        }
    }

    console.log('Done generating agenda pages.\n');



    /**
     * Generate active project detail pages
     */
    console.log('Generate project pages');

    // TODO: Add priorities and due dates to tasks
    for (const section of sections) {
       const projects = allProjects.filter(project => project.parent_id === section.id);

       for (const project of projects) {
            const rendered = mustache.render(projectViewTemplate, {
                projectName: `${project.name}`,
                sectionName: `${section.name}`,
                tasks: await getTasksByProjectId(project.id),
            });
            const fileName = `${section.name} ${project.name}`
                .toLowerCase()
                .replace(/[^a-z0-9\s]/g, '')
                .replace(/\s+/g, '_');
            await fs.writeFile(`${outDir}/html/40_${fileName}_${project.order}.html`, rendered);

            if (GENERATE_PDF) {
                await renderPDF(`${outDir}/html/40_${i}_${fileName}.html`, `${outDir}/pdf/40_${i}_${fileName}.pdf`, PAPER_FORMAT);
            }
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

    console.log("✅ All pages have been generated!")
}

run();
