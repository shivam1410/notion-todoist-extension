const Todoist_Token = '---'
const Notion_Token = '---'
const Database_ID = '---'

const Todoist_API = 'https://api.todoist.com/rest/v2/tasks'
const Notion_API = 'https://api.notion.com/v1'

var todoNotionSyncSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sync");
var logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Logs");
const SyncTokenRange = todoNotionSyncSheet.getRange('B1')
let LastSyncTimeRange = todoNotionSyncSheet.getRange('B3')
let LastWebhookSyncTimeRange = todoNotionSyncSheet.getRange('B9')
const freq = todoNotionSyncSheet.getRange('B5').getValue() // number of syncs per minute, 5 means sync every 60/5 = 12 seconds

const priorityIdMap = {
  "P4": 1,
  "P3": 2,
  "P2": 3,
  "P1": 4,
}

const projectNameIdMap = {
  'Inbox': '---',
  'Work': '---',
  'Personal': '---',
  'Grocery': '---',
  'Notes': '---',
  'Health': '---',
}
const users = {
  "---": "User",
  "---": "API"
}

let urlfetchExecution = 0

const priorityMap = {
  1: "P4",
  2: "P3",
  3: "P2",
  4: "P1",
}

const projectIDNameMap = {
  '---': 'Inbox',
  '---': 'Work',
  '---': 'Personal',
  '---': 'Grocery',
  '---': 'Notes',
  '---': 'Health'
}

function CHECK_SYNC_TAGS(arr) {
  if(!arr || !arr.length || !Array.isArray(arr)) return false
  const set = new Set(["ADDED_TO_NOTION", "ADDED_FROM_NOTION"])
  return arr.some(ele => set.has(ele))
}