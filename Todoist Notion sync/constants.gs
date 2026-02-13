const Todoist_Token = '---'
const Notion_Token = '---'
const Database_ID = '---'
const Todoist_API = 'https://api.todoist.com/rest/v2/tasks'
const Notion_API = 'https://api.notion.com/v1'

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
  const syncLabelSet = new Set(SYNC_LABELS)
  return labels.filter(label => !syncLabelSet.has(label))
}
