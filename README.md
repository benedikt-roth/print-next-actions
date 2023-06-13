# Print Next Actions

Generate printable PDFs from OmniFocus todos (using [GTD]([url](https://gettingthingsdone.com/)))

## Why?

Have a printed version of all my tasks for known benefits:
* Enhanced Learning and Memory
* Reduced Distractions
* Enhanced Brain Engagement

OmniFocus is a great tool for GTD. However, it has a horrible integration
with any other tools. This bridges the gap between paper and digital. So that
I do not need to switch my laptop on to see what is relevant right now.


## What it does

1. Extract tasks and other items as JSON from OmniFocus using macOS Automation
2. Use Node.js to generate HTML files from JSON
3. Use Node.js with puppeteer to generate PDFs from HTML
4. Combine all PDFs into a single file


## Technologies used
* Node.js
* JavaScript for Apple Automation (JAX)

