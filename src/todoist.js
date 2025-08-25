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
 * Fetches all tasks from the Todoist REST API that are tagged with a specific label name,
 * handling pagination using next_cursor.
 * @param {string} labelName - The label (tag) name to filter tasks by.
 * @returns {Promise<Array<Object>>} Array of task objects
 */
async function getTasksByLabelName(labelName) {
    const token = process.env.TODOIST_TOKEN;
    if (!token) {
        throw new Error('TODOIST_TOKEN is not set in environment variables.');
    }
    if (!labelName) {
        throw new Error('labelName is required.');
    }

    let allTasks = [];
    let nextCursor = null;
    const limit = 100; // Adjust as needed, API may have a max

    do {
        const url = new URL('https://api.todoist.com/api/v1/tasks');
        url.searchParams.append('label', labelName);
        url.searchParams.append('limit', limit);
        if (nextCursor) {
            url.searchParams.append('cursor', nextCursor);
        }

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        allTasks = allTasks.concat(data.results || []);
        nextCursor = data.next_cursor;
    } while (nextCursor);

    return allTasks;
}

/**
 * Fetches all tasks from the Todoist REST API that are related to a specific project ID (v1),
 * first mapping the v1 project ID to the v2 project ID, then fetching tasks using the v2 ID,
 * handling pagination using next_cursor.
 * @param {string} projectIdV1 - The v1 project ID to filter tasks by.
 * @returns {Promise<Array<Object>>} Array of task objects
 */
async function getTasksByProjectId(projectIdV1) {
    const token = process.env.TODOIST_TOKEN;
    if (!token) {
        throw new Error('TODOIST_TOKEN is not set in environment variables.');
    }
    if (!projectIdV1) {
        throw new Error('projectIdV1 is required.');
    }

    // Step 1: Map v1 project ID to v2 project ID
    const mappingUrl = `https://api.todoist.com/api/v1/id_mappings/projects/${encodeURIComponent(projectIdV1)}`;
    const mappingResponse = await fetch(mappingUrl, {
        headers: {
            'Authorization': `Bearer ${token}`,
        },
    });

    if (!mappingResponse.ok) {
        throw new Error(`Failed to map project ID: ${mappingResponse.status} ${mappingResponse.statusText}`);
    }

    const [mappingData] = await mappingResponse.json();
    const projectIdV2 = mappingData.new_id;
    if (!projectIdV2) {
        throw new Error('Could not find v2 project ID for the given v1 project ID.');
    }

    // Step 2: Fetch tasks using v2 project ID, handle pagination
    let allTasks = [];
    let nextCursor = null;
    const limit = 100;

    do {
        const url = new URL('https://api.todoist.com/api/v1/tasks');
        url.searchParams.append('project_id', projectIdV2);
        url.searchParams.append('limit', limit);
        if (nextCursor) {
            url.searchParams.append('cursor', nextCursor);
        }

        const response = await fetch(url.toString(), {
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch tasks: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        allTasks = allTasks.concat(data.results || []);
        nextCursor = data.next_cursor;
    } while (nextCursor);

    return allTasks;
}

module.exports = {
    getAllTags,
    getAllProjects,
    getTasksByLabelName,
    getTasksByProjectId,
};

