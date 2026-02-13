function Fetch_notion_pages_by_taskIds(taskIds) {
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

function Update(page, taskObject) {
  try {
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
    return data
  } catch (error) {
    console.error('Error updating page in Notion:', error.message);
  }
}

function Create(taskObject) {
  try {
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
    return data
  } catch (error) {
    console.error('Error creating page in Notion:', error.message);
    throw error
  }
}