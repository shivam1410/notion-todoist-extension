function syncFromTodoistToNotion() {
  for (let i = 0; i < 10; i++) {
    myFunctionT_N(i);
     Utilities.sleep(60 * 1000 /freq);
  }
}

function myFunctionT_N(i) {
  console.log('----------- Todoist_To_Notion_Sync --- ', i, urlfetchExecution);
  Todoist_To_Notion_Sync()
}

function Todoist_To_Notion_Sync() {
  try {
    const syncToken = SyncTokenRange.getValue();
    const { todoist_data, sync_token } = Fetch_Todoist_Data_Value(syncToken);

    if (!todoist_data || todoist_data.length < 1) {
      SyncTokenRange.setValue([sync_token]);
      return
    }

    let taskIds = todoist_data.map(task => task.id)

    const pages = Fetch_notion_pages(taskIds);

    const pagesMapByTaskId = {}
    pages.forEach(page => {
      if (page?.properties?.['TaskId']?.rich_text?.[0]?.text.content.trim()) {
        pagesMapByTaskId[page?.properties?.['TaskId']?.rich_text?.[0]?.text.content.trim()] = page
      }
    })

    todoist_data.forEach(task => {
      const pageFound = pagesMapByTaskId[task?.id]

      if (!pageFound && !task.is_deleted) {
        create(task);
      } else if(!pageFound && task.is_deleted) {
        return
      } else if(pageFound && task.is_deleted) {
          Delete_page(pageFound)
      } else if(pageFound && !task.is_deleted && (Math.abs(new Date(task.updated_at) - pageFound.properties["Sync timestamp"].number) < 1000)){
        // PROCESS ONLY THOSE ENTRIES THAT ARE UPDATED BY USER, NOT API
        return
      } else {
        update(pageFound, task)
      }
    })
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
    return [];
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

function update(page, task) {
  try {
    const taskObject = Create_object_task_for_notion(task, true)
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
  } catch (error) {
    console.error('Error updating page in Notion:', error.message);
  }
}

function create(task) {
  try {
    const taskObject = Create_object_task_for_notion(task)
    taskObject["parent"] = {
      "database_id": Database_ID
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
  } catch (error) {
    console.error('Error creating page in Notion:', error.message);
  }
}

function Create_object_task_for_notion(task, isUpdate = false) {
  const data = {
    "properties": {
      "Name": {
        "title": [
          {
            "text": {
              "content": task.checked ? "[Done] " + task.content : task.content
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
      "isSync": {
        "checkbox": true
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

  const startDueDate = task.due?.['date'] ? new Date(task.due.date) : null;
  const dueDate = {}
  if (startDueDate) {
    dueDate.start = startDueDate?.toISOString()
  }
  const endDueDate = startDueDate
  if (endDueDate && task.duration?.amount > 0) {
    if ((task.duration?.unit)?.toLowerCase()?.includes("minute")) {
      endDueDate.setMinutes(startDueDate.getMinutes() + task.duration?.amount);
    } else if ((task.duration?.unit)?.toLowerCase()?.includes("hour")) {
      endDueDate.setHours(startDueDate.getHours() + task.duration?.amount);
    } else if ((task.duration?.unit)?.toLowerCase()?.includes("second")) {
      endDueDate.setSeconds(startDueDate.getSeconds() + task.duration?.amount);
    }

    dueDate.end = endDueDate?.toISOString()
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
