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
 *    Mặc định webapp này sẽ đọc và ghi dữ liệu tại node: /run
 *    
 *    Cấu trúc trên Firebase Console sẽ trông như sau:
 *    your-project-id-default-rtdb
 *    └── run
 *        ├── state: "0"  (hoặc "1")
 *        ├── ip: "192.168.1.1"
 *        └── strnote: "Bình thường"
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
const FIREBASE_DATABASE_URL = "https://mycardoor-fa2df.firebaseio.com";

// Tự động tạo URL truy cập qua REST API
// Chú ý: .json là bắt buộc khi dùng Firebase REST API
const RUN_ENDPOINT = `${FIREBASE_DATABASE_URL}/run.json`;

// DOM Elements
const statusText = document.getElementById('status-text');
const statusIndicator = document.getElementById('status-indicator');
const btnOpen = document.getElementById('btn-open');
const btnClose = document.getElementById('btn-close');
const infoIp = document.getElementById('info-ip');
const infoStrnote = document.getElementById('info-strnote');

// Trạng thái hiện tại
let currentStatus = null;

/**
 * Cập nhật giao diện theo trạng thái
 */
function updateUI(status) {
    currentStatus = status;

    if (status === '1') {
        statusText.textContent = 'Cửa đang mở';
        statusText.className = 'status-text open';
        statusIndicator.className = 'status-indicator open';
    } else if (status === '0') {
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

        const note = status === '1' ? 'Đã_Mở_Cửa' : 'Đã_Đóng_Cửa';

        // Ghi cả state và strnote bằng PATCH (cập nhật từng phần)
        const response = await fetch(`${FIREBASE_DATABASE_URL}/run.json`, {
            method: 'PATCH',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                state: status,
                strnote: note
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        updateUI(status);
        infoStrnote.textContent = `Trạng thái: ${note}`;

        // Load lại biến /run/ip và /run/strnote
        const getRes = await fetch(`${FIREBASE_DATABASE_URL}/run.json`);
        if (getRes.ok) {
            const data = await getRes.json();
            if (data) {
                if (data.ip) infoIp.textContent = `IP: ${data.ip}`;
                if (data.strnote) infoStrnote.textContent = `Trạng thái: ${data.strnote}`;
            }
        }

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
btnOpen.addEventListener('click', () => setDoorStatus('1'));
btnClose.addEventListener('click', () => setDoorStatus('0'));

/**
 * Lắng nghe thay đổi dữ liệu Realtime sử dụng Server-Sent Events (SSE)
 * Firebase hỗ trợ trực tiếp SSE thông qua Header "Accept: text/event-stream"
 * Trình duyệt xử lý bằng EventSource.
 */
function listenForRealtimeUpdates() {
    // Tránh lỗi nếu URL chưa thay đổi từ mẫu
    if (FIREBASE_DATABASE_URL.includes("your-project-id")) {
        console.warn("VUI LÒNG THAY ĐỔI FIREBASE_DATABASE_URL ĐỂ ỨNG DỤNG HOẠT ĐỘNG THỰC TẾ.");
        updateUI('0'); // Mock trạng thái ban đầu
        return;
    }

    const eventSource = new EventSource(RUN_ENDPOINT);

    eventSource.onopen = () => {
        console.log("Đã kết nối luồng Realtime (SSE) tới Firebase thành công.");
    };

    const handleData = (e) => {
        try {
            const data = JSON.parse(e.data);
            console.log("Dữ liệu realtime thay đổi:", data);

            if (data && data.data !== undefined && data.data !== null) {
                if (data.path === '/') {
                    if (data.data.state !== undefined) updateUI(data.data.state);
                    if (data.data.ip !== undefined) infoIp.textContent = `IP: ${data.data.ip}`;
                    if (data.data.strnote !== undefined) infoStrnote.textContent = `Trạng thái: ${data.data.strnote}`;
                } else if (data.path === '/state') {
                    updateUI(data.data);
                } else if (data.path === '/ip') {
                    infoIp.textContent = `IP: ${data.data}`;
                } else if (data.path === '/strnote') {
                    infoStrnote.textContent = `Trạng thái: ${data.data}`;
                }
            } else if (data.data === null) {
                if (data.path === '/') {
                    updateUI('0');
                    infoIp.textContent = 'IP: --';
                    infoStrnote.textContent = 'Trạng thái: --';
                }
            }
        } catch (err) {
            console.error("Lỗi khi parse dữ liệu realtime:", err);
        }
    };

    // Firebase REST SSE sử dụng event 'put' hoặc 'patch' khi có thay đổi dữ liệu
    eventSource.addEventListener('put', handleData);
    eventSource.addEventListener('patch', handleData);

    eventSource.onerror = (error) => {
        console.error("Lỗi kết nối Realtime (EventSource):", error);
        // Trình duyệt sẽ tự động thử kết nối lại (auto reconnect)
    };
}

// Khởi chạy ứng dụng
document.addEventListener('DOMContentLoaded', () => {
    listenForRealtimeUpdates();
});
