function syncFromNotionToDoist() {
  for (let i = 0; i < freq; i++) {
    myFunctionN_T(i);
    if (i === freq - 1) continue; // Not delaying on the last iteration
    Utilities.sleep(60 * 1000 / freq);
  }
}

function myFunctionN_T(i) {
  console.log('----------- Notion_To_Todoist_Sync --- ', i, urlfetchExecution);
  Notion_To_Todoist_Sync()
}

function Notion_To_Todoist_Sync() {
  try {
    let lastSyncTimeStamp = LastSyncTimeRange.getValue();

    let { notion_data, newSyncTimeStamp } = Fetching_Notion_Data(lastSyncTimeStamp)

    if (!notion_data) {
      return
    }

    if (notion_data.length < 1) {
      LastSyncTimeRange.setValue([newSyncTimeStamp]);
      return
    }

    // PROCESS ONLY THOSE ENTRIES THAT ARE UPDATED BY USER, NOT API
    notion_data = notion_data?.filter(data => {
      return users[data.last_edited_by.id] === "User"
    })

    if (!notion_data || notion_data.length < 1) {
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

    const notionTaskIdMap = {}

    const payload = []
    const durationPayloads = []

    // Create Payload for Changes
    Object.values(notion_data).forEach(page => {
      const taskId = page?.properties?.["TaskId"]?.rich_text?.[0]?.text.content.trim()
      const task = todoistTaskMap[taskId]
      const isDone = page?.properties?.['Status']?.checkbox
      const isTaskInvalid = (!task || task.is_deleted || task.is_completed)
      notionTaskIdMap[taskId] = page

      if ((isDone || taskId) && isTaskInvalid) {
        // Do Nothing: When A compelted task in updated on notion
        // Do Nothing: When A task is created in Done state on Notion
        // Do Nothing: When A task is completed on Notion, and isTaskInvalid on Todoist
        // Do Nothing: When A task is not completed on Notion, and isTaskInvalid on Todoist
        return;
      } else if (taskId && !isTaskInvalid) {
        let { syncPayload, durationPayload } = Create_update_payload(page, task)
        if (durationPayload && "duration" in durationPayload) {
          durationPayloads.push({ taskId: task.id, durationPayload })
        }
        payload.push(...syncPayload)
      } else if (!isDone && !taskId) {
        Create_Todoist(page)
      }
    })

    // Call The REST API separately to just update Duration, Can Also avoid doing this in future.
    if (durationPayloads && durationPayloads.length) {
      for (const obj of durationPayloads) {
        if (obj.taskId) {
          Update_Todoist(obj.taskId, obj.durationPayload)
        }
      }
    }

    // Call SYNC API to update all other operations
    if (payload && payload.length) {
      const response = Sync_todoist_operations(payload)
      // Update Data on Notion - Sync time, TaskID, etc.
      let updatedTasks = payload.filter(obj => response.sync_status[obj.uuid] === "ok")
      if (updatedTasks && updatedTasks.length) {
        update_notion_for_update(updatedTasks, notionTaskIdMap, todoistTaskMap)
      }
    }

    // Update Last sync time on Sheet
    LastSyncTimeRange.setValue([newSyncTimeStamp]);
  } catch (error) {
    throw new Error(`Error processing Notion To Todoist Sync: ${error?.message}`)
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
      return { notion_data: data.results, newSyncTimeStamp: (new Date()).toISOString() };
    } else {
      throw new Error(`Failed to fetch notion data: ${response.getContentText()}`)
    }
  } catch (error) {
    console.error(`Error in fetching notion data is: ${error.message}`)
    throw new Error(`Error in fetching notion data is: ${error?.message}`)
  }
}

function Fetch_Todoist_Data(taskId = ["8844786135"]) {
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
      throw new Error(`Failed to get the data : ${response.getContentText()}`)
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

function Create_update_payload(page, task) {
  let payload = []
  let { obj, durationPayload } = Create_todoist_payload_object(page, true, task)
  if ("project_id" in obj) {
    payload.push({
      "type": "item_move",
      "uuid": Utilities.getUuid(),
      "args": {
        "id": task.id,
        "project_id": obj.project_id
      }
    })
  }
  if (obj.is_completed) {
    payload.push({
      "type": "item_close",
      "uuid": Utilities.getUuid(),
      "args": {
        "id": task.id
      }
    })
  }
  if (obj?.content !== undefined || obj?.priority !== undefined || obj?.description !== undefined || obj?.due !== undefined) {
    const args = {
      id: task.id,
      due_lang: "en",
    };

    if ("content" in obj) args.content = obj.content;
    if ("priority" in obj) args.priority = obj.priority;
    if ("description" in obj) args.description = obj.description;
    if ("due" in obj) args.due = obj.due;

    payload.push({
      type: "item_update",
      uuid: Utilities.getUuid(),
      args
    });
  }
  return { syncPayload: payload, durationPayload }
}

function Create_todoist_payload_object(page, isUpdate, pastTask) {
  // Creating Duration Object
  let duration = null;
  if (page?.properties?.['Due Date']?.date?.end &&
    page?.properties?.['Due Date']?.date?.end.includes("T") &&
    page?.properties?.['Due Date']?.date?.start &&
    page?.properties?.['Due Date']?.date?.end.includes("T")) {
    duration = (new Date(page?.properties?.['Due Date']?.date?.end) - new Date(page?.properties?.['Due Date']?.date?.start)) / 1000 / 60
  }
  let due_datetime, due_date
  if (page?.properties?.['Due Date']?.date?.start.includes("T")) {
    due_datetime = (new Date(page?.properties?.['Due Date']?.date?.start)).toISOString()
  } else {
    due_date = page?.properties?.['Due Date']?.date?.start
  }

  // Creating Content
  let content
  if (page?.properties?.['Name']?.title?.[0]?.text?.content) {
    content = page?.properties?.['Name']?.title?.[0]?.text.content
  } else {
    if (isUpdate) {
      content = pastTask.content
      if (!page?.properties?.['Status']?.checkbox) {
        content = content.includes("✅ ") ? content.replace("✅ ", "") : content
      }
    } else {
      content = "New Notion Task"
    }
  }

  // For Create, build the Complete object at once
  if (!isUpdate) {
    const payload = {
      content: content,
      project_id: projectNameIdMap[page?.properties?.['Project']?.select?.name] ?? projectNameIdMap["Inbox"],
      priority: priorityIdMap[page?.properties?.['Priority']?.select?.name] || 4,
      duration: duration ? duration : undefined,
      duration_unit: duration ? 'minute' : undefined,
      due_datetime: due_datetime ? due_datetime : undefined,
      labels: ["ADDED_FROM_NOTION"],
      description: "Notion Link - " + (page.url),
      due_date: due_date ? due_date : undefined,
    }
    return { obj: payload }
  }

  // For Updating Data, Create Pyload, that will be utilised by SYNC API
  const payload = {}

  if (!CHECK_SYNC_TAGS(pastTask.labels)) {
    payload.labels = ["ADDED_FROM_NOTION"];
  }

  if (page?.properties?.['Status'] && page?.properties?.['Status']?.checkbox)
    payload.is_completed = page?.properties?.['Status']?.checkbox

  const projectName = page?.properties?.['Project']?.select?.name;
  const newProjectId = projectName ? projectNameIdMap[projectName] : projectNameIdMap["Inbox"];
  if (newProjectId !== pastTask?.project_id)
    payload.project_id = newProjectId

  if (!pastTask.description)
    payload.description = "Notion Link - " + (page.url)

  const newDueDate = due_datetime || due_date || null;
  const pastDueDate = pastTask?.due?.datetime ?? pastTask?.due?.date ?? null;
  if (newDueDate !== pastDueDate) {
    if (!newDueDate) {
      payload.due = null
    } else if (!pastDueDate) {
      payload.due = {
        date: newDueDate,
        timezone: "Asia/Kolkata",
        lang: "en",
      }
    }
    else if (newDueDate && pastDueDate && new Date(newDueDate).toISOString() !== new Date(pastDueDate).toISOString()) {
      payload.due = {
        date: newDueDate,
        timezone: "Asia/Kolkata",
        lang: "en",
      }
    }
  }

  if (priorityMap[pastTask.priority] !== page?.properties?.['Priority']?.select?.name)
    payload.priority = priorityIdMap[page?.properties?.['Priority']?.select?.name]

  if (pastTask.content !== content)
    payload.content = content

  // Call the duration Payload separately, If duration is updated
  let newDuration = duration ?? null;
  let pastDuration = pastTask?.duration?.amount ?? null;
  let durationPayload
  if (newDuration !== pastDuration) {
    durationPayload = {
      duration: newDuration,
      duration_unit: newDuration ? "minute" : null,
    };
  }

  return { obj: payload, durationPayload }
}

function update_notion_for_update(updatedTasks, notionTaskIdMap, todoistTaskMap) {
  let pages = {}
  for (let task of updatedTasks) {
    if (task.type === "item_update") {
      pages[task.args.id] = {
        ...todoistTaskMap[task.args.id],
        ...task.args,
        id: notionTaskIdMap[task.args.id].id
      }
    } else if (task.type === "item_close") {
      pages[task.args.id] = {
        ...todoistTaskMap[task.args.id],
        checked: true,
        id: notionTaskIdMap[task.args.id].id
      }
    }
  }

  for (let page in pages) {
    update_notion(pages[page])
  }
}

function update_notion(page) {
  try {
    let payload = {
      "properties": {
        "Sync timestamp": {
          "number": +new Date() // When was the task updated on todoist?
        }
      }
    }

    if (page.checked && !page.content.includes("✅ ")) {
      payload.properties.Name = {
        title: [
          {
            "text": {
              "content": "✅ " + page.content
            }
          }
        ]
      }
    }
    if (!page.checked && page.content.includes("✅ ")) {
      payload.properties.Name = {
        title: [
          {
            "text": {
              "content": page.content.replace("✅ ", "")
            }
          }
        ]
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
    console.error("Error in update_notion", err)
    throw new Error(`Failed to upadate the Notion Page post todoist sync: ${err?.message}`)
  }
}

function update_notion_for_create(pageId, taskId) {
  try {
    let payload = {
      "properties": {
        TaskId: {
          "rich_text": [
            {
              "text": {
                "content": taskId
              }
            }
          ]
        },
        "Sync timestamp": {
          "number": +new Date()
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
    const response = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${pageId}`, options)
    if (response.getResponseCode() != 200) {
      throw new Error(`Failed to upadate the Notion Page: ${response}`)
    }
  } catch (err) {
    console.error("Error in update_notion_for_create", err)
    throw new Error(`Failed to upadate the Notion Page post todoist sync create: ${err?.message}`)
  }
}
