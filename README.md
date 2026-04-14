# 3D Glass Effects

Trang web tĩnh dùng camera + MediaPipe Hands để tạo hiệu ứng kính 3D theo gesture tay.

## Chạy cục bộ

Vì camera thường không hoạt động trên `file://`, hãy chạy qua local server:

```powershell
cd E:\DEMO-0
python -m http.server 8080
```

Sau đó mở:

`http://localhost:8080`

## Gesture hỗ trợ

- `Tam giác`: cái + trỏ + giữa
- `Ngôi sao`: dấu peace một tay
- `Tứ giác 3D`: hai tay kiểu L-Frame
- `Ellipse kéo dãn`: hai tay cái + trỏ + út

## Điều khiển

- `Space`: chụp ảnh PNG
- `Esc`: xóa khung đã khóa
- Giữ gesture ổn định khoảng `0.9s` để khóa hiệu ứng
