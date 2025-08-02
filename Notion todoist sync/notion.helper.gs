function Fetching_Latest_Notion_Data(lastSyncTimeStamp) {
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
      return data.results;
    } else {
      throw new Error(`Code: ${response.getResponseCode()} Message: , ${response.getContentText()}`)
    }
  } catch (error) {
    console.error(`Error in fetching notion data is: ${error.status?? 500}, ${error.message}`)
    throw new Error(`Error in fetching notion data is: ${error.status?? 500}, ${error?.message}`)
  }
}

function Fetching_Notion_Data_BY_ID(pageId) {
  const options = {
    method: 'get',
    contentType: 'application/json',
    headers: {
      'Authorization': `Bearer ${Notion_Token}`,
      'Notion-Version': '2022-06-28'
    },
    muteHttpExceptions: true
  };

  const url = `https://api.notion.com/v1/pages/${pageId}`;
  const response = UrlFetchApp.fetch(url, options);

  if (response.getResponseCode() === 200) {
    const pageData = JSON.parse(response.getContentText());
    return pageData;
  } else {
    console.error("Failed to fetch page:", response.getContentText());
    return null;
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

function update_notion_for_create(pageId, taskId, taskCreatedAt) {
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
          "number": taskCreatedAt ? +new Date(taskCreatedAt): +new Date()
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