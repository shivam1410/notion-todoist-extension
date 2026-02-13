/* NOT_USED_IN_SCRIPT */ 
function myFunction() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sheet3");
  const dataRange = sheet.getRange('A1:E40');
  const todo = dataRange.getValues();

  for (let i = 0; i < todo.length; i++) {
    const to = todo[i];

    if(to[0] === 'Date') continue;
    if(to[0]) {
      let da = new Date(to[0]);
      da.setHours(9);  
      let title = to[2];
      let description = to[3];
      let todoistID = to[4]
      console.log(da, title, description, todoistID)
      const todo = {
        content: title,
        project_id: projectNameIdMap["Health"],
        priority: 4,
        duration: 30,
        duration_unit:'minute',
        due_datetime: new Date(da).toISOString(),
        description: description
      }
      console.log(todo)
      console.log(todoistID)
      if(todoistID) {
        Update_Todoist(todoistID, todo)
      } else {
        const task = Todoist(todo);
        sheet.getRange(i + 1, 5).setValue(task.id);
      }
    }
  }
}


/* NOT_USED_IN_SCRIPT */ 
function Todoist(todo) {
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${Todoist_Token}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(todo),
    }
    urlfetchExecution++
    const response = UrlFetchApp.fetch(Todoist_API, options)
    const task = JSON.parse(response.getContentText())

    if (response.getResponseCode() != 200) {
      throw new error(`Failed to create the new todo : `, error.message)
    }

    console.log(`Task Created with ID: ${task.id} on Todoist Successfully`)
    return task
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to create the new todo : ${error.message}`)
  }
}