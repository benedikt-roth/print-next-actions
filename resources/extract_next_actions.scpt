JsOsaDAS1.001.00bplist00�Vscript_Plet OmniFocus = Application('OmniFocus');
let doc = OmniFocus.defaultDocument;
let app = Application.currentApplication();
app.includeStandardAdditions = true;


function getCurrentProjects() {
  console.log("getCurrentProjects[1]");
  let projectsResult = [];

  // 1: Get root folder
  const current = doc.folders.byName("Current Projects");

  // 2: Get child folders
  console.log("getCurrentProjects[2]");
  for (let i=0; i<current.folders.length; i++) {
    let sectionFolder = current.folders[i];
	let sectionName = current.folders[i].name();
	let sectionProjects = [];
	
	console.log("getCurrentProjects[3]");
    for (let j=0; j<sectionFolder.projects.length; j++) {
	  if (sectionFolder.projects[j].name() == 'Misc'
	  	|| sectionFolder.projects[j].status() !== 'active status') {
	    continue;
	  }
	  sectionProjects.push({
	  	name: sectionFolder.projects[j].name(),
		note: sectionFolder.projects[j].note(),
		dueDate: sectionFolder.projects[j].dueDate(),
	  });
    }	

    console.log("getCurrentProjects[4]");
    projectsResult.push({
		sectionName,
		sectionProjects,
	});	
  }
  
  return projectsResult;
}

function writeTextToFile(text, file, overwriteExistingContent) {
    try {
		var nsStr       = $.NSString.alloc.initWithUTF8String(text)
 		var nsPath      = $(file).stringByStandardizingPath
 		var successBool  = nsStr.writeToFileAtomicallyEncodingError(nsPath, false, $.NSUTF8StringEncoding, null)
  
        if (!successBool) {
          throw new Error("function writeTextToFile ERROR:\nWrite to File FAILED for:\n" + pPathStr)
        }

        return true
    }
    catch(error) {
        console.log(error);
        try {
            app.closeAccess(file)
        }
        catch(error) {
            console.log(`Couldn't close file: ${error}`)
        }

        return false
    }
}


function getChildTags(parentTagName, flattened = false) {
    let parentTag = doc.tags.byName(parentTagName);
	
	if (flattened) {
		return parentTag.flattenedTags();
	}
	
	let tags = parentTag.tags();
	let res = [];

	for(let i=0; i<tags.length; i++) {
	  res.push(tags[i]);
	  let children = tags[i].tags();
	  for (let j=0; j<children.length; j++) {
	    res.push(children[j]);
	  }
	}

	return res;
}

function getFolderFromProject(project) {
  if (project.folder()) {
    return project.folder().name();
  }
}

function hasParentFolder(folder, parentName) {
  console.log("[hasParentFolder] 1");
  const parentFolder = folder.container();
  
  if (parentFolder && parentFolder.name() !== 'OmniFocus') {
    if (parentFolder.name() == parentName) {
	  return true;
	}
	
	return hasParentFolder(parentFolder, parentName);
  }
  
  return false;
}

// Expects projects to reside within "Current projects"
function getSectionName(folder) {
  console.log("[getSectionName] #1");
  const parentFolder = folder.container();
  const parentName = 'Current Projects';
  
  if (parentFolder) {
    if (parentFolder.name() == 'OmniFocus') {
	  return false;
	} else if (parentFolder.name() == parentName) {
	  return folder.name();
	}
	
	return getSectionName(parentFolder);
  }
  
  return false;
}


/**
  * Generate context tasks
  */
let tags = getChildTags('Context');

let waitingForTag = doc.tags.byName("Waiting For");
tags.push(waitingForTag);

let res = [];

// TODO: Label task with root project name
tags.forEach(tag => {
  let tasks = tag.tasks();
  let availableTasks = tasks
    .filter(task => !task.effectivelyDropped())
    .filter(task => !task.blocked())
	.filter(task => !task.completed())
	.filter(task => !task.effectivelyCompleted())
	.filter(task => !task.dropped())
    .filter(task => hasParentFolder(task.containingProject(), 'Current Projects'));
	
	console.log("4");


  availableTasks.forEach(task => {
      res.push({
	    task: {
		  id: task.id(),
		  name: task.name(),
		  flagged: task.flagged(),
		  effectiveDueDate: task.effectiveDueDate(),
		  deferDate: task.deferDate(),
		  note: task.note(),
		  estimatedMinutes: task.estimatedMinutes()
		},
		project: {
		  name: task.containingProject().name(),
		  folder: getFolderFromProject(task.containingProject())
		},
		tag: {
		  name: tag.name()
		},
		metadata: {
		  section: getSectionName(task.containingProject())
		}
	  });
  });
});



/**
  * Agendas
  */

let agendaItems = [];
let agendaTags = getChildTags('Agenda', true);

console.log("6 (" + agendaTags.length + ")");

agendaTags.forEach(tag => {
  console.log("tag " + tag.name());
  console.log("task count for tag: " + tag.availableTaskCount());

  if (tag.availableTaskCount() == 0 || tag.tasks().length == 0) {
    console.log("skipping...");
    return;
  }

  console.log("Iterate tasks on tag");
  console.log(JSON.stringify(tag.tasks()));

  let agendaTasks = tag.tasks()
    .filter(task => !task.effectivelyDropped())
    .filter(task => !task.blocked())
	.filter(task => !task.completed())
	.filter(task => !task.effectivelyCompleted())
	.filter(task => !task.dropped());

  if (agendaTasks.length == 0) {
    console.log("skipping...");
    return;
  }

  agendaTasks.forEach(task => {
      agendaItems.push({
	    task: {
		  id: task.id(),
		  name: task.name(),
		  flagged: task.flagged(),
		  effectiveDueDate: task.effectiveDueDate(),
		  deferDate: task.deferDate(),
		  note: task.note(),
		},
		project: {
		  name: task.containingProject().name(),
		  folder: getFolderFromProject(task.containingProject())
		},
		tag: {
		  name: tag.name()
		},
		metadata: {
		  section: getSectionName(task.containingProject())
		}
	  });
  })
})

let jsonRes = JSON.stringify({
  tasks: res,
  agendaItems,
  currentProjects: getCurrentProjects(),
});

writeTextToFile(jsonRes, '/Users/roth/Desktop/next_actions.json', true);

                              fjscr  ��ޭ