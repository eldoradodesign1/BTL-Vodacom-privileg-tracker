function doPost(e) {
  try {
    const raw = e && e.postData ? e.postData.contents : '';
    if (!raw) {
      return responseJSON({ success: false, message: 'Aucune donnée reçue' });
    }

    const payload = typeof raw === 'string' ? safeParseJson(raw) : raw;
    if (!payload || typeof payload !== 'object') {
      return responseJSON({ success: false, message: 'Payload invalide', raw: String(raw) });
    }

    const action = payload.action || payload.event || payload.type || '';

    if (action === 'processCheckin' || payload.type === 'checkin' || payload.tab === 'Checkins') {
      return responseJSON(processCheckin(payload));
    }

    if (action === 'processLead' || payload.type === 'lead' || payload.tab === 'Leads') {
      return responseJSON(processLead(payload));
    }

    if (action === 'processReport' || payload.type === 'report' || payload.tab === 'DailyReports') {
      return responseJSON(processReport(payload));
    }

    if (action === 'processChat' || payload.type === 'chat' || payload.tab === 'Chat') {
      return responseJSON(processChat(payload));
    }

    return responseJSON({ success: true, message: 'Événement reçu', data: payload });
  } catch (err) {
    return responseJSON({ success: false, error: err && err.toString ? err.toString() : String(err) });
  }
}

function responseJSON(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function safeParseJson(raw) {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    return { raw: String(raw) };
  }
}

function setupSheet(sheetName, headers) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(sheetName);
  if (!sheet) {
    sheet = ss.insertSheet(sheetName);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function processCheckin(d) {
  try {
    let photoUrl = '';
    if (d.photo && String(d.photo).indexOf('data:image') === 0) {
      try {
        const folder = DriveApp.getFoldersByName('Vodacom_Pointages_Photos');
        const folderObj = folder.hasNext() ? folder.next() : DriveApp.createFolder('Vodacom_Pointages_Photos');
        const parts = String(d.photo).split(',');
        const contentType = parts[0].split(':')[1].split(';')[0];
        const bytes = Utilities.base64Decode(parts[1]);
        const fileName = 'Pointage_' + (d.agent_id || 'agent') + '_' + Date.now() + '.jpg';
        const blob = Utilities.newBlob(bytes, contentType, fileName);
        const file = folderObj.createFile(blob);
        file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
        photoUrl = 'https://lh3.googleusercontent.com/d/' + file.getId();
      } catch (errDrive) {
        console.error('Drive error: ' + errDrive.toString());
      }
    } else if (d.photo && String(d.photo).indexOf('http') === 0) {
      photoUrl = String(d.photo);
    }

    const sheet = setupSheet('Checkins', ['id', 'assignment_id', 'agent_id', 'type', 'timestamp', 'lat', 'long', 'accuracy', 'photo', 'device', 'status']);
    sheet.appendRow([
      d.id || d.uuid || Utilities.getUuid(),
      d.assignment_id || '',
      d.agent_id || '',
      d.type || 'IN',
      d.timestamp || new Date().toISOString(),
      d.lat || 0,
      d.long || d.lng || 0,
      d.accuracy || 0,
      photoUrl,
      d.device || 'Mobile App',
      d.status || 'synced'
    ]);

    return { success: true, photoUrl: photoUrl };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function processLead(d) {
  try {
    const sheet = setupSheet('Leads', ['id', 'timestamp', 'agent_id', 'shop_id', 'client_name', 'msisdn', 'action_type', 'bundle_type', 'status']);
    sheet.appendRow([
      d.id || d.uuid || Utilities.getUuid(),
      d.timestamp || new Date().toISOString(),
      d.agent_id || '',
      d.shop_id || 'S001',
      d.client_name || d.name || '',
      d.msisdn || d.phone || '',
      d.action_type || '',
      d.bundle_type || '',
      d.status || 'synced'
    ]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function processReport(d) {
  try {
    const sheet = setupSheet('DailyReports', ['id', 'date', 'shop_name', 'priv', 'roam', 'bund', 'agent_id', 'comment', 'timestamp']);
    sheet.appendRow([
      d.id || d.uuid || Utilities.getUuid(),
      d.date || new Date().toISOString().split('T')[0],
      d.shop_name || '',
      d.priv || 0,
      d.roam || 0,
      d.bund || 0,
      d.agent_id || '',
      d.comment || '',
      d.timestamp || new Date().toISOString()
    ]);
    return { success: true };
  } catch (e) {
    return { success: false, error: e.toString() };
  }
}

function processChat(d) {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(10000);
    const sheet = setupSheet('Chat', ['id', 'sender_id', 'sender_name', 'sender_role', 'message', 'created_at', 'timestamp', 'read_by', 'deleted', 'deleted_by', 'deleted_at']);

    const messageId = d.id || Utilities.getUuid();
    if (sheet.getLastRow() > 1) {
      const existingIds = sheet.getRange(2, 1, sheet.getLastRow() - 1, 1).getValues().map(function(row) {
        return String(row[0] || '');
      });
      if (existingIds.indexOf(messageId) !== -1) {
        return { success: true, duplicate: true };
      }
    }

    sheet.appendRow([
      messageId,
      d.sender_id || '',
      d.sender_name || '',
      d.sender_role || '',
      d.message || '',
      d.created_at || new Date().toISOString(),
      d.timestamp || Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'HH:mm'),
      JSON.stringify(d.read_by || []),
      false,
      '',
      ''
    ]);

    return { success: true, messageId: messageId };
  } catch (e) {
    return { success: false, error: e.toString() };
  } finally {
    if (lock.hasLock()) {
      lock.releaseLock();
    }
  }
}

function doGet(e) {
  const action = e && e.parameter ? e.parameter.action : '';
  if (action === 'getChatMessages') {
    return responseJSON(getChatMessages());
  }
  return responseJSON({ success: false, message: 'Action GET inconnue' });
}

function getChatMessages() {
  try {
    const sheet = setupSheet('Chat', ['id', 'sender_id', 'sender_name', 'sender_role', 'message', 'created_at', 'timestamp', 'read_by', 'deleted', 'deleted_by', 'deleted_at']);
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) {
      return { success: true, messages: [] };
    }

    const rows = sheet.getRange(2, 1, lastRow - 1, 11).getValues();
    const messages = rows.map(function(row) {
      let readBy = [];
      try {
        readBy = JSON.parse(String(row[7] || '[]'));
      } catch (err) {}

      return {
        id: String(row[0] || ''),
        sender_id: String(row[1] || ''),
        sender_name: String(row[2] || ''),
        sender_role: String(row[3] || 'agent'),
        message: String(row[4] || ''),
        created_at: row[5] instanceof Date ? row[5].toISOString() : String(row[5] || ''),
        timestamp: String(row[6] || ''),
        read_by: Array.isArray(readBy) ? readBy : [],
        deleted: String(row[8]).toLowerCase() === 'true',
        deleted_by: String(row[9] || ''),
        deleted_at: row[10] instanceof Date ? row[10].toISOString() : String(row[10] || '')
      };
    }).sort(function(a, b) {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
    });

    return { success: true, messages: messages };
  } catch (e) {
    return { success: false, error: e.toString(), messages: [] };
  }
}
