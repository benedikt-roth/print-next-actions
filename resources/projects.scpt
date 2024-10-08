JsOsaDAS1.001.00bplist00�Vscript_�let OmniFocus = Application('OmniFocus');
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

	  let jProject = sectionFolder.projects[j];
	  let jProjectTasks = jProject.flattenedTasks()
		  .filter(task => !task.effectivelyDropped())
          .filter(task => !task.blocked())
	      .filter(task => !task.completed())
	      .filter(task => !task.effectivelyCompleted())
	      .filter(task => !task.dropped())
  		  .map(task => ({
		    id: task.id(),
		    name: task.name(),
		    flagged: task.flagged(),
		    effectiveDueDate: task.effectiveDueDate(),
		    deferDate: task.deferDate(),
		    note: task.note(),
		    estimatedMinutes: task.estimatedMinutes()
		  }));

	  if (jProjectTasks.length == 0) {
	    continue;
	  }

	  sectionProjects.push({
	  	name: jProject.name(),
		note: jProject.note(),
		dueDate: jProject.dueDate(),
		tasks: jProjectTasks,
	  });

	  console.log("project " + jProject.name() + " has " + jProject.tasks().length + " tasks");
 	  console.log("project name:" + jProject.status());
	  console.log("project completed:" + jProject.completed());
    }	

    console.log("getCurrentProjects[4]");
	
	if (sectionProjects.length > 0) {
      projectsResult.push({
  		sectionName,
  		sectionProjects,
      });	
	}
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


let jsonRes = JSON.stringify({
  currentProjects: getCurrentProjects(),
});

writeTextToFile(jsonRes, '/Users/roth/Desktop/projects.json', true);

                              �jscr  ��ޭ