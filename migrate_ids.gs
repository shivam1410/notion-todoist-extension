/**
 * Migration Script: Convert old numeric Todoist IDs to new hash IDs
 * 
 * This script reads old numeric IDs from column A of "todoist_v1" sheet
 * and writes the corresponding new hash IDs to column B.
 * 
 * Uses Todoist API v1 ID mapping endpoint:
 * GET /api/v1/id_mappings/tasks/{old_id1},{old_id2},...
 * 
 * Supports up to 100 IDs per API call
 */

function migrateTodoistIds() {
  try {
    // Get the migration sheet
    const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
    let migrationSheet = spreadsheet.getSheetByName("todoist_v1");
    
    // Create sheet if it doesn't exist
    if (!migrationSheet) {
      migrationSheet = spreadsheet.insertSheet("todoist_v1");
      migrationSheet.getRange(1, 1).setValue("Old ID");
      migrationSheet.getRange(1, 2).setValue("New ID");
      migrationSheet.getRange(1, 3).setValue("Status");
      migrationSheet.getRange(1, 1, 1, 3).setFontWeight("bold");
      SpreadsheetApp.getUi().alert("Created 'todoist_v1' sheet. Please add old IDs in column A and run again.");
      return;
    }
    
    // Get all old IDs from column A (skip header row)
    const lastRow = migrationSheet.getLastRow();
    if (lastRow <= 1) {
      SpreadsheetApp.getUi().alert("No data found. Please add old IDs in column A starting from row 2.");
      return;
    }
    
    const oldIdsRange = migrationSheet.getRange(2, 1, lastRow - 1, 1);
    const oldIdsData = oldIdsRange.getValues();
    
    // Extract old IDs (filter out empty cells)
    const oldIds = oldIdsData
      .map(row => row[0])
      .filter(id => id !== null && id !== '' && id !== undefined)
      .map(id => String(id).trim());
    
    if (oldIds.length === 0) {
      SpreadsheetApp.getUi().alert("No valid IDs found in column A.");
      return;
    }
    
    console.log(`Found ${oldIds.length} old IDs to migrate`);
    
    // Batch process IDs (API supports up to 100 IDs per request)
    const BATCH_SIZE = 100;
    const newIdsMap = new Map(); // Map old_id -> new_id
    const statusMap = new Map(); // Map old_id -> status message
    
    for (let i = 0; i < oldIds.length; i += BATCH_SIZE) {
      const batch = oldIds.slice(i, i + BATCH_SIZE);
      console.log(`Processing batch ${Math.floor(i / BATCH_SIZE) + 1}: ${batch.length} IDs`);
      
      try {
        const mappings = fetchIdMappings(batch);
        
        // Process successful mappings
        mappings.forEach(mapping => {
          if (mapping.old_id && mapping.new_id) {
            newIdsMap.set(String(mapping.old_id), mapping.new_id);
            statusMap.set(String(mapping.old_id), "Migrated");
          }
        });
        
        // Mark IDs that weren't found in the response
        batch.forEach(oldId => {
          if (!newIdsMap.has(String(oldId)) && !statusMap.has(String(oldId))) {
            statusMap.set(String(oldId), "Not found");
          }
        });
        
        // Small delay to avoid rate limiting
        Utilities.sleep(200);
        
      } catch (error) {
        console.error(`Error processing batch: ${error.message}`);
        batch.forEach(oldId => {
          statusMap.set(String(oldId), `Error: ${error.message}`);
        });
      }
    }
    
    // Write results to sheet
    const results = [];
    oldIdsData.forEach((row, index) => {
      const oldId = String(row[0]).trim();
      if (oldId === '' || oldId === 'null' || oldId === 'undefined') {
        results.push(['', '']); // Empty row
      } else {
        const newId = newIdsMap.get(oldId) || '';
        const status = statusMap.get(oldId) || 'Not processed';
        results.push([newId, status]);
      }
    });
    
    // Write new IDs to column B and status to column C
    if (results.length > 0) {
      migrationSheet.getRange(2, 2, results.length, 2).setValues(results);
    }
    
    // Summary
    const migratedCount = Array.from(statusMap.values()).filter(s => s === "Migrated").length;
    const notFoundCount = Array.from(statusMap.values()).filter(s => s === "Not found").length;
    const errorCount = Array.from(statusMap.values()).filter(s => s.startsWith("Error")).length;
    
    const summary = `Migration Complete!\n\n` +
      `Total IDs processed: ${oldIds.length}\n` +
      `Successfully migrated: ${migratedCount}\n` +
      `Not found: ${notFoundCount}\n` +
      `Errors: ${errorCount}`;
    
    console.log(summary);
    SpreadsheetApp.getUi().alert(summary);
    
  } catch (error) {
    console.error(`Migration failed: ${error.message}`);
    SpreadsheetApp.getUi().alert(`Migration failed: ${error.message}`);
  }
}

/**
 * Fetch ID mappings from Todoist API
 * @param {Array<string>} oldIds - Array of old numeric IDs
 * @returns {Array<Object>} Array of {old_id, new_id} mappings
 */
function fetchIdMappings(oldIds) {
  const idsString = oldIds.join(',');
  const url = `${Todoist_API_BASE}/id_mappings/tasks/${idsString}`;
  
  const options = {
    method: 'get',
    headers: {
      'Authorization': `Bearer ${Todoist_Token}`
    },
    muteHttpExceptions: true
  };
  
  const response = UrlFetchApp.fetch(url, options);
  const responseCode = response.getResponseCode();
  
  if (responseCode === 200) {
    const data = JSON.parse(response.getContentText());
    return Array.isArray(data) ? data : [];
  } else {
    const errorText = response.getContentText();
    throw new Error(`API returned ${responseCode}: ${errorText}`);
  }
}

/**
 * Helper function to migrate a single ID (for testing)
 * @param {string|number} oldId - Old numeric ID
 * @returns {string|null} New hash ID or null if not found
 */
/* NOT_USED_IN_SCRIPT */ 
function migrateSingleId(oldId) {
  try {
    const mappings = fetchIdMappings([String(oldId)]);
    if (mappings.length > 0 && mappings[0].new_id) {
      return mappings[0].new_id;
    }
    return null;
  } catch (error) {
    console.error(`Error migrating ID ${oldId}: ${error.message}`);
    return null;
  }
}
