/* CVHT Hub — Config
 * mode: 'local'  → localStorage (mỗi máy riêng)
 * mode: 'sheets' → Google Apps Script Web App + Spreadsheet (data dùng chung trên GitHub Pages)
 *
 * Setup nhanh:
 *  1. Spreadsheet → Apps Script → dán sheets/Code.gs.txt → chạy setupSheets()
 *  2. Deploy Web app (Anyone) → dán URL vào sheetsWebAppUrl
 *  3. mode: 'sheets' → push code lên GitHub
 *  4. QLĐT → Google Sheets → Đẩy lên Sheets (lần đầu)
 */
const APP_CONFIG = {
  appName: 'CVHT Hub',
  orgName: 'Rikkei Education',
  semesterDefault: '2025-HK2',
  timezone: 'Asia/Ho_Chi_Minh',
  reportDeadline: { day: 5, hour: 23, minute: 0 },
  mode: 'sheets', // đổi thành 'sheets' khi đã có Web App URL
  sheetsWebAppUrl: 'https://script.google.com/macros/s/AKfycbxTLwExwjNxwsoBBmR150shsbZeoxZRMtbXBh7u-kUUVjCfvTqGFHEsL6jaewLl7_6d/exec', // ví dụ: 'https://script.google.com/macros/s/XXXX/exec'
  sheetsApiKey: '', // optional — bật check trong Code.gs nếu cần
  version: '4.3.0',
};
