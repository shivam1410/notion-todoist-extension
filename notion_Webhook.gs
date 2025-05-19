// Handle POST requests - appends new row
const page_types = ["page.created", "page.properties_updated", "page.deleted", "page.moved"]
const delete_page_types = ["page.deleted", "page.moved"]

function doPost(e) {
  try {
    const data = JSON.parse(e.postData.contents);
    if(data?.verification_token) {
      todoNotionSyncSheet.getRange('B7').setValue(data?.verification_token)

      return 'OK';
    }
    
    const isTrusted = isFromTrustedNotionSource(data);   
    if(!isTrusted) {
      throw new Error("Not trusted");
    }
    if (!data || !data.type) throw new Error("Invalid data or missing type");
    const {sync, err} = isValidType(data?.type);
    if(!sync) {
      throw new Error(err)
    }
    const single_row = convertToRow(data);
    const lastSyncTimeValue = LastWebhookSyncTimeRange.getValue();
    const lastSyncTime = lastSyncTimeValue ? new Date(lastSyncTimeValue) : new Date(0); // Epoch or some old date

    const fifteenMinutesEarlier = new Date(Date.now() - 15 * 60 * 1000);
    const isDeleteType = delete_page_types.includes(data.type);

    
   // Schedule deleting, no matter the last sync
    if(isDeleteType) {
      ScriptApp.newTrigger("DELETE_TASK_FROM_TODOIST")
        .timeBased()
        .after(1)
        .create();
      single_row.push("SCHEDULED-DELETE")
    }
    else if (!isDeleteType && lastSyncTime < fifteenMinutesEarlier) {
      // 15 minute sync
      ScriptApp.newTrigger("SYNC_15_MINUTES")
        .timeBased()
        .after(1)
        .create();

      single_row.push("SCHEDULED-SYNC")
      LastWebhookSyncTimeRange.setValue((new Date()).toISOString())
    } else {
      single_row.push("NOT-SCHEDULED")
    }

    logsSheet.getRange(logsSheet.getLastRow() + 1, 1, 1, single_row.length).setValues([single_row]);
    return 'OK';

  } catch (error) {
    saveData(logsSheet.getLastRow(), [[JSON.stringify(e, null, " "), error]] )
    return 'Failure';
  }
}

function saveData(lastRow, data) {
  logsSheet.getRange(lastRow + 1, 1, 1, data[0].length).setValues(data);
}

function isFromTrustedNotionSource(data) {
  const expectedWorkspaceId = "---";
  const expectedIntegrationId ="---";
  const expectedAuthorId = "---";

  return (
    data &&
    data.workspace_id === expectedWorkspaceId &&
    data.integration_id === expectedIntegrationId &&
    data.authors?.[0]?.id === expectedAuthorId
  );
}

function isValidType (data_type) {
  if(!data_type) {
    return { sync: false, err: `No page type send` };
  }
  
  if(!(data_type && page_types.includes(data_type))) {
    return {sync: false, err: `page type: ${data_type} not allowed`}
  }

  return { sync: true }
}

function convertToRow(data) {
  return [
    data.id,
    Utilities.formatDate(new Date(data.timestamp), "IST", 'E, MMM dd yyyy, HH:mm:ss'),
    data.workspace_id,
    data.workspace_name,
    data.subscription_id,
    data.integration_id,
    data.attempt_number,
    data.type,
    (data.data?.updated_properties || []).join(','),
    data.authors?.[0]?.id || '',
    data.authors?.[0]?.type || '',
    data.entity?.id || '',
    data.entity?.type || '',
    data.data?.parent?.id || '',
    data.data?.parent?.type || ''
  ];
}
