const Todoist_Token = '---'
const Notion_Token = '---'
const Database_ID = '---'

const Todoist_API_BASE = 'https://api.todoist.com/api/v1'
const Todoist_API = 'https://api.todoist.com/api/v1/tasks'
const Todoist_SYNC_API = 'https://api.todoist.com/api/v1/sync'
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
  'Inbox': '6CrfGxHWw6WWrF9X',
  'Work': '6Vm6wXxWFJ3XH94q',
  'Personal': '6VmMgwFrVJhq2395',
  'Grocery': '6WjFJwj8vmW5hpw4',
  'Notes': '6X63WqwQX5fFWW38',
  'Health': '6c4v5CqxgprwG3QR',
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
  '6CrfGxHWw6WWrF9X': 'Inbox',
  '6Vm6wXxWFJ3XH94q': 'Work',
  '6VmMgwFrVJhq2395': 'Personal',
  '6WjFJwj8vmW5hpw4': 'Grocery',
  '6X63WqwQX5fFWW38': 'Notes',
  '6c4v5CqxgprwG3QR': 'Health'
}

const SYNC_COMMENTS = ["ADDED_TO_NOTION", "ADDED_FROM_NOTION"]

// Check if a task has sync comments (replaces label-based sync checking)
function CHECK_SYNC_COMMENTS(notes) {
  if(!notes || !notes.length) return false
  const syncCommentSet = new Set(SYNC_COMMENTS)
  return notes.some(note => {
    const content = note.content || '';
    return SYNC_COMMENTS.some(syncComment => content.includes(syncComment))
  })
}

// Filter out sync labels from labels array (for storing in Notion)
function FILTER_SYNC_LABELS(labels) {
  if(!labels || !labels.length) return []
  const syncLabelSet = new Set(["ADDED_TO_NOTION", "ADDED_FROM_NOTION"])
  return labels.filter(label => !syncLabelSet.has(label))
}