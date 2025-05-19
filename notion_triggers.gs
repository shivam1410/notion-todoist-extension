function syncFromNotionToDoist() {
  const lastSyncTimeStr = LastWebhookSyncTimeRange.getValue();
  const lastSyncTime = lastSyncTimeStr ? new Date(lastSyncTimeStr) : null;
  const now = new Date();

  if (!lastSyncTime) {
    discardAllTriggers()
    console.log('No sync start time found, stopping triggers.');
    return;
  }

  const fifteenMinutesLater = new Date(lastSyncTime.getTime() + 15 * 60 * 1000);
  
  if (now > fifteenMinutesLater) {
    discardAllTriggers()
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
  const triggerFunctionName = 'syncFromNotionToDoist';
  discardAllTriggers()
  const triggerTime = new Date(Date.now() + 1 * 60 * 1000);
  ScriptApp.newTrigger(triggerFunctionName)
    .timeBased()
    .at(triggerTime)
    .create();
}

// Delete existing triggers for this function
function discardAllTriggers() {
  const existingTriggers = ScriptApp.getProjectTriggers();
  existingTriggers.forEach(trigger => {
    if (trigger.getHandlerFunction() === triggerFunctionName) {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

function myFunctionN_T(i) {
  console.log('----------- Notion_To_Todoist_Sync --- ', i, urlfetchExecution);
  Notion_To_Todoist_Sync()
}
