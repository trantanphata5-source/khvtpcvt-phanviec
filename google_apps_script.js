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

    // BẢO VỆ DỮ LIỆU: Chỉ ghi đè nếu có danh sách tasks hợp lệ
    if (!parsed || !parsed.tasks || !Array.isArray(parsed.tasks) || parsed.tasks.length === 0) {
      return createOutput({ status: 'error', message: 'Dữ liệu không hợp lệ hoặc thiếu danh sách công việc' }, e);
    }

    parsed.lastModified = new Date().toISOString();

    // 1. Lưu siêu tốc vào Script Properties để phục vụ truy xuất tức thì
    var props = PropertiesService.getScriptProperties();
    props.setProperty(STORAGE_PROP_KEY, JSON.stringify(parsed));

    // 2. Đồng bộ ngược lại các hàng trong Google Sheet tab "Phân công trực tuyến"
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
 * Đồng bộ dữ liệu phân công sang một sheet riêng biệt ("Phân công trực tuyến")
 * Giữ nguyên 100% sheet gốc ban đầu, không làm xáo trộn thứ tự hay cấu trúc cũ
 */
function syncToSpreadsheet(data) {
  if (!data || !data.tasks || !Array.isArray(data.tasks)) return;

  var ss = null;
  try {
    ss = SpreadsheetApp.getActiveSpreadsheet();
  } catch (err) {
    ss = null;
  }
  
  // Fallback mở trực tiếp bằng ID nếu script chạy ở ngữ cảnh độc lập
  if (!ss) {
    try {
      ss = SpreadsheetApp.openById('1Pa1titRZwwikbXyBhniHgZr-lX2P5D12jdMUbxHw-ck');
    } catch (openErr) {
      console.warn('Không thể mở Google Sheet qua ID:', openErr);
      return;
    }
  }

  var TARGET_SHEET_NAME = 'Phân công trực tuyến';
  var sheet = ss.getSheetByName(TARGET_SHEET_NAME);
  
  // Nếu chưa có sheet riêng thì tự động tạo mới
  if (!sheet) {
    sheet = ss.insertSheet(TARGET_SHEET_NAME);
  }

  // Tiêu đề các cột
  var headers = [
    'STT / Mã việc',
    'Tên công việc',
    'Nội dung chi tiết',
    'Nhóm loại công việc',
    'Cán bộ phụ trách',
    'Người theo dõi / Chỉ đạo',
    'Thời hạn hoàn thành',
    'Trạng thái',
    'Mức độ ưu tiên',
    'Cập nhật lần cuối'
  ];

  // Chuẩn bị dữ liệu các hàng
  var rows = [];
  var lastMod = data.lastModified ? Utilities.formatDate(new Date(data.lastModified), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss") : Utilities.formatDate(new Date(), "Asia/Ho_Chi_Minh", "dd/MM/yyyy HH:mm:ss");

  data.tasks.forEach(function(t, idx) {
    var statusText = t.status === 'completed' ? '✓ Đã hoàn tất' : '● Đang thực hiện';
    var priorityText = t.priority === 'urgent' ? '🔥 Khẩn cấp' : 'Bình thường';
    var assignee = t.in_staging ? 'Chưa phân công (Danh sách chờ)' : (t.assignee_text || 'Chưa phân công');

    rows.push([
      t.stt || (idx + 1),
      t.title || '',
      t.detail || '',
      t.category || '',
      assignee,
      t.follower_text || '',
      t.deadline || '',
      statusText,
      priorityText,
      lastMod
    ]);
  });

  // Xóa dữ liệu cũ của sheet riêng này và ghi toàn bộ dữ liệu mới cập nhật
  sheet.clearContents();

  // Ghi dòng tiêu đề
  var headerRange = sheet.getRange(1, 1, 1, headers.length);
  headerRange.setValues([headers]);
  headerRange.setBackground('#003399'); // Màu xanh EVN
  headerRange.setFontColor('#ffffff');
  headerRange.setFontWeight('bold');
  headerRange.setHorizontalAlignment('center');
  headerRange.setVerticalAlignment('middle');
  sheet.setRowHeight(1, 36);

  // Ghi các hàng dữ liệu
  if (rows.length > 0) {
    var dataRange = sheet.getRange(2, 1, rows.length, headers.length);
    dataRange.setValues(rows);
    dataRange.setVerticalAlignment('middle');
    dataRange.setWrap(true);

    // Căn giữa cho cột STT, Thời hạn, Trạng thái, Ưu tiên, Ngày giờ
    sheet.getRange(2, 1, rows.length, 1).setHorizontalAlignment('center');
    sheet.getRange(2, 7, rows.length, 4).setHorizontalAlignment('center');
  }

  // Căn chỉnh độ rộng cột cơ bản
  sheet.setColumnWidth(1, 100);  // STT / Mã việc
  sheet.setColumnWidth(2, 280);  // Tên công việc
  sheet.setColumnWidth(3, 380);  // Nội dung chi tiết
  sheet.setColumnWidth(4, 200);  // Nhóm công tác
  sheet.setColumnWidth(5, 200);  // Phụ trách
  sheet.setColumnWidth(6, 180);  // Theo dõi
  sheet.setColumnWidth(7, 130);  // Thời hạn
  sheet.setColumnWidth(8, 130);  // Trạng thái
  sheet.setColumnWidth(9, 120);  // Ưu tiên
  sheet.setColumnWidth(10, 160); // Cập nhật lần cuối

  // Cố định dòng tiêu đề
  sheet.setFrozenRows(1);
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

/**
 * Hàm kiểm tra / tạo sheet ngay lập tức từ trình soạn thảo Apps Script (Tùy chọn)
 * Bạn có thể chọn hàm này trong danh sách hàm trên thanh công cụ và bấm "Chạy" (Run)
 * để tạo và điền ngay sheet "Phân công trực tuyến" mà không cần đợi thao tác từ web.
 */
function testTaoSheetPhanCong() {
  var props = PropertiesService.getScriptProperties();
  var savedJson = props.getProperty(STORAGE_PROP_KEY);
  if (savedJson) {
    var data = JSON.parse(savedJson);
    syncToSpreadsheet(data);
    Logger.log('Đã tạo và cập nhật sheet "Phân công trực tuyến" thành công với ' + (data.tasks ? data.tasks.length : 0) + ' công việc!');
  } else {
    Logger.log('Chưa có dữ liệu trong Script Properties.');
  }
}

