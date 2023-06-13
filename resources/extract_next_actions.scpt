JsOsaDAS1.001.00bplist00�Vscript_�let OmniFocus = Application('OmniFocus');
let doc = OmniFocus.defaultDocument;
let app = Application.currentApplication();
app.includeStandardAdditions = true;


function getChildTags(parentTagName) {
    let parentTag = doc.tags.byName(parentTagName);
	let tags = parentTag.tags();
	let res = [];

	for(let i=0; i<tags.length; i++) {
	  res.push(tags[i]);
	  let children = tags[i].tags();
      // console.log(tags[i].name(), 'children: ', children.length);
	  for (let j=0; j<children.length; j++) {
	    res.push(children[j]);
		// console.log(children[j].name());
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
  const parentFolder = folder.container();
  const parentName = 'Current Projects';
  
  if (parentFolder) {
    if (parentFolder.name() == parentName) {
	  return folder.name();
	}
	
	return getSectionName(parentFolder);
  }
  
  return false;
}


let tags = getChildTags('Context');
let res = [];

// TODO: Label task with root project name
tags.forEach(tag => {
  let tasks = tag.tasks();
  let availableTasks = tasks
    .filter(task => !task.blocked())
	.filter(task => !task.completed())
	.filter(task => !task.effectivelyCompleted())
	.filter(task => !task.dropped())
    .filter(task => hasParentFolder(task.containingProject(), 'Current Projects'));

  availableTasks.forEach(task => {
      res.push({
	    task: {
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
  })
})


function writeTextToFile(text, file, overwriteExistingContent) {
    try {
        var fileString = file.toString()
        var openedFile = app.openForAccess(Path(fileString), { writePermission: true })
        if (overwriteExistingContent) {
            app.setEof(openedFile, { to: 0 })
        }
 
        app.write(text, { to: openedFile, startingAt: app.getEof(openedFile) })
        app.closeAccess(openedFile)
		
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


let jsonRes = JSON.stringify(res);

writeTextToFile(jsonRes, '/Users/roth/Desktop/next_actions.json', true);

                               jscr  ��ޭ