# Notion ↔ Todoist Sync Extension

A bidirectional synchronization system built with Google Apps Script that keeps tasks in sync between Notion databases and Todoist. The system handles real-time updates, recurring tasks, and prevents duplicate entries.

## Overview

This extension provides two-way synchronization between Notion and Todoist:
- **Notion → Todoist**: Syncs tasks created/updated in Notion to Todoist
- **Todoist → Notion**: Syncs tasks created/updated in Todoist to Notion

The system uses webhooks for real-time updates and scheduled triggers for periodic syncing, with intelligent conflict resolution and duplicate prevention.

---

## 1. Notion to Todoist Sync

### Flow Diagram

```
┌─────────────────┐
│  Notion User    │
│  Creates/Updates│
│     Task        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Notion Webhook │
│   (doPost)      │
│  api.gs         │
└────────┬────────┘
         │
         ├─► Validates webhook
         ├─► Checks 15-min window
         └─► Creates trigger
         │
         ▼
┌─────────────────┐
│  Trigger System │
│   trigger.gs    │
└────────┬────────┘
         │
         ├─► syncFromNotionToDoist()
         ├─► Runs every 1 minute
         └─► Stops after 15 minutes
         │
         ▼
┌─────────────────┐
│  Main Sync      │
│notion_to_todoist│
│      .gs        │
└────────┬────────┘
         │
         ├─► Fetch latest Notion data
         ├─► Filter user-only changes
         ├─► Fetch existing Todoist tasks
         └─► Process each page:
         │
         ├─► CREATE: New task (no TaskId)
         ├─► UPDATE: Existing task (has TaskId)
         ├─► COMPLETE: Mark as done
         └─► UNCOMPLETE: Reopen task
         │
         ▼
┌─────────────────┐
│  Todoist API    │
│   Updates       │
└─────────────────┘
```

### Detailed Flow

1. **Webhook Reception** (`api.gs`)
   - Notion sends webhook when page is created/updated/deleted
   - Validates source (workspace_id, author_id)
   - Checks event type (page.created, page.properties_updated, etc.)
   - Records webhook in logs sheet

2. **Trigger Scheduling** (`trigger.gs`)
   - Creates time-based trigger to run `syncFromNotionToDoist`
   - Runs every 1 minute for 15 minutes
   - Prevents duplicate triggers by discarding existing ones first

3. **Data Fetching** (`notion.helper.gs`)
   - `Fetching_Latest_Notion_Data()`: Queries Notion database for pages edited after last sync time
   - Filters to only include changes made by users (not API)
   - Returns array of updated pages

4. **Task Processing** (`notion_to_todoist.gs`)
   - For each Notion page:
     - **New Task** (no TaskId): Creates task in Todoist via REST API
     - **Existing Task** (has TaskId): Updates task in Todoist via Sync API
     - **Completed Task**: Sends `item_close` command
     - **Uncompleted Task**: Sends `item_uncomplete` command
   - Handles recurring tasks specially (updates dates, preserves pattern)

5. **Todoist Updates** (`todoist.helper.gs`)
   - `Create_Todoist()`: Creates new task using REST API
   - `Sync_todoist_operations()`: Updates tasks using Sync API (batch operations)
   - `Update_Todoist()`: Updates duration separately (REST API)

### APIs Used

#### Notion APIs
- `GET /v1/databases/{database_id}/query` - Query database for updated pages
- `GET /v1/pages/{page_id}` - Fetch specific page details
- `PATCH /v1/pages/{page_id}` - Update page properties (TaskId, Sync timestamp)

#### Todoist APIs
- `POST /rest/v2/tasks` - Create new task (REST API)
- `POST /rest/v2/tasks/{task_id}` - Update task (REST API, for duration)
- `GET /rest/v2/tasks?ids={task_ids}` - Fetch multiple tasks by IDs (REST API)
- `POST /sync/v9/sync` - Batch operations (Sync API)
  - Commands: `item_update`, `item_close`, `item_uncomplete`, `item_move`
- `POST /sync/v9/items/get` - Get task details (Sync API)

### Code Structure

```
Notion todoist sync/
├── api.gs                    # Webhook handler (doPost)
├── trigger.gs               # Trigger management & scheduling
├── notion_to_todoist.gs    # Main sync logic
├── notion.helper.gs        # Notion API helpers
├── todoist.helper.gs       # Todoist API helpers
├── constant.gs             # Constants & configuration
└── create_todoist_task_in_bulk_health.gs  # Utility script
```

### Key Functions

- `doPost(e)` - Webhook entry point
- `Notion_To_Todoist_Sync()` - Main sync function
- `Fetching_Latest_Notion_Data()` - Fetch updated pages
- `Create_Todoist()` - Create new Todoist task
- `Sync_todoist_operations()` - Batch update operations
- `Create_todoist_payload_object()` - Build Todoist payload
- `Create_update_payload()` - Build update commands

### Features

- ✅ Prevents duplicate task creation
- ✅ Handles recurring tasks (updates dates, preserves pattern)
- ✅ Filters API-generated changes (only syncs user changes)
- ✅ 15-minute sync window to prevent excessive API calls
- ✅ Updates Notion with Todoist TaskId after creation
- ✅ Handles task completion/uncompletion
- ✅ Syncs priority, project, due dates, duration
- ✅ Prevents duplicate "Notion Link" in descriptions

---

## 2. Todoist to Notion Sync

### Flow Diagram

```
┌─────────────────┐
│  Todoist User  │
│  Creates/Updates│
│     Task        │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│ Todoist Webhook │
│   (doPost)      │
│  api.gs         │
└────────┬────────┘
         │
         ├─► Validates webhook
         ├─► Checks 15-min window
         └─► Creates trigger
         │
         ▼
┌─────────────────┐
│  Trigger System │
│   trigger.gs    │
└────────┬────────┘
         │
         ├─► syncFromTodoistToNotion()
         ├─► Runs every 1 minute
         └─► Stops after 15 minutes
         │
         ▼
┌─────────────────┐
│  Main Sync      │
│todoist_to_notion│
│      .gs        │
└────────┬────────┘
         │
         ├─► Fetch Todoist changes (Sync API)
         ├─► Fetch matching Notion pages
         └─► Process each task:
         │
         ├─► CREATE: New task (no matching page)
         ├─► UPDATE: Existing task (has matching page)
         ├─► DELETE: Archive page if task deleted
         └─► RECURRING: Handle new instances
         │
         ▼
┌─────────────────┐
│  Notion API     │
│   Updates       │
└─────────────────┘
```

### Detailed Flow

1. **Webhook Reception** (`api.gs`)
   - Todoist sends webhook for task events
   - Validates source
   - Records event in logs sheet

2. **Trigger Scheduling** (`trigger.gs`)
   - Creates time-based trigger to run `syncFromTodoistToNotion`
   - Runs every 1 minute for 15 minutes
   - Prevents duplicate triggers

3. **Data Fetching** (`todoist.helper.gs`)
   - `Fetch_Todoist_Sync_Data()`: Uses Sync API with sync token
   - Fetches changed items since last sync
   - Returns array of updated tasks

4. **Task Processing** (`todoist_to_notion.gs`)
   - For each Todoist task:
     - **New Task** (no matching page): Creates page in Notion
     - **Existing Task** (has matching page): Updates page in Notion
     - **Deleted Task**: Archives page in Notion
     - **Recurring Task**: Handles new instances, updates dates
   - Special handling for recurring tasks:
     - If Notion task is recurring + completed → uncheck status, update date
     - If Notion task is not recurring + completed → convert to recurring, uncheck
     - If Notion task is not recurring + unchecked → add recurring pattern

5. **Notion Updates** (`notion.helper.gs`)
   - `Create()`: Creates new page in Notion database
   - `Update()`: Updates existing page properties
   - `Delete_page()`: Archives page

### APIs Used

#### Todoist APIs
- `POST /sync/v9/sync` - Fetch changed items (with sync token)
- `POST /sync/v9/sync` - Batch update operations
  - Commands: `item_update` (for labels, descriptions)

#### Notion APIs
- `POST /v1/pages` - Create new page
- `PATCH /v1/pages/{page_id}` - Update page properties
- `GET /v1/databases/{database_id}/query` - Query database for existing pages
- `GET /v1/pages/{page_id}` - Fetch specific page (for deletes)

### Code Structure

```
Todoist Notion sync/
├── api.gs                    # Webhook handler (doPost)
├── trigger.gs               # Trigger management & scheduling
├── todoist_to_notion.gs     # Main sync logic
├── notion.helper.gs         # Notion API helpers
├── todoist.helper.gs        # Todoist API helpers
├── constants.gs             # Constants & configuration
└── markdownConverter.gs    # Markdown to Notion blocks converter
```

### Key Functions

- `doPost(e)` - Webhook entry point
- `Todoist_To_Notion_Sync()` - Main sync function
- `Fetch_Todoist_Sync_Data()` - Fetch changed tasks (Sync API)
- `Fetch_notion_pages_by_taskIds()` - Find matching Notion pages
- `Create()` - Create new Notion page
- `Update()` - Update existing Notion page
- `Create_object_task_for_notion()` - Build Notion page object
- `Create_sync_payload()` - Build Todoist update commands

### Features

- ✅ Syncs task content, priority, project, due dates
- ✅ Handles recurring tasks (detects new instances, updates dates)
- ✅ Prevents duplicate updates (checks sync timestamps)
- ✅ Converts non-recurring to recurring tasks
- ✅ Handles task deletion (archives Notion pages)
- ✅ Adds "Notion Link" to Todoist descriptions
- ✅ Adds "ADDED_TO_NOTION" label to Todoist tasks
- ✅ Converts Todoist descriptions to Notion blocks (markdown)

---

## Code Structure Overview

```
notion-todoist-extension/
│
├── Notion todoist sync/          # Notion → Todoist direction
│   ├── api.gs                    # Webhook handler
│   ├── trigger.gs                # Trigger management
│   ├── notion_to_todoist.gs      # Main sync logic
│   ├── notion.helper.gs          # Notion API operations
│   ├── todoist.helper.gs         # Todoist API operations
│   ├── constant.gs               # Configuration
│   └── create_todoist_task_in_bulk_health.gs  # Utility
│
└── Todoist Notion sync/          # Todoist → Notion direction
    ├── api.gs                    # Webhook handler
    ├── trigger.gs                # Trigger management
    ├── todoist_to_notion.gs      # Main sync logic
    ├── notion.helper.gs          # Notion API operations
    ├── todoist.helper.gs         # Todoist API operations
    ├── constants.gs              # Configuration
    └── markdownConverter.gs      # Markdown converter
```

---

## Complete API Reference

### Notion APIs Used

| Endpoint | Method | Purpose | Version |
|----------|--------|---------|---------|
| `/v1/databases/{database_id}/query` | POST | Query database for pages | 2022-06-28 |
| `/v1/pages` | POST | Create new page | 2022-06-28 |
| `/v1/pages/{page_id}` | GET | Fetch page details | 2022-06-28 |
| `/v1/pages/{page_id}` | PATCH | Update page properties | 2022-06-28 |

**Note**: Requires upgrade to `2025-09-03` for multi-source database support.

### Todoist APIs Used

#### REST API v2
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/rest/v2/tasks` | POST | Create new task |
| `/rest/v2/tasks/{task_id}` | POST | Update task (duration) |
| `/rest/v2/tasks?ids={task_ids}` | GET | Fetch multiple tasks |
| `/rest/v2/tasks/{task_id}` | DELETE | Delete task |
| `/rest/v2/projects/` | GET | List projects |
| `/rest/v2/labels` | GET | List labels |

#### Sync API v9
| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/sync/v9/sync` | POST | Batch operations (create, update, delete) |
| `/sync/v9/sync?limit=10` | GET | Fetch changed items (with sync token) |
| `/sync/v9/items/get` | POST | Get specific item details |

### Sync API Commands

- `item_update` - Update task properties (content, priority, due date, description, labels)
- `item_close` - Complete a task
- `item_uncomplete` - Reopen a completed task
- `item_move` - Move task to different project
- `item_delete` - Delete a task

---

## Data Flow Summary

### Notion → Todoist Sync

1. User creates/updates task in Notion
2. Notion webhook triggers `doPost()` in `api.gs`
3. Trigger scheduled to run `syncFromNotionToDoist`
4. Fetches updated pages from Notion database
5. Filters to user-only changes
6. Fetches corresponding Todoist tasks
7. Creates/updates tasks in Todoist
8. Updates Notion with Todoist TaskId

### Todoist → Notion Sync

1. User creates/updates task in Todoist
2. Todoist webhook triggers `doPost()` in `api.gs`
3. Trigger scheduled to run `syncFromTodoistToNotion`
4. Fetches changed tasks from Todoist (Sync API)
5. Finds matching Notion pages by TaskId
6. Creates/updates pages in Notion
7. Updates Todoist with "ADDED_TO_NOTION" label

---

## Key Features

### Recurring Tasks
- Detects recurring tasks using `due.is_recurring` and `due.string`
- Handles new recurring instances automatically
- Updates Notion with new TaskId and due date
- Converts non-recurring tasks to recurring when needed

### Duplicate Prevention
- Checks for existing TaskId before creating
- Prevents duplicate "Notion Link" in descriptions
- Uses sync timestamps to avoid unnecessary updates
- 15-minute sync window prevents excessive API calls

### Conflict Resolution
- Only syncs user changes (filters API-generated changes)
- Compares timestamps to determine which update is newer
- Handles edge cases (completed tasks, deleted tasks)

### Error Handling
- Validates webhook sources
- Logs all operations for debugging
- Graceful error handling with try-catch blocks

---

## Configuration

### Required Constants
- `Notion_Token` - Notion API integration token
- `Todoist_Token` - Todoist API token
- `Database_ID` - Notion database ID
- `projectNameIdMap` - Mapping of project names to Todoist project IDs
- `priorityIdMap` - Mapping of priority names to Todoist priority values

### Google Sheets Configuration
- **Sync Sheet**: Stores sync tokens, last sync times, frequency
- **Logs Sheet**: Records all webhook events and operations

---

## Setup Instructions

1. Create Google Apps Script project
2. Add all `.gs` files to the project
3. Configure constants in `constant.gs` / `constants.gs`
4. Set up Notion webhook pointing to `doPost` function
5. Set up Todoist webhook pointing to `doPost` function
6. Configure Google Sheets with required sheets
7. Grant necessary permissions

---

## Notes

- **API Version**: Currently using Notion API `2022-06-28`. Upgrade to `2025-09-03` required for multi-source database support.
- **Rate Limiting**: 15-minute sync windows prevent API rate limit issues
- **Sync Frequency**: Configurable via `freq` variable (syncs per minute)
- **Recurring Tasks**: Fully supported with automatic instance handling
