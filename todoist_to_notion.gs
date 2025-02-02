function syncFromNotionToDoist() {
  for (let i = 0; i < freq; i++) {
    myFunctionN_T(i);
    Utilities.sleep(60 * 1000 /freq);
  }
}

function myFunctionN_T(i) {
  console.log('----------- Notion_To_Todoist_Sync --- ', i, urlfetchExecution);
  Notion_To_Todoist_Sync()
}

function Notion_To_Todoist_Sync() {
  try {
    let lastSyncTimeStamp = LastSyncTimeRange.getValue();

    let {notion_data, newSyncTimeStamp} = Fetching_Notion_Data(lastSyncTimeStamp)

    // PROCESS ONLY THOSE ENTRIES THAT ARE UPDATED BY USER, NOT API
    notion_data = notion_data.filter(data => {
      return users[data.last_edited_by.id] === "User"
    })

    if(!notion_data || notion_data.length < 1) {
      LastSyncTimeRange.setValue([newSyncTimeStamp]);
      return
    }
  
    const taskIds = notion_data
      .map(page => page?.properties?.["TaskId"]?.rich_text?.[0]?.text.content.trim())
      .filter(a => !!a)

    const todoistTasks = Fetch_Todoist_Data(taskIds)

    const todoistTaskMap = todoistTasks.reduce((map, task) => {
      map[task.id] = task
      return map
    }, {})

    Object.values(notion_data).forEach(page => {
      const taskId = page?.properties?.["TaskId"]?.rich_text?.[0]?.text.content.trim()
      const index = todoistTaskMap[taskId]

      if (taskId && index) {
        Update_Todoist(index, page)
      } else {
        Create_Todoist(page)
      }
    })
    LastSyncTimeRange.setValue([newSyncTimeStamp]);
  } catch (error) {
    console.error(error.message)
    throw new Error("Error processing!", error.message)
  }
}

function Fetching_Notion_Data(lastSyncTimeStamp) {
  try {
    const options = {
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${Notion_Token}`,
        'Notion-Version': '2022-06-28',
        "Content-Type": "application/json",
      },
      muteHttpExceptions: true,
      payload: JSON.stringify({
        filter: {
          "timestamp": "last_edited_time",
          "last_edited_time": {
            "on_or_after": new Date(lastSyncTimeStamp).toISOString()
          }
        }
      })
    }

    const url = `https://api.notion.com/v1/databases/${Database_ID}/query`
    urlfetchExecution++
    const response = UrlFetchApp.fetch(url, options)
    if (response.getResponseCode() == 200) {
      const data = JSON.parse(response.getContentText())
      return {notion_data: data.results, newSyncTimeStamp: (new Date()).toISOString()};
    } else {
      throw new Error(`Failed to fetch notion data: ${response.getContentText()}`)
    }
  } catch (error) {
    console.error("Error in fetching notion data is: ", error.message)
    return [];
  }
}


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
    console.error('Error in Fetch_Todoist_Data:', error);
    return [];
  }
}

function Create_Todoist(page) {
  try {
    if (!page) {
      throw new Error("Page object is undefined")
    }

    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${Todoist_Token}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(Create_todoist_object(page)),
    }
    urlfetchExecution++
    const response = UrlFetchApp.fetch(Todoist_API, options)
    const task = JSON.parse(response.getContentText())

    if (response.getResponseCode() != 200) {
      throw new error(`Failed to create the new todo : `, error.message)
    }

    console.log(`Task Created with ID: ${task.id} on Todoist Successfully`)

    update_notion_post_todoist_sync(page, task, true)
  } catch (error) {
    console.error(error)
    throw new Error(`Failed to create the new todo : ${error.message}`)
  }
}

function Update_Todoist(task, page) {
  try {
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${Todoist_Token}`,
        "Content-Type": "application/json"
      },
      payload: JSON.stringify(Create_todoist_object(page, true, task)),
    }

    const url = `${Todoist_API}/${task.id}`;
    urlfetchExecution++
    const response = UrlFetchApp.fetch(url, options)

    if (response.getResponseCode() !== 200) {
      throw new Error(`Failed to get the data : ${response.getContentText()}`)
    }

    console.log(`Task with ID: ${task.id} Updated on Todoist Successfully`)

    update_notion_post_todoist_sync(page, task)
  } catch (error) {
    throw new Error(`Failed to update the todo: `, error.message)
  }
}

function Create_todoist_object(page, isUpdate, pastTask) {
  let duration = null;
  if (page?.properties?.['Due Date']?.date?.end &&
    page?.properties?.['Due Date']?.date?.end.includes("T") &&
    page?.properties?.['Due Date']?.date?.start &&
    page?.properties?.['Due Date']?.date?.end.includes("T")) {
    duration = (new Date(page?.properties?.['Due Date']?.date?.end) - new Date(page?.properties?.['Due Date']?.date?.start))/1000/60
  }
  let due_datetime, due_date
  if (page?.properties?.['Due Date']?.date?.start.includes("T")) {
    due_datetime = (new Date(page?.properties?.['Due Date']?.date?.start)).toISOString()
  } else {
    due_date = page?.properties?.['Due Date']?.date?.start
  }

  let content
  if (page?.properties?.['Name']?.title?.[0]?.text?.content) {
    content = page?.properties?.['Name']?.title?.[0]?.text.content
  } else {
    if (isUpdate) {
      content = pastTask.content
    } else {
      content = "New Notion Task"
    }
  }

  const payload = {
    project_id: projectNameIdMap[page?.properties?.['Project']?.select?.name] ?? projectNameIdMap["Inbox"],
    content: content,
    is_completed: page?.properties?.['Status']?.checkbox,
    priority: priorityIdMap[page?.properties?.['Priority']?.select?.name] || 4,
    duration: duration ? duration : undefined,
    duration_unit: duration ? 'minute' : undefined,
    due_datetime: due_datetime ? due_datetime : undefined,
    due_date: due_date ? due_date : undefined,
  }
  return payload
}

function update_notion_post_todoist_sync(page, task, isCreate) {
  try {
    let payload
    if (isCreate) {
      payload = {
        "properties": {
          TaskId: {
            "rich_text": [
              {
                "text": {
                  "content": task.id
                }
              }
            ]
          },
          "Sync timestamp": {
            "number": +new Date(task.created_at)
          }
        }
      }
    } else {
      payload = {
        "properties": {
          "Sync timestamp": {
            "number": +new Date()
          }
        }
      }
    }

    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${Notion_Token}`,
        'Content-Type': 'application/json',
        'Notion-Version': '2022-06-28',
      },
      payload: JSON.stringify(payload)
    }


    urlfetchExecution++
    const response = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${page.id}`, options)
    if (response.getResponseCode() != 200) {
      throw new Error(`Failed to upadate the Notion Page: ${response}`)
    }
  } catch (err) {
    console.error("Error in update_notion_post_todoist_sync", err)
    throw new Error(`Failed to upadate the Notion Page post todoist sync: ${err?.message}`)
  }
}
