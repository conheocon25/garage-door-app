/* app.js */

/**
 * ==========================================
 * HƯỚNG DẪN CẤU HÌNH FIREBASE REALTIME DATABASE
 * ==========================================
 * 
 * 1. Thay đổi biến FIREBASE_DATABASE_URL thành URL Realtime Database của bạn.
 *    Ví dụ: "https://my-smart-home-default-rtdb.firebaseio.com"
 * 
 * 2. Cấu trúc dữ liệu trên Firebase Realtime Database:
 *    Mặc định webapp này sẽ đọc và ghi dữ liệu tại node: /garageDoor/status
 *    
 *    Cấu trúc trên Firebase Console sẽ trông như sau:
 *    your-project-id-default-rtdb
 *    └── garageDoor
 *        └── status: "closed"  (hoặc "open")
 * 
 * 3. Quy tắc bảo mật (Security Rules) trên Firebase Console:
 *    Để test nhanh, bạn có thể set Rules thành public:
 *    {
 *      "rules": {
 *        ".read": "true",
 *        ".write": "true"
 *      }
 *    }
 *    LƯU Ý: Đây là cấu hình cho mục đích thử nghiệm. 
 *    Trong thực tế, bạn nên thiết lập rule xác thực đàng hoàng.
 * 
 * ==========================================
 */

// 1. CẤU HÌNH URL FIREBASE
const FIREBASE_DATABASE_URL = "https://myautodoorgaracar-default-rtdb.firebaseio.com";

// Tự động tạo URL truy cập qua REST API
// Chú ý: .json là bắt buộc khi dùng Firebase REST API
const STATUS_ENDPOINT = `${FIREBASE_DATABASE_URL}/garageDoor/status.json`;

// DOM Elements
const statusText = document.getElementById('status-text');
const statusIndicator = document.getElementById('status-indicator');
const btnOpen = document.getElementById('btn-open');
const btnClose = document.getElementById('btn-close');

// Trạng thái hiện tại
let currentStatus = null;

/**
 * Cập nhật giao diện theo trạng thái
 */
function updateUI(status) {
    currentStatus = status;

    if (status === 'open') {
        statusText.textContent = 'Cửa đang mở';
        statusText.className = 'status-text open';
        statusIndicator.className = 'status-indicator open';
    } else if (status === 'closed') {
        statusText.textContent = 'Cửa đang đóng';
        statusText.className = 'status-text closed';
        statusIndicator.className = 'status-indicator closed';
    } else {
        statusText.textContent = 'Trạng thái không xác định';
        statusText.className = 'status-text';
        statusIndicator.className = 'status-indicator';
    }
}

/**
 * Gọi REST API ghi dữ liệu lên Firebase (PUT request)
 */
async function setDoorStatus(status) {
    // Ngăn spam nút bấm
    if (currentStatus === status) return;

    try {
        // Khóa nút trong lúc chờ phản hồi
        btnOpen.disabled = true;
        btnClose.disabled = true;

        const response = await fetch(STATUS_ENDPOINT, {
            method: 'PUT', // Dùng PUT để ghi đè giá trị tại đích
            headers: {
                'Content-Type': 'application/json',
            },
            // Firebase REST yêu cầu body là chuỗi JSON
            body: JSON.stringify(status)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Không cần gọi updateUI(status) ở đây vì 
        // hàm listenForRealtimeUpdates() sẽ tự động bắt sự kiện và cập nhật.
        // Tuy nhiên, có thể cập nhật luôn để phản hồi UI nhanh hơn:
        updateUI(status);

    } catch (error) {
        console.error("Lỗi khi cập nhật trạng thái:", error);
        alert("Không thể kết nối đến Firebase. Vui lòng kiểm tra lại cấu hình FIREBASE_DATABASE_URL.");
    } finally {
        // Mở khóa nút
        btnOpen.disabled = false;
        btnClose.disabled = false;
    }
}

// Gắn sự kiện cho các nút
btnOpen.addEventListener('click', () => setDoorStatus('open'));
btnClose.addEventListener('click', () => setDoorStatus('closed'));

/**
 * Lắng nghe thay đổi dữ liệu Realtime sử dụng Server-Sent Events (SSE)
 * Firebase hỗ trợ trực tiếp SSE thông qua Header "Accept: text/event-stream"
 * Trình duyệt xử lý bằng EventSource.
 */
function listenForRealtimeUpdates() {
    // Tránh lỗi nếu URL chưa thay đổi từ mẫu
    if (FIREBASE_DATABASE_URL.includes("your-project-id")) {
        console.warn("VUI LÒNG THAY ĐỔI FIREBASE_DATABASE_URL ĐỂ ỨNG DỤNG HOẠT ĐỘNG THỰC TẾ.");
        updateUI('closed'); // Mock trạng thái ban đầu
        return;
    }

    const eventSource = new EventSource(STATUS_ENDPOINT);

    eventSource.onopen = () => {
        console.log("Đã kết nối luồng Realtime (SSE) tới Firebase thành công.");
    };

    // Firebase REST SSE sử dụng event 'put' khi có thay đổi dữ liệu
    eventSource.addEventListener('put', (e) => {
        try {
            const data = JSON.parse(e.data);
            console.log("Dữ liệu realtime thay đổi:", data);

            // Firebase trả về { path: "/", data: "open" } 
            // path là / vì ta đang nghe ngay tại node status
            if (data && data.data !== undefined) {
                if (data.path === '/') {
                    updateUI(data.data);
                }
            } else if (data.data === null) {
                // Node chưa tồn tại hoặc bị xóa
                updateUI('closed');
            }
        } catch (err) {
            console.error("Lỗi khi parse dữ liệu realtime:", err);
        }
    });

    eventSource.onerror = (error) => {
        console.error("Lỗi kết nối Realtime (EventSource):", error);
        // Trình duyệt sẽ tự động thử kết nối lại (auto reconnect)
    };
}

// Khởi chạy ứng dụng
document.addEventListener('DOMContentLoaded', () => {
    listenForRealtimeUpdates();
});
