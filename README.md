# DreamGuard Mobile

Ứng dụng di động dành cho nhân viên hiện trường theo dõi và xử lý công việc dịch vụ. App được xây dựng bằng Expo, React Native và TypeScript, tập trung vào các luồng vận hành cơ bản như đăng nhập, xem danh sách task, xem chi tiết công việc, check-in/check-out, tải ảnh minh chứng và theo dõi thông báo.

## Tính năng chính

- Đăng nhập tài khoản nhân viên qua backend.
- Xem danh sách công việc theo trạng thái.
- Xem chi tiết từng công việc.
- Check-in, chuyển trạng thái xử lý, check-out và hoàn tất task.
- Tải ảnh minh chứng cho công việc.
- Xem thông báo và hồ sơ cá nhân.

## Công nghệ sử dụng

- Expo 54
- React Native 0.81
- React 19
- TypeScript
- React Navigation

## Yêu cầu môi trường

Trước khi chạy app, cần cài sẵn:

- Node.js 18 trở lên
- npm hoặc yarn
- Expo Go trên điện thoại, hoặc Android Studio / Xcode simulator

Lưu ý:

- Chạy iOS simulator chỉ thực hiện được trên macOS.
- Dự án hiện đang gọi API trực tiếp tới backend tại `https://cohabit.vn`.
- Nếu cần đổi API, sửa hằng số `BASE_URL` trong `src/utils/api.ts`.

## Cài đặt và chạy dự án

### 1. Cài dependency

```bash
npm install
```

### 2. Khởi động Metro / Expo

```bash
npm start
```

Sau khi chạy lệnh trên, Expo DevTools sẽ hiện mã QR để mở app bằng Expo Go.

### 3. Chạy theo nền tảng

Android:

```bash
npm run android
```

iOS:

```bash
npm run ios
```

Web:

```bash
npm run web
```

## Cách sử dụng app

### 1. Đăng nhập

- Mở app.
- Nhập số điện thoại và mật khẩu nhân viên.
- Sau khi đăng nhập thành công, app sẽ chuyển vào màn hình chính.

account test role staff cleaning
sđt: 0931309408
mk: Staff@123

### 2. Xem danh sách công việc

- Vào tab công việc để xem các task được giao.
- Có thể lọc task theo trạng thái như pending, checked in, in progress, checked out, completed.
- Nhấn vào từng task để xem chi tiết.

### 3. Xử lý công việc

Trong màn hình chi tiết task, người dùng có thể thực hiện luồng cơ bản:

1. Check-in khi bắt đầu tới điểm làm việc.
2. Chuyển sang trạng thái đang xử lý.
3. Tải ảnh minh chứng nếu cần.
4. Check-out khi hoàn thành tại hiện trường.
5. Hoàn tất công việc.

### 4. Theo dõi thông tin liên quan

- Tab thông báo: xem các cập nhật liên quan tới công việc.
- Tab hồ sơ: xem thông tin nhân viên.

## Cấu trúc thư mục chính

```text
src/
  components/     # UI component dùng lại
  constants/      # màu sắc, spacing, typography, theme
  context/        # AuthContext, TaskContext
  hooks/          # custom hooks
  navigation/     # điều hướng app
  screens/        # các màn hình chính
  services/       # service gọi nghiệp vụ
  types/          # định nghĩa type/interface
  utils/          # helper và API layer
```

## Ghi chú

- App hiện dùng backend thật, không phải mock hoàn toàn.
- Một số chức năng phụ thuộc dữ liệu backend như đăng nhập, task list, trạng thái task, rating và ảnh minh chứng.
- Nếu gặp lỗi mạng hoặc không đăng nhập được, cần kiểm tra lại API và tài khoản backend trước.