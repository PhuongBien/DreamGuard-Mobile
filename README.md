# 🛏️ KBS Staff App — Tài liệu kỹ thuật

> Ứng dụng nội bộ dành cho nhân viên hệ thống KBS (Chăn Ga Gối Trẻ Em)  
> React Native + TypeScript | Demo Version 1.0.0

---

## 📁 Cấu trúc dự án

```
KBS-Staff-App/
├── App.tsx                          # Root component + navigation router
├── package.json                     # Dependencies
├── tsconfig.json                    # TypeScript config
└── src/
    ├── types/
    │   └── index.ts                 # Tất cả TypeScript types/interfaces
    ├── constants/
    │   └── theme.ts                 # Colors, Typography, Spacing, TaskTypeConfig
    ├── utils/
    │   ├── api.ts                   # 📌 API service layer (tất cả endpoints)
    │   └── mockData.ts              # Mock data cho demo
    ├── hooks/
    │   └── useAuth.tsx              # Auth Context + useAuth hook
    ├── components/
    │   └── shared.tsx               # Reusable UI components
    └── screens/
        ├── LoginScreen.tsx          # Màn hình đăng nhập
        ├── TaskListScreen.tsx       # Danh sách nhiệm vụ
        ├── TaskDetailScreen.tsx     # Chi tiết nhiệm vụ (tabs)
        ├── CheckInOutScreen.tsx     # Check-in / Check-out
        ├── NotificationsScreen.tsx  # Thông báo
        └── ProfileScreen.tsx        # Hồ sơ nhân viên
```

---

## 🎨 Thiết kế UI

### Bảng màu KBS
| Tên         | Hex       | Dùng cho                    |
|-------------|-----------|------------------------------|
| `primary100`| `#BDE8F5` | Nền nhạt, badge info         |
| `primary500`| `#4988C4` | Nút phụ, icon accent         |
| `primary700`| `#1C4D8D` | Nút chính, label active      |
| `primary900`| `#0F2854` | Header, navbar               |

---

## 🔐 Luồng Authentication

```
LoginScreen
    │
    ├─ POST /auth/login ──→ { token, user }
    │                             │
    │                    setAuthToken(token)
    │                    setUser(user)
    │
    └──→ MainApp (Tab Navigator)
              ├─ Tasks
              ├─ Notifications
              └─ Profile
```

### Demo credentials (không cần backend):
| Email                  | Password  | Vai trò              |
|------------------------|-----------|----------------------|
| an.nguyen@kbs.vn       | demo123   | Nhân viên giao hàng  |
| bich.tran@kbs.vn       | demo123   | Nhân viên vệ sinh    |
| minh.le@kbs.vn         | demo123   | Quản lý              |
| lan.pham@kbs.vn        | demo123   | Nhân viên kho        |

---

## 📌 Danh sách Backend APIs cần triển khai

### BASE URL
```
https://api.kbs.vn/staff/v1
```

### Authentication Header
```
Authorization: Bearer <JWT_TOKEN>
```

---

### 🔑 AUTH

#### POST /auth/login
```json
// Request Body
{
  "email": "string",
  "password": "string"
}
// Response
{
  "success": true,
  "data": {
    "token": "JWT string",
    "refreshToken": "string",
    "expiresIn": 86400,
    "user": { /* User object */ }
  }
}
```

#### POST /auth/logout
```
Header: Authorization Bearer <token>
Response: { "success": true }
```

#### POST /auth/refresh
```json
// Body: { "refreshToken": "string" }
// Response: { "token": "string", "expiresIn": 86400 }
```

#### GET /auth/me
```
Response: User object (same as login user field)
```

---

### 📋 TASKS

#### GET /tasks
```
Query params:
  page        (default: 1)
  pageSize    (default: 20)
  status      (pending | in_progress | completed | cancelled | on_hold)
  date        (ISO date: 2025-01-15)
  search      (string: search by title, code, customer name)

⚠️ Backend nên tự động lọc theo user đang đăng nhập (từ token)
   Chỉ trả về tasks được assign cho user đó.

Response:
{
  "success": true,
  "data": {
    "items": [ Task[] ],
    "total": 50,
    "page": 1,
    "pageSize": 20,
    "totalPages": 3
  }
}
```

#### GET /tasks/:taskId
```
Response: Task object (đầy đủ thông tin)
```

#### PATCH /tasks/:taskId/status
```json
// Body
{
  "status": "in_progress | completed | cancelled | on_hold | pending",
  "note": "optional note string"
}
// Response: Task object (updated)
```

#### POST /tasks/:taskId/notes
```json
// Body: { "content": "string" }
// Response: Task object with new note appended
```

---

### 📸 PHOTOS

#### POST /tasks/:taskId/photos
```
Content-Type: multipart/form-data
Fields:
  photo  (file) — image file (JPEG/PNG)
  type   (string) — "before" | "after" | "evidence"

Response: Task object (updated with new photo)
```

#### DELETE /tasks/:taskId/photos/:photoId
```
Response: Task object (updated)
```

---

### 📍 CHECK-IN / CHECK-OUT

#### POST /tasks/:taskId/checkin
```json
// Body (tất cả optional)
{
  "latitude": 10.762622,
  "longitude": 106.660172,
  "address": "123 Nguyễn Huệ, Q1, TPHCM"
}
// Response: Task object (status → in_progress, checkIn time set)
// Tự động set task status = "in_progress" nếu đang "pending"
```

#### POST /tasks/:taskId/checkout
```json
// Body
{
  "latitude": 10.762622,
  "longitude": 106.660172,
  "address": "string",
  "completionNote": "optional string"
}
// Response: Task object (status → completed, checkOut time set)
```

---

### 🔔 NOTIFICATIONS

#### GET /notifications
```
Query: page, pageSize, isRead (true|false|all)
Response: PaginatedResponse<Notification>
```

#### PATCH /notifications/:notificationId/read
```
Response: { "success": true }
```

#### PATCH /notifications/read-all
```
Response: { "success": true }
```

#### GET /notifications/unread-count
```
Response: { "count": 3 }
```

---

### 📱 PUSH NOTIFICATIONS

#### POST /devices/register
```json
// Body
{
  "token": "FCM_or_APNS_device_token",
  "platform": "android | ios"
}
// Response: { "success": true }
// Gọi sau khi đăng nhập thành công để đăng ký push notification
```

**Khuyến nghị:** Dùng Firebase Cloud Messaging (FCM) cho cả Android và iOS.

---

### 🗓️ SCHEDULE

#### GET /tasks/schedule
```
Query:
  startDate  (ISO: 2025-01-13)
  endDate    (ISO: 2025-01-19)

Response: Task[] (tasks trong khoảng ngày của user)
```

---

## 🗂️ Data Models

### User
```typescript
{
  id:           string
  name:         string
  email:        string
  phone:        string
  role:         'delivery_driver' | 'cleaner' | 'sales_staff' | 'warehouse_staff' | 'technician' | 'manager'
  avatar?:      string (URL)
  department:   string
  employeeCode: string
}
```

### Task
```typescript
{
  id:            string
  taskCode:      string          // e.g. "KBS-2025-001"
  title:         string
  description:   string
  type:          TaskType        // delivery|pickup|cleaning|repair|trade_in|exchange|custom_order|warehouse_inbound|warehouse_outbound|sales_consultation
  status:        TaskStatus      // pending|in_progress|completed|cancelled|on_hold
  priority:      TaskPriority    // low|medium|high|urgent
  assignedTo:    string          // User.id
  assignedToName: string
  createdAt:     string          // ISO datetime
  updatedAt:     string
  dueDate:       string          // ISO date
  dueTime?:      string          // "HH:MM"
  customer:      CustomerInfo
  products:      ProductItem[]
  photos:        TaskPhoto[]
  notes:         TaskNote[]
  checkInOut:    CheckInOut
  estimatedDuration?: number    // minutes
  serviceAddress?:    string
  orderRef?:          string    // Mã đơn từ website
  tags?:              string[]
}
```

---

## 🚀 Hướng dẫn cài đặt & chạy demo

```bash
# 1. Clone & install
cd dreamGuard-mobile-new
npm install

# 2. Chạy với Expo
npx expo start

# 3. Scan QR bằng Expo Go app trên điện thoại
#    hoặc nhấn 'a' để chạy Android emulator, 'i' cho iOS simulator
```

### Chạy chế độ demo (không cần backend)
App đã được tích hợp mock data hoàn chỉnh.  
Chỉ cần đăng nhập với một trong các tài khoản demo phía trên.

### Kết nối backend thực
1. Mở `src/utils/api.ts`
2. Thay đổi `BASE_URL`:
   ```typescript
   const BASE_URL = 'https://api.kbs.vn/staff/v1';
   // → 'https://your-backend.com/staff/v1'
   ```
3. Trong `src/hooks/useAuth.tsx`, thay khối "DEMO MODE" bằng:
   ```typescript
   const res = await authLogin({ email, password });
   const { token, user } = res.data;
   ```

---

## 📦 Dependencies quan trọng

| Package                         | Mục đích                            |
|---------------------------------|-------------------------------------|
| `expo-image-picker`             | Chọn ảnh từ thư viện hoặc camera    |
| `expo-camera`                   | Chụp ảnh trực tiếp                  |
| `expo-location`                 | Lấy GPS cho check-in/out            |
| `expo-notifications`            | Push notifications                  |
| `expo-secure-store`             | Lưu token an toàn (thay AsyncStorage)|
| `@react-navigation/*`           | Navigation (nếu mở rộng)            |

---

## 🔮 Phát triển tiếp theo (Phase 2) neesu làm kịp

- [ ] Tích hợp GPS thực với `expo-location`
- [ ] Push notification realtime qua FCM
- [ ] Offline mode với sync khi có mạng
- [ ] Lịch trình dạng calendar view  
- [ ] Report / thống kê cho manager
- [ ] Chat nội bộ giữa nhân viên
- [ ] Scan QR code đơn hàng
- [ ] Digital signature xác nhận giao hàng
- [ ] Dark mode

---

*KBS Staff App v1.0 — Tài liệu nội bộ*
