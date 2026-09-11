# Quản Lý & Phân Công Công Việc - Phòng Kế Hoạch Vật Tư (PC Vũng Tàu)

Hệ thống quản lý, phân công và điều phối công việc trực quan dạng kéo thả dành cho Ban Giám đốc và Trưởng phòng Kế hoạch Vật tư - Công ty Điện lực Vũng Tàu (EVNHCMC).

- **Website trực tuyến**: [https://khvtpcvt-phanviec.vercel.app](https://khvtpcvt-phanviec.vercel.app)
- **Kho mã nguồn GitHub**: [https://github.com/trantanphata5-source/khvtpcvt-phanviec](https://github.com/trantanphata5-source/khvtpcvt-phanviec)
- **Cơ sở dữ liệu đám mây**: Tự động đồng bộ thời gian thực 2 chiều qua máy chủ EVNHCMC

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

## 🚀 Cơ Chế Đồng Bộ Máy Chủ & Google Sheet (Tab "Phân công trực tuyến")

Ứng dụng web đã được tích hợp sẵn đường dẫn kết nối máy chủ Google Apps Script chính thức của phòng.

- **Không làm ảnh hưởng sheet gốc**: Khi có dữ liệu phân công mới từ web, script sẽ tự động ghi sang một sheet riêng biệt mang tên **`Phân công trực tuyến`** với đầy đủ định dạng cột, màu sắc EVN chuẩn và thời gian cập nhật. Bảng công việc gốc ban đầu được **bảo toàn nguyên vẹn 100%**, không bị xáo trộn thứ tự.
- **Tự động đồng bộ**: Mọi cán bộ nhân viên khi truy cập trang web [https://khvtpcvt-phanviec.vercel.app](https://khvtpcvt-phanviec.vercel.app) đều tự động nhận dữ liệu mới nhất mà không cần cài đặt thêm bất kỳ thông số nào.

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
