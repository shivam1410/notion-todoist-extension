function Notion_To_Todoist_Sync() {
  try {
    const Date_string = (new Date()).toISOString() // can't change the format because of issue with re-conversion to is

    // Continue with normal syncing
    let lastSyncTimeStamp = LastSyncTimeRange.getValue();

    let notion_data = Fetching_Notion_Data(lastSyncTimeStamp)

    if (!notion_data) {
      LastSyncTimeRange.setValue([Date_string])
      return
    }

    if (notion_data.length < 1) {
      LastSyncTimeRange.setValue([Date_string])
      return
    }

    // PROCESS ONLY THOSE ENTRIES THAT ARE UPDATED BY USER, NOT API
    notion_data = notion_data?.filter(data => {
      return users[data.last_edited_by.id] === "User"
    })

    if (!notion_data || notion_data.length < 1) {
      LastSyncTimeRange.setValue([Date_string])
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
      const notion_title = page?.properties?.['Name']?.title?.[0]?.text?.content
      if ((isDone && isTaskInvalid) || !notion_title) {
        // Do Nothing: When A compelted task in updated on notion
        // Do Nothing: When A task is created in Done state on Notion
        // Do Nothing: When A task is completed on Notion, and isTaskInvalid on Todoist
        // Do Nothing: if notion_title is empty
        return;
      } else if (!isDone && taskId && isTaskInvalid) {
        // When A task is not completed on Notion, and isTaskInvalid on Todoist
        let data
        try {
          data = Fetch_Todoist_Data_Sync(taskId)
        } catch (e) {
          data = null
        }
        
        if (!data || (data && data?.item && data?.item?.is_deleted)) {
          // DO NOTHING
          return
        } else if (data && data?.item && data.item?.checked) {
          // Create item_uncomplete Command object
          let syncPayload = {
            "type": "item_uncomplete",
            "uuid": Utilities.getUuid(),
            "args": { "id": taskId }
          }
          payload.push(syncPayload)
        }
        return;
      }
      else if (taskId && !isTaskInvalid) {
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
      let updatedTasks = payload
                          .filter(obj => obj.type !== "item_uncomplete")
                          .filter(obj => response.sync_status[obj.uuid] === "ok")
      if (updatedTasks && updatedTasks.length) {
        update_notion_for_update(updatedTasks, notionTaskIdMap, todoistTaskMap)
      }

      let un_completed_tasks = payload
                          .filter(obj => obj.type === "item_uncomplete")
                          .filter(obj => response.sync_status[obj.uuid] === "ok")
      for(let obj of un_completed_tasks) {
        const page = notionTaskIdMap[obj?.args?.id];
        if(page) {
          page.content = page.properties.Name.title[0].plain_text
          update_notion(page)
        }
      }
    }

    // Update Last sync time on Sheet
    LastSyncTimeRange.setValue([Date_string])
  } catch (error) {
    throw new Error(`Error processing Notion To Todoist Sync: ${error?.message}`)
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
      duration: newDuration > 0 ? newDuration : null,
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

function DELETE_TASK_FROM_TODOIST() {
  const lastRow = logsSheet.getLastRow();
  const lastRowData = logsSheet.getRange(lastRow, 1, 1, logsSheet.getLastColumn()).getValues()[0];
  if(!delete_page_types.includes(lastRowData[7])) {
    throw new Error(`DELETE_TASK_FROM_TODOIST: Unexpected event type '${lastRowData[7]}' - expected delete event.`);
  }
  const pageId = lastRowData[11]
  const page = Fetching_Notion_Data_BY_ID(pageId)
  if(!page) {
      throw new Error(`DELETE_TASK_FROM_TODOIST: No page found for ID: ${pageId}`);
  }
  const taskId = page?.properties?.["TaskId"]?.rich_text?.[0]?.text.content.trim()
  if(!taskId) {
    throw new Error(`DELETE_TASK_FROM_TODOIST: No TaskId found for page ID: ${pageId}`);
  }
  const payload = [{
    "type": "item_delete",
    "uuid": Utilities.getUuid(),
    "args": {
      id: taskId,
    }
  }]
  Sync_todoist_operations(payload)
}
