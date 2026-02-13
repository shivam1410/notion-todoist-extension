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
    const latest100Tasks = [...todoist_data]
      .sort((a, b) => new Date(b.added_at) - new Date(a.added_at))
      .slice(0, 100)

    const taskIds = [...new Set(
      latest100Tasks.map(task => task.id)
    )]

    const pages = Fetch_notion_pages_by_taskIds(taskIds);

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
      const notionPage = pagesMapByTaskId[task?.id]
      // Notes are now stored directly in task.notes

      const is_project_updated = notionPage && projectIDNameMap[task?.project_id] === notionPage?.properties["Project"]?.select?.name ? false: true

      const task_not_updated = notionPage && Math.abs(+new Date(task.updated_at) - notionPage?.properties["Sync timestamp"].number) < 1000 ? true: false
      
      // Check if this is a recurring task
      const isRecurring = task?.due?.is_recurring === true;
      const isRecurringInNotion = notionPage && notionPage?.properties?.["Recurring"]?.select?.name !== null && notionPage?.properties?.["Recurring"]?.select?.name !== undefined;
      const isCompletedInNotion = notionPage && notionPage?.properties?.["Status"]?.checkbox === true;
      
      // For recurring tasks, always allow updates regardless of task_not_updated
      // This handles new recurring instances
      const shouldUpdateRecurring = isRecurring && notionPage && (
        (isRecurringInNotion && isCompletedInNotion) || // Case 1: Notion recurring + checked
        (!isRecurringInNotion) // Case 2 & 3: Notion not recurring (checked or unchecked)
      );

      if (!notionPage && (task.is_deleted || task.checked)) {
        // Do Nothing: If Task is deleted or completed in todoist, and was removed from notion
        page_ignored++
        return
      } else if(notionPage && !task.is_deleted && task_not_updated && !is_project_updated && !shouldUpdateRecurring) {
        // Skip if task hasn't been updated and it's not a recurring task that needs updating
        // Do Nothing: If Task in todoist is not updated by user after sync via API (When task was updated by API, we strore that time in notion)
        page_ignored++
        return
      }
      else if (!notionPage && CHECK_SYNC_COMMENTS(task?.notes)) {
        // DO Nothing: Page is deleted on notion and have a sync comment on todoist task
        page_ignored++
      } else if (!notionPage && !task.is_deleted && !CHECK_SYNC_COMMENTS(task?.notes)) {
        // Create task on notion if it doesn't exist and doesn't have sync comments
        const taskObject = Create_object_task_for_notion(task)
        const page = Create(taskObject);
        page.taskDetails = task
        page_created.push(page)
      } else if (notionPage && task.is_deleted) {
        const res = Delete_page(notionPage)
        page_deleted.push(res)
      } else {
        const taskObject = Create_object_task_for_notion(task, true, notionPage)
        
        const res = Update(notionPage, taskObject)
        if (res) {
          res.taskDetails = task
          page_updated.push(res)
        }
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
        description: taskDetails.description,
        notes: [],
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
      throw Error("Error occured - Page count missmatch")
    }
    Date_string = Utilities.formatDate(new Date(), "IST", 'E, MMM dd yyyy, HH:mm:ss')
    LastSyncTimeRange.setValue([Date_string])
    SyncTokenRange.setValue([sync_token]);
  } catch (error) {
    console.error('Error in Todoist_And_Notion_Talk:', error.message);
  }
}

function Create_object_task_for_notion(task, isUpdate = false, notionPage = null) {
  const data = {
    "properties": {
      "Name": {
        "title": [
          {
            "text": {
              "content": task.content
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
        "type": "checkbox",
        "checkbox": task?.checked
      },
      "Project": {
        "type": "select",
        "select": {
          "name": projectIDNameMap[task.project_id] ?? "Inbox"
        }
      }
    },
  }
  
  // Store labels in Notion's Labels property (filter out sync labels)
  if (task.labels && task.labels.length > 0) {
    const filteredLabels = FILTER_SYNC_LABELS(task.labels);
    if (filteredLabels.length > 0) {
      data.properties["Labels"] = {
        "type": "multi_select",
        "multi_select": filteredLabels.map(label => ({ "name": label }))
      }
    } else {
      // Set empty multi_select if all labels were sync labels
      data.properties["Labels"] = {
        "type": "multi_select",
        "multi_select": []
      }
    }
  } else {
    // Set empty multi_select if no labels
    data.properties["Labels"] = {
      "type": "multi_select",
      "multi_select": []
    }
  }
  
  // Handle recurring task status updates
  const isRecurring = task?.due?.is_recurring === true;
  const isRecurringInNotion = notionPage && notionPage?.properties?.["Recurring"]?.select?.name !== null && notionPage?.properties?.["Recurring"]?.select?.name !== undefined;
  const isCompletedInNotion = notionPage && notionPage?.properties?.["Status"]?.checkbox === true;
  
  if (isRecurring && notionPage && isUpdate) {
    if (isRecurringInNotion && isCompletedInNotion) {
      // Case 1: Notion task is recurring and checked → Update to unchecked + new date
      data.properties["Status"] = {
        "type": "checkbox",
        "checkbox": false
      };
      console.log(`Updating recurring task ${task.content} - unchecking status for new instance`);
    } else if (!isRecurringInNotion && isCompletedInNotion) {
      // Case 2: Notion task is NOT recurring and checked → Update to unchecked + new date + recurring details
      data.properties["Status"] = {
        "type": "checkbox",
        "checkbox": false
      };
      console.log(`Converting non-recurring task ${task.content} to recurring - unchecking status`);
    } else if (!isRecurringInNotion && !isCompletedInNotion) {
      // Case 3: Notion task is NOT recurring and unchecked → Update date + recurring details
      // Status remains as is (already set above from task?.checked)
      console.log(`Converting non-recurring task ${task.content} to recurring - updating date`);
    }
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
  console.log("-----", startDueDate)
  if (startDueDate && !task.due?.date.includes("T")) {
    dueDate.start = Utilities.formatDate(startDueDate, 'Asia/Kolkata', 'yyyy-MM-dd'); // '2025-06-07'
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

  // Store recurring pattern in dropdown/select property
  // If task is recurring, store the pattern from due.string (e.g., "Every day", "Every week")
  // If not recurring, leave it empty (null)
  if (task?.due?.is_recurring === true && task?.due?.string) {
    data.properties["Recurring"] = {
      "type": "select",
      "select": {
        "name": task.due.string
      }
    }
  } else {
    // Explicitly set to null if not recurring
    data.properties["Recurring"] = {
      "type": "select",
      "select": null
    }
  }

  return data
}

function Create_sync_payload(taskSyncArray) {
  let payload = []
  for (let i = 0; i < taskSyncArray.length; i++) {
    let task = taskSyncArray[i]
    if (task.type === 'create') {
      payload.push({
        "type": "note_add",
        "temp_id": Utilities.getUuid(),
        "uuid": Utilities.getUuid(),
        "args": {
          item_id: task.taskId,
          content: "ADDED_TO_NOTION"
        }
      })
      
      // Update description (keep labels as they are, don't add sync labels)
      if (!(task?.description && task?.description?.includes("Notion Link"))) {
        payload.push({
          "type": "item_update",
          "uuid": Utilities.getUuid(),
          "args": {
            id: task.taskId,
            description: "Notion Link: " + (task.url) + (task.description ? "\n" + task.description : ""),
          }
        })
      }
    }
  }
  return payload
}