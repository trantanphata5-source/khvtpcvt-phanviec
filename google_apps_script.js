/**
 * GOOGLE APPS SCRIPT - ĐỒNG BỘ PHÂN CÔNG CÔNG VIỆC PHÒNG KẾ HOẠCH VẬT TƯ (PCVT)
 * Spreadsheet: Công tác KHVT
 * URL: https://docs.google.com/spreadsheets/d/1Pa1titRZwwikbXyBhniHgZr-lX2P5D12jdMUbxHw-ck/edit
 * 
 * ==============================================================================
 * HƯỚNG DẪN TRIỂN KHAI LÊN GOOGLE SHEET (CHỈ MẤT 1 PHÚT):
 * ==============================================================================
 * 1. Mở file Google Sheet cơ sở dữ liệu trên bằng tài khoản quản trị.
 * 2. Trên thanh menu, chọn: Tiện ích mở rộng (Extensions) -> Apps Script.
 * 3. Xóa toàn bộ nội dung mẫu đang có trong Code.gs, dán toàn bộ mã nguồn này vào.
 * 4. Nhấn biểu tượng Lưu (Ctrl + S).
 * 5. Bấm nút "Triển khai" (Deploy) màu xanh ở góc trên bên phải -> "Triển khai mới" (New deployment):
 *    - Loại: Ứng dụng web (Web app)
 *    - Mô tả: "KHVT PCVT Task Management Sync API"
 *    - Thực thi dưới dạng (Execute as): Tôi (Me - email của bạn)
 *    - Ai có quyền truy cập (Who has access): Bất kỳ ai (Anyone)  <-- BẮT BUỘC ĐỂ TRANG WEB TỰ ĐỘNG ĐỒNG BỘ
 *    - Bấm "Triển khai" (Deploy).
 * 6. Google sẽ hỏi cấp quyền: Chọn tài khoản của bạn -> Bấm "Advanced" (Nâng cao) -> Bấm "Go to Untitled project (unsafe)" -> Bấm "Allow" (Cho phép).
 * 7. Sao chép "URL của ứng dụng web" (có đuôi /exec).
 * 8. Dán URL này vào nút "☁️ Đồng bộ Cloud" trên trang web https://khvtpcvt-phanviec.vercel.app.
 * ==============================================================================
 */

const STORAGE_PROP_KEY = 'KHVT_BOARD_DATA';

/**
 * Xử lý GET request: Lấy dữ liệu công việc mới nhất
 */
function doGet(e) {
  try {
    var props = PropertiesService.getScriptProperties();
    var savedJson = props.getProperty(STORAGE_PROP_KEY);
    
    var data = null;
    if (savedJson) {
      data = JSON.parse(savedJson);
    }
    
    var response = {
      status: 'success',
      hasData: !!data,
      data: data,
      timestamp: data ? data.lastModified : new Date().toISOString()
    };

    return createOutput(response, e);
  } catch (error) {
    return createOutput({ status: 'error', message: error.toString() }, e);
  }
}

/**
 * Xử lý POST request: Lưu dữ liệu phân công công việc từ Web
 */
function doPost(e) {
  try {
    var payloadStr = '';
    if (e && e.postData && e.postData.contents) {
      payloadStr = e.postData.contents;
    } else if (e && e.parameter && e.parameter.data) {
      payloadStr = e.parameter.data;
    }

    if (!payloadStr) {
      return createOutput({ status: 'error', message: 'Không có dữ liệu gửi lên' }, e);
    }

    var parsed = JSON.parse(payloadStr);
    parsed.lastModified = new Date().toISOString();

    // 1. Lưu siêu tốc vào Script Properties để phục vụ truy xuất tức thì
    var props = PropertiesService.getScriptProperties();
    props.setProperty(STORAGE_PROP_KEY, JSON.stringify(parsed));

    // 2. Đồng bộ ngược lại các hàng trong Google Sheet (nếu có sheet công việc)
    try {
      syncToSpreadsheet(parsed);
    } catch (sheetErr) {
      console.warn('Lỗi ghi vào Google Sheet:', sheetErr);
    }

    return createOutput({
      status: 'success',
      message: 'Đã lưu và đồng bộ dữ liệu thời gian thực thành công!',
      lastModified: parsed.lastModified
    }, e);
  } catch (error) {
    return createOutput({ status: 'error', message: error.toString() }, e);
  }
}

/**
 * Đồng bộ dữ liệu phân công ngược vào Google Sheet
 */
function syncToSpreadsheet(data) {
  if (!data || !data.tasks || !Array.isArray(data.tasks)) return;

  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) return;

  var sheet = ss.getSheets()[0]; // Sheet đầu tiên
  if (!sheet) return;

  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return;

  // Cột D (index 3): Cán bộ phụ trách
  // Cột E (index 4): Người theo dõi
  // Cột F (index 5): Thời hạn hoàn thành
  // Tạo map id -> task
  var taskMap = {};
  data.tasks.forEach(function(t) {
    if (t.stt) taskMap[String(t.stt).trim()] = t;
    if (t.id) taskMap[String(t.id).trim()] = t;
  });

  for (var r = 1; r < values.length; r++) {
    var stt = String(values[r][0] || '').trim();
    var task = taskMap[stt];
    if (task) {
      if (task.assignee_text) {
        sheet.getRange(r + 1, 4).setValue(task.assignee_text);
      }
      if (task.follower_text) {
        sheet.getRange(r + 1, 5).setValue(task.follower_text);
      }
      if (task.deadline) {
        sheet.getRange(r + 1, 6).setValue(task.deadline);
      }
    }
  }
}

/**
 * Tạo output hỗ trợ JSON hoặc JSONP (tránh chặn CORS)
 */
function createOutput(dataObj, e) {
  var jsonStr = JSON.stringify(dataObj);
  var callback = e && e.parameter && e.parameter.callback;

  if (callback) {
    return ContentService.createTextOutput(callback + '(' + jsonStr + ')')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  } else {
    return ContentService.createTextOutput(jsonStr)
      .setMimeType(ContentService.MimeType.JSON);
  }
}
