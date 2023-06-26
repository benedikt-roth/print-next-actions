const puppeteer = require('puppeteer');
const { PDFDocument, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;

let browser;

function getTagNames(tasks) {
    const flattenedList = [];

    for (const task of tasks) {
        if (task.tag
                && task.tag.name
                && !flattenedList.includes(task.tag.name)) {

            flattenedList.push(task.tag.name);
        }
    }

    return flattenedList;
}

async function renderPDF(htmlFilePath, pdfFilePath) {
  if (!browser) {
    browser = await puppeteer.launch({headless: 'new'});
  }

  const page = await browser.newPage();
  const options = {
    path: pdfFilePath,
    format: 'A5',
    printBackground: true,
    scale: 1,
    margin: {
      bottom: 30,
      top: 30,
      right: 30,
      left: 50,
    },
  };

  await page.goto(`file://${htmlFilePath}`, { waitUntil: 'networkidle0' });
  await page.pdf(options);
}

async function mergePDFs(inputFilePaths, outputFilePath) {
    const mergedPdf = await PDFDocument.create();
  
    for (const inputFilePath of inputFilePaths) {
      const pdfBytes = await fs.readFile(inputFilePath);
      const pdfDoc = await PDFDocument.load(pdfBytes);
      const copiedPages = await mergedPdf.copyPages(pdfDoc, pdfDoc.getPageIndices());
      copiedPages.forEach((page) => mergedPdf.addPage(page));
    }
  
    const pdfBytes = await mergedPdf.save();
    return fs.writeFile(outputFilePath, pdfBytes);
}

async function destruct() {
  await browser.close();
}

module.exports = {
    getTagNames,
    renderPDF,
    mergePDFs,
    destruct,
}
