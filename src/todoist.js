const fetch = require('node-fetch');

/**
 * Fetches all labels (tags) from the Todoist REST API.
 * @returns {Promise<Array<Object>>} Array of tag objects
 */
async function getAllTags() {
    const token = process.env.TODOIST_TOKEN;
    if (!token) {
        throw new Error('TODOIST_TOKEN is not set in environment variables.');
    }

    const response = await fetch('https://api.todoist.com/rest/v2/labels', {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch tags: ${response.status} ${response.statusText}`);
    }

    const tags = await response.json();
    return tags;
}

/**
 * Fetches all projects from the Todoist REST API, handling pagination.
 * @returns {Promise<Array<Object>>} Array of all project objects
 */
async function getAllProjects() {
    const token = process.env.TODOIST_TOKEN;
    if (!token) {
        throw new Error('TODOIST_TOKEN is not set in environment variables.');
    }

    const allProjects = [];
    let offset = 0;
    const limit = 200;

    while (true) {
        const url = `https://api.todoist.com/rest/v2/projects?limit=${limit}&offset=${offset}`;
        const response = await fetch(url, {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
        }

        const projects = await response.json();
        allProjects.push(...projects);

        if (projects.length < limit) {
            break;
        }
        offset += limit;
    }

    return allProjects;
}

/**
 * Fetches all projects from the Todoist REST API.
 * @returns {Promise<Array<Object>>} Array of project objects
 */
async function getAllProjectsByParentId(parentId) {
    const token = process.env.TODOIST_TOKEN;
    if (!token) {
        throw new Error('TODOIST_TOKEN is not set in environment variables.');
    }

    const response = await fetch(`https://api.todoist.com/rest/v2/projects?parent_id=${encodeURIComponent(parentId)}`, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch projects: ${response.status} ${response.statusText}`);
    }

    const projects = await response.json();
    return projects;
}

/**
 * Fetches all tasks from the Todoist REST API that are tagged with a specific label ID.
 * @param {string} labelId - The label (tag) ID to filter tasks by.
 * @returns {Promise<Array<Object>>} Array of task objects
 */
async function getTasksByLabelId(labelId) {
    const token = process.env.TODOIST_TOKEN;
    if (!token) {
        throw new Error('TODOIST_TOKEN is not set in environment variables.');
    }
    if (!labelId) {
        throw new Error('labelId is required.');
    }

    const url = `https://api.todoist.com/rest/v2/tasks?label_id=${encodeURIComponent(labelId)}`;
    const response = await fetch(url, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
    }

    const tasks = await response.json();
    return tasks;
}

module.exports = {
    getAllTags,
    getAllProjects,
    getTasksByLabelId,
};

