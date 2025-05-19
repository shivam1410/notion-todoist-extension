function Fetch_Todoist_Data(taskId) {
  try {
    const options = {
      headers: {
        'Authorization': `Bearer ${Todoist_Token}`
      },
      muteHttpExceptions: true
    };

    const url = `https://api.todoist.com/rest/v2/tasks?ids=${taskId}`
    urlfetchExecution++
    const response = UrlFetchApp.fetch(url, options);

    if (response.getResponseCode() === 200) {

      return JSON.parse(response.getContentText());
    } else {
      throw new Error(`Failed to fetch Todoist data: ${response.getContentText()}`);
    }
  } catch (error) {
    throw Error('Error in Fetch_Todoist_Data:', error?.message)
  }
}

function Fetch_Todoist_Data_Sync(taskId) {
  try {
    const options = {
      headers: {
        'Authorization': `Bearer ${Todoist_Token}`
      },
      muteHttpExceptions: true,
      payload: { item_id: taskId },
    };

    const url = `https://api.todoist.com/sync/v9/items/get`
    urlfetchExecution++
    const response = UrlFetchApp.fetch(url, options);

    if (response.getResponseCode() === 200) {

      return JSON.parse(response.getContentText());
    } else {
      throw new Error(`Failed to fetch Todoist data via sync : ${response.getContentText()}`);
    }
  } catch (error) {
    throw Error('Error in Fetch_Todoist_Data_Sync:', error?.message)
  }
}

function Create_Todoist(page) {
  try {
    if (!page) {
      throw new Error("Page object is undefined")
    }

    const { obj } = Create_todoist_payload_object(page)
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${Todoist_Token}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(obj),
    }
    urlfetchExecution++
    const response = UrlFetchApp.fetch(Todoist_API, options)
    const task = JSON.parse(response.getContentText())

    if (response.getResponseCode() != 200) {
      throw new error(`Failed to create the new todo : `, error.message)
    }

    console.log(`Task Created with ID: ${task.id} on Todoist Successfully`)

    update_notion_for_create(page.id, task.id)
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to create the new todo : ${error.message}`)
  }
}

function Update_Todoist(taskId, payload) {
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${Todoist_Token}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(payload),
      muteHttpExceptions: true
    }

    const url = `${Todoist_API}/${taskId}`;
    urlfetchExecution++
    const response = UrlFetchApp.fetch(url, options)

    if (response.getResponseCode() !== 200) {
      throw new Error(`Update todoist failed : ${response.getContentText()}`)
    }

    console.log(`Task with ID: ${taskId} Updated on Todoist Successfully`)
  } catch (error) {
    console.log(error)
    throw new Error(`Failed to update the todo: `, error.message)
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
    "muteHttpExceptions": true
  };

  var API_URL = 'https://api.todoist.com/sync/v9/sync';
  try {
    var response = UrlFetchApp.fetch(API_URL, options);
    var status = JSON.parse(response.getContentText())
    console.log(`Task Sync Successfully`)
    return status
  } catch (e) {
    Logger.log("Error: " + e.toString());
  }
}
