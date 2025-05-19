function syncFromTodoistToNotion() {
  try {
    const freq = todoNotionSyncSheet.getRange('B5').getValue() // number of syncs per minute, 5 means sync every 60/5 = 12 seconds
    if(!freq) throw "No Frequency found in sheet"
    for (let i = 0; i < freq; i++) {
    function_t_n(i)
    if (i === freq - 1) continue; // Not delaying on the last iteration
    Utilities.sleep(60 * 1000 / freq);
  }
  } catch (err) {
    console.log("Error in syncFromTodoistToNotion", err)
  }
}

function function_t_n(i) {
  console.log('----------- Todoist_To_Notion_Sync --- ', i, urlfetchExecution);
  Todoist_To_Notion_Sync()
}

function Todoist_To_Notion_Sync() {
  try {
    const syncToken = SyncTokenRange.getValue();
    const { todoist_data, sync_token } = Fetch_Todoist_Sync_Data(syncToken);

    if (!sync_token) {
      throw Error("Error in fetching data from todoist")
    }
    if (!todoist_data || todoist_data.length < 1) {
      Date_string = Utilities.formatDate(new Date(), "IST", 'E, MMM dd yyyy, HH:mm:ss')
      LastSyncTimeRange.setValue([Date_string])
      SyncTokenRange.setValue([sync_token]);
      return
    }

    // let taskIds = todoist_data.map(task => task.id)
    let taskIds = [...new Set(todoist_data.flatMap(task => 
      task.parent_id ? [task.id, task.parent_id] : [task.id]
    ))];

    const pages = Fetch_notion_pages(taskIds);

    const pagesMapByTaskId = {}
    pages.forEach(page => {
      if (page?.properties?.['TaskId']?.rich_text?.[0]?.text.content.trim()) {
        pagesMapByTaskId[page?.properties?.['TaskId']?.rich_text?.[0]?.text.content.trim()] = page
      }
    })

    const page_created = []
    const page_updated = []
    const page_deleted = []
    let page_ignored = 0;
    todoist_data.forEach(task => {
      const pageFound = pagesMapByTaskId[task?.id]

      const is_project_updated = pageFound && projectIDNameMap[task?.project_id] === pageFound?.properties["Project"]?.select?.name ? false: true

      const task_not_updated = pageFound && Math.abs(+new Date(task.updated_at) - pageFound?.properties["Sync timestamp"].number) < 1000 ? true: false

      if (!pageFound && (task.is_deleted || task.checked)) {
        // Do Nothing: If Task is deleted or completed in todoist, and was removed from notion
        page_ignored++
        return
      } else if(pageFound && !task.is_deleted && task_not_updated && !is_project_updated) {
        // Do Nothing: If Task in todoist is not updated by user after sync via API (When task was updated by API, we strore that time in notion)
        page_ignored++
      }
      else if (!pageFound && CHECK_SYNC_TAGS(task.labels)) {
        // DO Noting: Delete those task from todoist that are updated in todoist, after they were removed from Notion
        page_ignored++
      } else if (!pageFound && !task.is_deleted && !CHECK_SYNC_TAGS(task.labels)) {
        // Don't create task on notion, if sync label exist on it
        let parentNotionId = null
        if(task.parent_id) {
          parentNotionId = (pagesMapByTaskId[task.parent_id])?.id
        }
        const page = Create(task, parentNotionId);
        page_created.push(page)
      } else if (pageFound && task.is_deleted) {
        const res = Delete_page(pageFound)
        page_deleted.push(res)
      } else {
        let parentNotionId = null
        if(task.parent_id) {
          parentNotionId = pages[task.parent_id]
        }
        const res = Update(pageFound, task, parentNotionId)
        page_updated.push(res)
      }
    })

    // Sync Data back to todoist
    const taskSyncArray = [];
    page_created.filter(a => !!a).map(page => {
      let { taskDetails } = page
      taskSyncArray.push({
        taskId: taskDetails.id,
        pageId: page.id,
        url: page.url,
        labels: taskDetails.labels,
        type: "create"
      })
    })

    // Don't Delete the data from todoist, let notion webhook handle it
    // delete_from_todoist.filter(a => !!a).map(taskID => {
    //   taskSyncArray.push({
    //     taskId: taskID,
    //     type: "item_delete"
    //   })
    // })

    // Don't update back the data
    // page_updated.filter(a => !!a).map(page => {
    //   let { taskDetails } = page
    //   taskSyncArray.push({
    //     taskId: taskDetails.id,
    //     labels: taskDetails.labels,
    //     pageId: page.id,
    //     url: page.url,
    //     type: "update"
    //   })
    // })

    const syncPayload = Create_sync_payload(taskSyncArray)
    Sync_todoist_operations(syncPayload)
    if ((page_created.length + page_updated.length + page_deleted.length + page_ignored) < todoist_data.length) {
      throw Error("Error occured")
    }
    Date_string = Utilities.formatDate(new Date(), "IST", 'E, MMM dd yyyy, HH:mm:ss')
    LastSyncTimeRange.setValue([Date_string])
    SyncTokenRange.setValue([sync_token]);
  } catch (error) {
    console.error('Error in Todoist_And_Notion_Talk:', error.message);
  }
}

function Create_object_task_for_notion(task, isUpdate = false) {
  const data = {
    "properties": {
      "Name": {
        "title": [
          {
            "text": {
              "content": task.checked ? "✅ " + task.content : task.content
            }
          }
        ]
      },
      "Priority": {
        "type": "select",
        "select": {
          "name": priorityMap[task.priority.toString()] ?? "P4"
        }
      },
      "TaskId": {
        "rich_text": [
          {
            "text": {
              "content": task.id
            }
          }
        ]
      },
      "Status": {
        "checkbox": task.checked
      },
      "Project": {
        "type": "select",
        "select": {
          "name": projectIDNameMap[task.project_id] ?? "Inbox"
        }
      }
    },
  }

  if (!isUpdate && task.description) {
    const lines = task.description.split("\n")

    data["children"] = lines.map(line => {
      if (line && line.trim().startsWith("###")) {
        return {
          "object": "block",
          "type": "heading_3",
          "heading_3": {
            "rich_text": [{ "type": "text", "text": { "content": line } }]
          }
        }
      }
      if (line && line.trim().startsWith("##")) {
        return {
          "object": "block",
          "type": "heading_2",
          "heading_2": {
            "rich_text": [{ "type": "text", "text": { "content": line } }]
          }
        }
      }
      if (line && line.trim().startsWith("#")) {
        return {
          "object": "block",
          "type": "heading_1",
          "heading_1": {
            "rich_text": [{ "type": "text", "text": { "content": line } }]
          }
        }
      }
      return {
        "object": "block",
        "type": "paragraph",
        "paragraph": {
          "rich_text": [{ "type": "text", "text": { "content": line } }]
        }
      }
    })
  }
  const startDueDate = task?.due?.date ? new Date(task.due.date) : null;
  const dueDate = {}

  if (startDueDate && task.due?.date.includes("T")) {
    dueDate.start = Utilities.formatDate(startDueDate, 'Asia/Kolkata', 'yyyy-MM-dd\'T\'HH:mm:ssXXX')
  }
  if (startDueDate && !task.due?.date.includes("T")) {
    dueDate.start = task.due.date;
  }
  const endDueDate = startDueDate
  if (endDueDate && task?.due?.date?.includes("T") && task.duration?.amount > 0) {
    if ((task.duration?.unit)?.toLowerCase()?.includes("minute")) {
      endDueDate.setMinutes(startDueDate.getMinutes() + task.duration?.amount);
    } else if ((task.duration?.unit)?.toLowerCase()?.includes("hour")) {
      endDueDate.setHours(startDueDate.getHours() + task.duration?.amount);
    } else if ((task.duration?.unit)?.toLowerCase()?.includes("second")) {
      endDueDate.setSeconds(startDueDate.getSeconds() + task.duration?.amount);
    }

    dueDate.end = Utilities.formatDate(endDueDate, 'Asia/Kolkata', 'yyyy-MM-dd\'T\'HH:mm:ssXXX')
  }
  if (startDueDate || endDueDate) {
    data.properties["Due Date"] = {
      "date": dueDate
    }
  }

  if (task.updated_at) {
    data.properties["Sync timestamp"] = {
      "number": +new Date(task.updated_at)
    }
  }
  return data
}

function Create_sync_payload(taskSyncArray) {
  let payload = []
  for (let i = 0; i < taskSyncArray.length; i++) {
    let task = taskSyncArray[i]
    if (task.type === 'create') {
      console.log(task.labels)
      payload.push({
        "type": "item_update",
        "uuid": Utilities.getUuid(),
        "args": {
          id: task.taskId,
          labels: !CHECK_SYNC_TAGS(task.labels) ? [...task.labels, "ADDED_TO_NOTION"]: task.labels,
          description: "Notion Link: " + (task.url),
        }
      })
    }
  }
  return payload
}
