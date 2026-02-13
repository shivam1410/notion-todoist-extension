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
      const data = JSON.parse(response.getContentText());
      // Notes are already included in the Sync API response
      // Attach notes directly to the item object
      if (data.item && data.notes) {
        data.item.notes = data.notes || [];
      } else if (data.item) {
        data.item.notes = [];
      }
      return data;
    } else {
      throw new Error(`Failed to fetch Todoist data via sync : ${response.getContentText()}`);
    }
  } catch (error) {
    throw Error('Error in Fetch_Todoist_Data_Sync:', error?.message)
  }
}

function Add_sync_comment(taskId, content = "ADDED_FROM_NOTION") {
  try {
    const commentUuid = Utilities.getUuid();
    const commentPayload = [{
      "type": "note_add",
      "temp_id": Utilities.getUuid(),
      "uuid": commentUuid,
      "args": {
        item_id: taskId,
        content: content
      }
    }];
    
    urlfetchExecution++
    const response = Sync_todoist_operations(commentPayload);
    
    if (!response || !response.sync_status) {
      throw new Error("Failed to add sync comment: Invalid response from Sync API");
    }
    
    if (response.sync_status[commentUuid] !== "ok") {
      throw new Error(`Failed to add sync comment: ${JSON.stringify(response.sync_status[commentUuid])}`);
    }
    
    console.log(`Sync comment added to task ${taskId} successfully`);
    return true;
  } catch (error) {
    console.error(`Failed to add sync comment to task ${taskId}:`, error.message);
    throw new Error(`Failed to add sync comment: ${error.message}`);
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
    
    // Add sync comment after task creation
    if (task && task.id) {
      try {
        Add_sync_comment(task.id, "ADDED_FROM_NOTION");
      } catch (e) {
        console.error(`Failed to add sync comment to task ${task.id}:`, e.message);
        // Don't throw - task was created successfully, comment failure is non-critical
      }
    }
    
    return task
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