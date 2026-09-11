# Quản Lý & Phân Công Công Việc - Phòng Kế Hoạch Vật Tư (PC Vũng Tàu)

Hệ thống quản lý, phân công và điều phối công việc trực quan dạng kéo thả dành cho Ban Giám đốc và Trưởng phòng Kế hoạch Vật tư - Công ty Điện lực Vũng Tàu (EVNHCMC).

- **Website trực tuyến**: [https://khvtpcvt-phanviec.vercel.app](https://khvtpcvt-phanviec.vercel.app)
- **Kho mã nguồn GitHub**: [https://github.com/trantanphata5-source/khvtpcvt-phanviec](https://github.com/trantanphata5-source/khvtpcvt-phanviec)
- **Google Sheet cơ sở dữ liệu**: [Công tác KHVT (Google Spreadsheet)](https://docs.google.com/spreadsheets/d/1Pa1titRZwwikbXyBhniHgZr-lX2P5D12jdMUbxHw-ck/edit?usp=sharing)

---

## 🌟 Tính Năng Nổi Bật

1. **Phân công dạng Kéo - Thả (Drag & Drop) thông minh**:
   - Dễ dàng kéo công việc thả vào cột từng cán bộ nhân viên hoặc chuyển đổi qua lại giữa các nhóm công việc.
   - Thẻ công việc hiển thị đầy đủ ảnh thẻ nhân sự chính thức, tên việc tóm tắt, thời hạn hoàn thành định dạng chuẩn `14/09/2026`, người chỉ đạo và nhãn ưu tiên.
   - Nút **"📄 Xem chi tiết nội dung"** mở rộng xem nội dung cụ thể, chỉ rõ phần việc của từng người khi công việc có nhiều người phối hợp.

2. **Cơ cấu tổ chức & Nhân sự chuẩn xác (19 CBCNV)**:
   - **Lãnh đạo phòng**: Trưởng phòng & Phó Trưởng phòng.
   - **Tổ Kế hoạch**: Đầy đủ nhân sự phụ trách kế hoạch và ĐTXD, bao gồm nhân sự mới chuyển sang: *Trần Thị Minh Nguyệt*.
   - **Tổ Vật tư**: Đầy đủ nhân sự quản lý vật tư, thiết bị, kho bãi.
   - **Khung riêng biệt cho Đơn vị phối hợp ngoài phòng**: Phân biệt rõ ràng nhân sự phối hợp (như *Nguyễn Đình Hanh*), không xếp chung khối lượng nội bộ phòng.

3. **3 Chế độ hiển thị linh hoạt**:
   - **Xem theo Nhân viên**: Bảng Kanban theo từng cán bộ nhân viên và tổ chuyên môn.
   - **Xem theo Công việc**: Nhóm theo các lĩnh vực công tác, phân tầng rõ ràng cho *IV. Công tác ĐTXD (Năm 2026 và Năm 2027)*.
   - **Tổng quan & Thống kê**: Biểu đồ phân bổ khối lượng, tỷ lệ hoàn thành, cơ cấu công việc trực quan.

4. **Tự động lưu tức thì (Auto-Save) & Đồng bộ thời gian thực (Real-time Cloud Sync)**:
   - **Lưu cục bộ tức thì 100%**: Mọi thao tác kéo thả, thêm mới hay sửa việc đều lưu ngay lập tức vào bộ nhớ máy. Dù vô tình F5, đóng trình duyệt hay mất mạng cũng **không bao giờ bị mất dữ liệu**.
   - **Đồng bộ đa tab (Cross-tab sync)**: Kéo thả ở một tab sẽ tự động cập nhật ngay trên các tab khác đang mở mà không cần tải lại trang.
   - **Đồng bộ đám mây 2 chiều với Google Sheet**: Hỗ trợ kết nối Google Apps Script Web App để đồng bộ dữ liệu thời gian thực giữa mọi máy tính và thiết bị di động của các thành viên.
   - **Chia sẻ đường link thông minh**: Hỗ trợ tham số `?api=...` tự động cấu hình đồng bộ cho người dùng mới chỉ bằng 1 cú click chuột.

---

## 🚀 Hướng Dẫn Kích Hoạt Đồng Bộ 2 Chiều Với Google Sheet (1 Phút)

File Google Sheet: [Công tác KHVT](https://docs.google.com/spreadsheets/d/1Pa1titRZwwikbXyBhniHgZr-lX2P5D12jdMUbxHw-ck/edit?usp=sharing)

1. Mở file Google Sheet trên bằng tài khoản Google của bạn.
2. Trên thanh menu trên cùng, chọn: **Tiện ích mở rộng (Extensions)** &rarr; **Apps Script**.
3. Xóa nội dung mẫu trong file `Code.gs`, mở file [`google_apps_script.js`](./google_apps_script.js) trong kho này và sao chép toàn bộ nội dung dán vào.
4. Nhấn biểu tượng **Lưu** (Ctrl + S).
5. Bấm nút **"Triển khai" (Deploy)** màu xanh ở góc trên bên phải &rarr; chọn **"Triển khai mới" (New deployment)**:
   - **Chọn loại**: *Ứng dụng web (Web app)*.
   - **Mô tả**: `KHVT PCVT Sync Web App`.
   - **Thực thi dưới dạng**: *Tôi (Me - email của bạn)*.
   - **Ai có quyền truy cập**: **Bất kỳ ai (Anyone)** *(Bắt buộc để web app có thể gửi/nhận dữ liệu mà không cần xác thực phức tạp)*.
   - Bấm **Triển khai (Deploy)**.
6. Cấp quyền truy cập cho script (Bấm *Advanced / Nâng cao* &rarr; Chọn *Go to Untitled project (unsafe)* &rarr; Bấm *Allow / Cho phép*).
7. Sao chép **URL của ứng dụng web** (đường link kết thúc bằng `/exec`).
8. Truy cập [https://khvtpcvt-phanviec.vercel.app](https://khvtpcvt-phanviec.vercel.app), bấm vào nút **"☁️ Tự động lưu / Đồng bộ Cloud"** trên thanh tiêu đề, dán URL vào và bấm **"💾 Lưu thiết lập"**.
9. Lúc này, bạn có thể gửi liên kết dạng:
   ```
   https://khvtpcvt-phanviec.vercel.app/?api=URL_APPS_SCRIPT_CỦA_BẠN
   ```
   cho các thành viên khác, mọi người khi mở liên kết sẽ tự động kết nối và đồng bộ thời gian thực ngay lập tức!

---

## 📂 Cấu Trúc Dự Án

```
khvtpcvt-phanviec/
├── index.html              # Giao diện chính của ứng dụng web
├── style.css               # Hệ thống thiết kế màu sắc EVN, Kanban board & Responsive
├── app.js                  # Toàn bộ logic ứng dụng, kéo thả, auto-save & real-time sync
├── app_data.js             # Dữ liệu nhân sự KHVT & 35 công việc ban đầu
├── google_apps_script.js   # Script backend triển khai lên Google Sheet
├── photos/                 # Thư mục ảnh thẻ CBCNV phòng KHVT (emp_*.jpg)
├── logo.jpg                # Logo EVNHCMC
├── logo_evn.png            # Logo hiển thị trên thanh header
├── vercel.json             # File cấu hình deploy tự động lên Vercel
└── README.md               # Tài liệu hướng dẫn sử dụng và triển khai
```

---

## 💻 Triển khai lên Vercel

Dự án đã được cấu hình sẵn với `vercel.json`:
- **Vercel Project Name**: `khvtpcvt-phanviec`
- **Tự động deploy qua Git**: Mỗi commit được push lên nhánh `main` của repo `https://github.com/trantanphata5-source/khvtpcvt-phanviec` sẽ được Vercel tự động build và deploy lên `https://khvtpcvt-phanviec.vercel.app`.
