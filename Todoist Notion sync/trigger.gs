function syncFromTodoistToNotion() {
  const TRIGGER_FUNCTION_NAME = 'syncFromTodoistToNotion';
  const lastSyncTimeStr = LastWebhookSyncTimeRange.getValue();
  const lastSyncTime = lastSyncTimeStr ? new Date(lastSyncTimeStr) : null;
  const now = new Date();

  if (!lastSyncTime) {
    discardAllTriggers(TRIGGER_FUNCTION_NAME)
    console.log('No sync start time found, stopping triggers.');
    return;
  }

  const fifteenMinutesLater = new Date(lastSyncTime.getTime() + 15 * 60 * 1000);
  
  if (now > fifteenMinutesLater) {
    discardAllTriggers(TRIGGER_FUNCTION_NAME)
    console.log('15 minutes have passed since sync started. Stopping triggers.');
    return; // Stop scheduling more triggers
  }

  // Your syncing logic
  for (let i = 0; i < freq; i++) {
    myFunctionN_T(i);
    if (i !== freq - 1) {
      Utilities.sleep(60 * 1000 / freq);
    }
  }

  // Schedule th de next trigger 1 minute later
  createSingleSyncTrigger();
}

function createSingleSyncTrigger() {
  const TRIGGER_FUNCTION_NAME = 'syncFromTodoistToNotion';
  discardAllTriggers(TRIGGER_FUNCTION_NAME)
  console.log('---Trigger created---')
  const triggerTime = new Date(Date.now() + 100);
  ScriptApp.newTrigger(TRIGGER_FUNCTION_NAME)
    .timeBased()
    .at(triggerTime)
    .create();
}

// Delete existing triggers for this function
function discardAllTriggers(triggerName) {
  if(!triggerName) return
  const existingTriggers = ScriptApp.getProjectTriggers();
  existingTriggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === triggerName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  console.log('---All Trigger Cleared---')
}

function myFunctionN_T(i) {
  try {
    console.log('----------- Todoist_To_Notion_Sync --- ', i, urlfetchExecution);
    Todoist_To_Notion_Sync()
  } catch(error) {
    console.error(error)
  }
}
