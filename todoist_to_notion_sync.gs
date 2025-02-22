function syncFromTodoistToNotion() {
  for (let i = 0; i < freq; i++) {
    function_t_n(i)
    if (i === freq - 1) continue; // Not delaying on the last iteration
    Utilities.sleep(60 * 1000 / freq);
  }
}

function function_t_n(i) {
  console.log('----------- Todoist_To_Notion_Sync --- ', i, urlfetchExecution);
  Todoist_To_Notion_Sync()
}

function Todoist_To_Notion_Sync() {
  try {
    const syncToken = SyncTokenRange.getValue();
    const { todoist_data, sync_token } = Fetch_Todoist_Data_Value(syncToken);

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
    const delete_from_todoist = []
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
        // Delete those task from todoist that are updated in todoist, after they were removed from Notion
        delete_from_todoist.push(task.id)
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
        type: "item_update"
      })
    })

    delete_from_todoist.filter(a => !!a).map(taskID => {
      taskSyncArray.push({
        taskId: taskID,
        type: "item_delete"
      })
    })

    page_updated.filter(a => !!a).map(page => {
      let { taskDetails } = page
      taskSyncArray.push({
        taskId: taskDetails.id,
        labels: taskDetails.labels,
        pageId: page.id,
        url: page.url,
        type: "item_update"
      })
    })

    const syncPayload = Create_sync_payload(taskSyncArray)
    Sync_todoist_operations(syncPayload)
    if ((page_created.length + page_updated.length + page_deleted.length + page_ignored + delete_from_todoist.length) < todoist_data.length) {
      throw Error("Error occured")
    }
    Date_string = Utilities.formatDate(new Date(), "IST", 'E, MMM dd yyyy, HH:mm:ss')
    LastSyncTimeRange.setValue([Date_string])
    SyncTokenRange.setValue([sync_token]);
  } catch (error) {
    console.error('Error in Todoist_And_Notion_Talk:', error.message);
  }
}

function Fetch_Todoist_Data_Value(syncToken) {
  try {
    const query = {
      sync_token: syncToken ? syncToken : '*',
      resource_types: '["items"]'
    };
    const options = {
      method: 'get',
      headers: {
        'Authorization': `Bearer ${Todoist_Token}`
      },
      "payload": query,
      muteHttpExceptions: true
    };

    const url = "https://api.todoist.com/sync/v9/sync"

    urlfetchExecution++
    const response = UrlFetchApp.fetch(url, options);
    if (response.getResponseCode() === 200) {
      let { items, sync_token } = (JSON.parse(response.getContentText()));
      return { todoist_data: items, sync_token }
    } else {
      throw new Error(`Failed to fetch Todoist data: ${response.getContentText()}`);
    }
  } catch (error) {
    console.error('Error in fetch_Todoist_Data:', error);
    throw Error("Error in fetching data from todoist")
  }

}

function Fetch_notion_pages(taskIds) {
  try {
    const options = {
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${Notion_Token}`,
        'Notion-Version': '2022-06-28',
      },
      muteHttpExceptions: true,
      payload: JSON.stringify({
        filter: {
          or: taskIds.map(taskid => {
            return {
              "property": "TaskId",
              "rich_text":
              {
                "equals": taskid
              },
            }
          })
        }
      })
    }

    const url = `https://api.notion.com/v1/databases/${Database_ID}/query`;
    urlfetchExecution++;
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText())
    return data.results;
  } catch (error) {
    console.error(error)
    throw new Error("Error in fetching Notion Data", error.message)
  }

}

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

function Get_todoist_projects(id) {
  //   const options = {
  //       method: 'get',
  //       headers: {
  //         'Authorization': `Bearer ${Todoist_Token}`
  //       },
  //     };

  // const url = `https://api.todoist.com/rest/v2/projects/`;
  //   const response = UrlFetchApp.fetch(url, options);
  //   const data = JSON.parse(response.getContentText());

  //   if (response.getResponseCode() !== 200) {
  //     throw new Error(`Failed to create page in Notion: ${data.message}`);
  //   }
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

function Delete_page(page) {
  try {
    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${Notion_Token}`,
        "Content-Type": "application/json",
        'Notion-Version': '2022-06-28',
      },
      payload: JSON.stringify({
        archived: true
      })
    }
    urlfetchExecution++
    const response = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${page?.id}`, options)

    if (response.getResponseCode() !== 200) {
      throw new Error(`Failed to delete Notion task: ${response.getContentText()}`);
    }

    console.log(`Notion task ${page?.id} deleted successfully.`);

  } catch (error) {
    console.error(`Error deleting Notion task ${page_page?.idid}:`, error.message);
  }
}

function Update(page, task, parentPageId) {
  try {
    const taskObject = Create_object_task_for_notion(task, true)
    if(parentPageId) {
      taskObject["parent"] = {
        "page_id": parentPageId
      }
    }
    const options = {
      method: 'patch',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${Notion_Token}`,
        'Notion-Version': '2022-06-28',
      },
      payload: JSON.stringify(taskObject),
      muteHttpExceptions: true
    }
    const url = `https://api.notion.com/v1/pages/${page.id}`;
    urlfetchExecution++
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());

    if (response.getResponseCode() !== 200) {
      throw new Error(`Failed to update page in Notion: ${data.message}`);
    }
    console.log(`Notion task ${page.id} updated successfully.`);
    data.taskDetails = task
    return data
  } catch (error) {
    console.error('Error updating page in Notion:', error.message);
  }
}

function Create(task, parentPageId = null) {
  try {
    const taskObject = Create_object_task_for_notion(task)
    if(parentPageId) {
      taskObject["parent"] = {
        "page_id": parentPageId
      }
    } else {
      taskObject["parent"] = {
        "database_id": Database_ID
      }
    }
    const options = {
      method: 'post',
      contentType: 'application/json',
      headers: {
        'Authorization': `Bearer ${Notion_Token}`,
        'Notion-Version': '2022-06-28',
      },
      muteHttpExceptions: true,
      payload: JSON.stringify(taskObject)
    }
    const url = 'https://api.notion.com/v1/pages';
    urlfetchExecution++
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());

    if (response.getResponseCode() !== 200) {
      throw new Error(`Failed to create page in Notion: ${data.message}`);
    }

    console.log(`Page created in Notion: ${data?.id}`);
    data.taskDetails = task
    return data
  } catch (error) {
    console.error('Error creating page in Notion:', error.message);
    throw error
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
    var status = JSON.parse(response.getContentText())
    console.log(`Task Sync Successfully`)
    return status
  } catch (e) {
    Logger.log("Error: " + e.toString());
  }
}

function Create_sync_payload(taskSyncArray) {
  let payload = []
  for (let i = 0; i < taskSyncArray.length; i++) {
    let task = taskSyncArray[i]
    if (task.type === 'item_delete') {
      payload.push({
        "type": "item_delete",
        "uuid": Utilities.getUuid(),
        "args": {
          id: task.taskId,
        }
      })
    } else if (task.type === 'item_update') {
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
