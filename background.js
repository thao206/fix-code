/**
 * background.js - Service worker for "Auto Giải Bài Tập LMS-ICTU"
 * 
 * Xử lý các tác vụ nền của extension, nhận và gửi tin nhắn giữa tab với popup
 */

// Lắng nghe khi extension được cài đặt hoặc cập nhật
chrome.runtime.onInstalled.addListener((details) => {
  console.log('Extension installed or updated:', details.reason);
  
  // Khởi tạo cài đặt mặc định
  chrome.storage.local.get(['autoFillEnabled'], (result) => {
    if (result.autoFillEnabled === undefined) {
      chrome.storage.local.set({ autoFillEnabled: false });
    }
  });
});

// Lắng nghe tin nhắn từ content script hoặc popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "checkForQuestions") {
    // Gửi thông báo đến popup để kích hoạt chức năng giải bài tập
    chrome.runtime.sendMessage({ action: "triggerSolve" });
    return true;
  }
  
  // Xử lý yêu cầu lấy user name từ popup
  if (message.action === "getUserName") {
    // Tìm tab đang hoạt động
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length > 0) {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id },
          function: () => {
            const nameElement = document.querySelector('h6.ng-tns-c1366681314-11');
            return nameElement ? nameElement.textContent.trim() : '';
          }
        }, (results) => {
          if (chrome.runtime.lastError) {
            sendResponse({ error: chrome.runtime.lastError });
          } else if (results && results[0]) {
            sendResponse({ userName: results[0].result });
          } else {
            sendResponse({ userName: '' });
          }
        });
      } else {
        sendResponse({ error: 'No active tab found' });
      }
      return true; // Giữ kết nối mở cho sendResponse bất đồng bộ
    });
    return true;
  }
  
  // Khi nhận được tin nhắn từ content script về việc đã tìm thấy trang bài tập
  if (message.action === "foundQuestionPage") {
    // Kiểm tra xem popup có đang mở không
    chrome.action.getPopup({}, (popupUrl) => {
      if (!popupUrl || popupUrl === '') {
        // Nếu popup không mở, hiển thị badge thông báo
        chrome.action.setBadgeText({ text: "!" });
        chrome.action.setBadgeBackgroundColor({ color: "#FF0000" });
        
        // Xóa badge sau 3 giây
        setTimeout(() => {
          chrome.action.setBadgeText({ text: "" });
        }, 3000);
      }
    });
  }
});

// Lắng nghe sự kiện khi người dùng nhấp vào icon extension
chrome.action.onClicked.addListener((tab) => {
  // Xóa badge khi người dùng nhấp vào extension
  chrome.action.setBadgeText({ text: "" });
});
