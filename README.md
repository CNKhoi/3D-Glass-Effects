# Glass Motion Lab – bản hoàn chỉnh đã cải tiến

Bộ file này là phiên bản đã làm gọn và hoàn chỉnh hơn từ các file bạn tải lên, giữ luồng camera + gesture + editor, đồng thời bổ sung thêm phần lưu trạng thái và thao tác thực tế hơn.

## Những gì đã cải tiến

- Giữ nguyên luồng camera realtime + MediaPipe Hands.
- Lịch sử ảnh tự lưu trong `localStorage`, reload trang vẫn còn ảnh gần nhất.
- Nhớ lại cấu hình hẹn giờ chụp, bố cục editor và kiểu khung.
- Thêm nút **Nhập ảnh từ máy** để đưa ảnh ngoài vào editor.
- Thêm nút **Xóa ảnh** và **Xóa toàn bộ lịch sử**.
- Nhãn ảnh trong lịch sử rõ ràng hơn theo thời gian chụp.
- Giao diện drawer lịch sử đầy đủ hơn cho desktop và mobile.

## File chính

- `index_improved.html`
- `styles_improved.css`
- `app_improved.js`

Nếu muốn dùng ngay, chỉ cần đổi tên ba file này thành:

- `index.html`
- `styles.css`
- `app.js`

hoặc sửa link trong HTML để trỏ đúng tới file improved.

## Chạy cục bộ

```powershell
cd E:\DEMO-0
python -m http.server 8080
```

Mở:

`http://localhost:8080/index_improved.html`

## Lưu ý

Camera cần chạy trên `http://localhost` hoặc `https`.


## Lưu ý khi deploy GitHub Pages

- File `index.html` phải trỏ đúng tới `./styles.css` và `./app.js`.
- Nếu trang hiện ra chữ thô không có giao diện, thường là do sai tên file CSS/JS hoặc đường dẫn asset.
- Camera chỉ hoạt động khi chạy qua `https` hoặc `localhost`.
