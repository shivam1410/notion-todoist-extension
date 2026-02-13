function Delete_task(task) {
  // getting task id 
  const task_id = task?.id

  try {
    const options = {
      method: 'delete',
      headers: {
        'Authorization': `Bearer ${Todoist_Token}`,
      },
    };
    urlfetchExecution++
    const response = UrlFetchApp.fetch(`${Todoist_API}/${task_id}`, options)

    if (response.getResponseCode() !== 204) {
      throw new Error(`Failed to delete task in Todoist: ${response.getContentText()}`);
    }

    console.log(`Task deleted in Todoist: ${task_id}`);

  } catch (error) {
    console.error(`Error deleting task ${task_id} in Todoist:`, error.message);
  }
}


function Sync_todoist_operations(payload) {
  var options = {
    "method": "post",
    "headers": {
      "Authorization": "Bearer " + Todoist_Token,
      "Content-Type": "application/json"
    },
    "payload": JSON.stringify({
      commands: payload
    }),
  };

  var API_URL = 'https://api.todoist.com/sync/v9/sync';
  try {
    var response = UrlFetchApp.fetch(API_URL, options);
    var data = JSON.parse(response.getContentText())
    console.log(`Task Sync Successfully`)
    return data
  } catch (e) {
    Logger.log("Error: " + e.toString());
  }
}

function Get_todoist_projects(id) {
    const options = {
        method: 'get',
        headers: {
          'Authorization': `Bearer ${Todoist_Token}`
        },
      };

  const url = `https://api.todoist.com/rest/v2/projects/`;
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    console.log(data)
    if (response.getResponseCode() !== 200) {
      throw new Error(`Failed to create page in Notion: ${data.message}`);
    }
}


function get_labels() {
  const option = {
    method: "get",
    headers: {
      'Authorization': `Bearer ${Todoist_Token}`,
    }
  }
  urlfetchExecution++
  UrlFetchApp.fetch(`https://api.todoist.com/rest/v2/labels`, option)
}

function Fetch_Todoist_Sync_Data(syncToken) {
  try {
    const query = {
      sync_token: syncToken ? syncToken : '*',
      resource_types: '["items", "notes"]'
    };
    const options = {
      method: 'get',
      headers: {
        'Authorization': `Bearer ${Todoist_Token}`
      },
      "payload": query,
      muteHttpExceptions: true
    };

    const url = "https://api.todoist.com/sync/v9/sync?limit=10"

    urlfetchExecution++
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      let { items, notes, sync_token } = (JSON.parse(response.getContentText()));
      // Map notes to their task IDs first
      const notesByTaskId = {};
      if (notes && notes.length > 0) {
        notes.forEach(note => {
          if (!notesByTaskId[note.item_id]) {
            notesByTaskId[note.item_id] = [];
          }
          notesByTaskId[note.item_id].push(note);
        });
      }
      // Attach notes directly to each item
      if (items && items.length > 0) {
        items.forEach(item => {
          item.notes = notesByTaskId[item.id] || [];
        });
      }
      return { todoist_data: items, sync_token }
    } else {
      throw new Error(`Failed to fetch Todoist data: ${response.getContentText()}`);
    }
  } catch (error) {
    console.error('Error in fetch_Todoist_Data:', error);
    throw Error("Error in fetching data from todoist")
  }
}

function update_labels(task) {
  // id lo 
  const labels = task?.labels;
  if (!labels || labels.length === 0) {
    //console.error("No labels found in the task.");
    return;
  }

  const label_Id = labels[0]?.id;
  if (!label_Id) {
    console.error("No valid label ID found.");
    return;
  }

  try {

    const option = {
      method: "put",
      headers: {
        "Content-Type": 'application/json',
        'Authorization': `Bearer ${Todoist_Token}`,
        'X-Request-Id': Utilities.getUuid()
      },
      payload: JSON.stringify({
        "name": "Sync"
      })
    }
    urlfetchExecution++
    const response_new = UrlFetchApp.fetch(`https://api.todoist.com/rest/v2/labels`, option)
    const response_data = response_new.getContentText()
  } catch (error) {
    throw new Error("Failed to update the labels")
  }
  //options 

}
