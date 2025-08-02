const Todoist_Token = '---'
const Notion_Token = '---'
const Database_ID = '---'
const Todoist_API = '---'
const Notion_API = '---'

const todoNotionSyncSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Sync");
const SyncTokenRange = todoNotionSyncSheet.getRange('B1')
const LastSyncTimeRange = todoNotionSyncSheet.getRange('B3')
var logsSheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName("Logs");
let LastWebhookSyncTimeRange = todoNotionSyncSheet.getRange('B9')
const freq = todoNotionSyncSheet.getRange('B5').getValue()

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
  "---": 'Inbox',
  "---": 'Work',
  "---": 'Personal',
  "---": 'Grocery',
  "---": 'Notes',
  "---": 'Health'
}

const SYNC_LABELS = ["ADDED_TO_NOTION", "ADDED_FROM_NOTION"]
function CHECK_SYNC_TAGS(arr) {
  if(!arr || !arr.length) return false
  const set = new Set(SYNC_LABELS)
  return arr.some(ele => set.has(ele))
}
