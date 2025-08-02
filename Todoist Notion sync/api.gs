// Handle POST requests - appends new row
const events = ["item:updated", "item:added", "item:deleted", "item:completed", "item:uncompleted"]

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);

    const isTrusted = isFromTrustedTodoistSource(data);  

    if (!data || !data.event_name) throw new Error("Invalid data or missing event_name");
    const {sync, err} = isValidType(data.event_name);
    const single_row = convertToRow(data);
    
    if(!isTrusted) {
      single_row.push("Not Trusted")
      saveData([single_row])
      return 'OK'
    } 
    if(!sync) {
      single_row.push(err)
      saveData([single_row])
      return 'OK'
    }

    const lastSyncTimeValue = LastWebhookSyncTimeRange.getValue();
    const lastSyncTime = lastSyncTimeValue ? new Date(lastSyncTimeValue) : new Date(0); // Epoch or some old date

    const fifteenMinutesEarlier = new Date(Date.now() - 15 * 60 * 1000);

    if(lastSyncTime > fifteenMinutesEarlier) {
      single_row.push("SCHEDULING-SKIPPED-15-MIN")
    }
    else if (lastSyncTime < fifteenMinutesEarlier) {
      // 15 minute sync
      ScriptApp.newTrigger("syncFromTodoistToNotion")
        .timeBased()
        .after(1)
        .create();

      single_row.push("SCHEDULED-SYNC")
      LastWebhookSyncTimeRange.setValue((new Date()).toISOString())
    } else {
      single_row.push("NOT-SCHEDULED")
    }

    saveData([single_row])
    return 'OK';

  } catch (error) {
    content = e?.postData?.contents
    const save_data = []
    if(content) save_data.push(JSON.stringify(e?.postData?.contents))
    if(error) save_data.push(error)
    saveData([save_data])
    return 'Failure';
  }
}

function saveData(data) {
  lastRow = logsSheet.getLastRow()
  logsSheet.getRange(lastRow + 1, 1, 1, data[0].length).setValues(data);
}

function isFromTrustedTodoistSource(data) {
  return true
}

function isValidType (event_name) {
  if(!event_name) {
    return { sync: false, err: `No page type send` };
  }
  
  if(!(event_name && events.includes(event_name))) {
    return {sync: false, err: `task event: ${event_name} not allowed`}
  }

  return { sync: true }
}

function convertToRow(data) {
  return [
    data?.event_data?.id,
    Utilities.formatDate(new Date(data.triggered_at), "IST", 'E, MMM dd yyyy, HH:mm:ss'),
    data.event_name,
    data?.event_data?.url,
    new Date(data?.event_data?.added_at),
    new Date(data?.event_data?.updated_at),
    data?.event_data?.completed_at ? new Date(data?.event_data?.completed_at): '',
    data?.event_data_extra?.update_intent
  ];
}
