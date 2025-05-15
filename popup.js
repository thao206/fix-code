/**
 * popup.js - Core functionality for CFAFQ (Chrome Extension For Answering FAQs) 
 * Version: 1.0.0
 * Author: Thao Duong
 */

// Global variables
let lastAnswer = null;
let isProcessing = false;
let autoFillEnabled = false;
let autoSubmitEnabled = false;
let userName = '';
// Security enhancement for API key with simple encoding
const encodedApiKey = btoa("AIzaSyB1l_-9hjEHjWpTGZkhIQMf8W6Y81Cbvjw".split('').reverse().join(''));

// DOM elements cache
const dom = {
    // Main sections
    resultContainer: document.getElementById('result-container'),
    resultContent: document.getElementById('result-content'),
    historyContainer: document.getElementById('history-container'),
    historyItems: document.getElementById('history-items'),
    statsContainer: document.getElementById('stats-container'),
    
    // Action buttons
    solveButton: document.getElementById('solve-button'),
    copyButton: document.getElementById('copy-button'),
    shareButton: document.getElementById('share-button'),
    
    // Toggle options
    autoFillToggle: document.getElementById('auto-fill-toggle'),
    autoSubmitToggle: document.getElementById('auto-submit-toggle'),
    
    // User info
    userDisplay: document.getElementById('user-display'),
    
    // Statistics elements
    solvedCount: document.getElementById('solved-count'),
    averageTime: document.getElementById('average-time'),
    accuracy: document.getElementById('accuracy-rate'),
    
    // UI feedback elements
    loadingSpinner: document.getElementById('loading-spinner'),
    loadingText: document.getElementById('loading-text'),
    errorMessage: document.getElementById('error-message'),
    
    // Tabs
    resultTab: document.getElementById('result-tab'),
    historyTab: document.getElementById('history-tab'),
    statsTab: document.getElementById('stats-tab'),
    
    // Modals
    settingsModal: document.getElementById('settings-modal'),
    helpModal: document.getElementById('help-modal'),
    shareModal: document.getElementById('share-modal')
};

/**
 * Event Listeners and Initialization
 */
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Initialize settings and UI
        await initializeApp();
        
        // Set up event listeners for main actions
        if (dom.solveButton) dom.solveButton.addEventListener('click', solveQuestion);
        if (dom.copyButton) dom.copyButton.addEventListener('click', copyAnswerToClipboard);
        if (dom.shareButton) dom.shareButton.addEventListener('click', shareAnswer);
        
        // Set up toggle listeners
        if (dom.autoFillToggle) dom.autoFillToggle.addEventListener('change', handleAutoFillToggle);
        if (dom.autoSubmitToggle) dom.autoSubmitToggle.addEventListener('change', handleAutoSubmitToggle);
        
        // Tab navigation
        setupTabNavigation();
        
        // Settings and modals
        setupModalControls();
        
        // Listen for keyboard shortcuts
        document.addEventListener('keydown', handleKeyboardShortcuts);
        
        // Listen for background messages
        chrome.runtime.onMessage.addListener(handleBackgroundMessages);
    } catch (error) {
        console.error("Initialization error:", error);
        showError("Không thể khởi tạo extension. Vui lòng tải lại.");
    }
});

/**
 * Initialize app data and UI
 */
async function initializeApp() {
    // Load saved data
    await loadSavedData();
    
    // Update interface based on loaded data
    updateInterface();
    
    // Get user info
    await fetchAndDisplayUserInfo();
    
    // Load statistics
    loadStatistics();
    
    // Load history items
    loadHistoryItems();
    
    // Show default tab
    showTab('result');
}

/**
 * Load data from chrome storage
 */
async function loadSavedData() {
    return new Promise((resolve) => {
        chrome.storage.local.get([
            'lastAnswer', 
            'autoFillEnabled', 
            'autoSubmitEnabled', 
            'userName', 
            'settings'
        ], (result) => {
            // Load answer history
            if (result.lastAnswer) {
                lastAnswer = result.lastAnswer;
            }
            
            // Load toggle states
            autoFillEnabled = result.autoFillEnabled === true;
            autoSubmitEnabled = result.autoSubmitEnabled === true;
            
            // Load user data
            if (result.userName) {
                userName = result.userName;
            }
            
            // Load and apply settings
            if (result.settings) {
                applySettings(result.settings);
            }
            
            resolve();
        });
    });
}

/**
 * Apply settings to the UI
 */
function applySettings(settings) {
    // Apply dark mode if enabled
    if (settings.darkMode) {
        document.body.classList.add('dark-mode');
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        if (darkModeToggle) darkModeToggle.checked = true;
    }
    
    // Apply font size
    if (settings.fontSize) {
        document.body.classList.remove('font-small', 'font-medium', 'font-large');
        document.body.classList.add(`font-${settings.fontSize}`);
        const fontSizeSelect = document.getElementById('font-size-select');
        if (fontSizeSelect) fontSizeSelect.value = settings.fontSize;
    }
    
    // Apply custom API key
    if (settings.apiKey) {
        const apiKeyInput = document.getElementById('api-key-input');
        if (apiKeyInput) apiKeyInput.value = settings.apiKey;
    }
}

/**
 * Update the interface with saved data
 */
function updateInterface() {
    // Update toggle states
    if (dom.autoFillToggle) dom.autoFillToggle.checked = autoFillEnabled;
    if (dom.autoSubmitToggle) dom.autoSubmitToggle.checked = autoSubmitEnabled;
    
    // Display last answer if available
    if (lastAnswer && dom.resultContent) {
        displayAnswer(lastAnswer);
    }
}

/**
 * Tab Navigation Setup
 */
function setupTabNavigation() {
    const tabs = document.querySelectorAll('.tab-button');
    if (!tabs) return;
    
    tabs.forEach(tab => {
        tab.addEventListener('click', function() {
            const tabId = this.getAttribute('data-tab');
            showTab(tabId);
        });
    });
}

/**
 * Show selected tab and hide others
 */
function showTab(tabId) {
    // Hide all tab contents
    const tabContents = document.querySelectorAll('.tab-content');
    tabContents.forEach(content => {
        content.classList.remove('active');
    });
    
    // Deactivate all tab buttons
    const tabButtons = document.querySelectorAll('.tab-button');
    tabButtons.forEach(button => {
        button.classList.remove('active');
    });
    
    // Show selected tab content
    const selectedContent = document.getElementById(`${tabId}-container`);
    if (selectedContent) {
        selectedContent.classList.add('active');
    }
    
    // Activate selected tab button
    const selectedButton = document.querySelector(`.tab-button[data-tab="${tabId}"]`);
    if (selectedButton) {
        selectedButton.classList.add('active');
    }
    
    // Load data for specific tabs if needed
    if (tabId === 'history') {
        loadHistoryItems();
    } else if (tabId === 'stats') {
        loadStatistics();
    }
}

/**
 * Setup Modal Controls
 */
function setupModalControls() {
    // Settings button
    const settingsBtn = document.getElementById('settings-button');
    if (settingsBtn) {
        settingsBtn.addEventListener('click', () => {
            openModal('settings-modal');
        });
    }
    
    // Help button
    const helpBtn = document.getElementById('help-button');
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            openModal('help-modal');
        });
    }
    
    // Close buttons for all modals
    const closeButtons = document.querySelectorAll('.close-modal');
    closeButtons.forEach(button => {
        button.addEventListener('click', function() {
            const modalId = this.closest('.modal').id;
            closeModal(modalId);
        });
    });
    
    // Save settings button
    const saveSettingsBtn = document.getElementById('save-settings-button');
    if (saveSettingsBtn) {
        saveSettingsBtn.addEventListener('click', saveSettings);
    }
    
    // Close when clicking outside modal content
    const modals = document.querySelectorAll('.modal');
    modals.forEach(modal => {
        modal.addEventListener('click', function(event) {
            if (event.target === this) {
                closeModal(this.id);
            }
        });
    });
}

/**
 * Handle keyboard shortcuts
 */
function handleKeyboardShortcuts(event) {
    // Ctrl/Cmd + Enter to solve
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        solveQuestion();
    }
    
    // Escape to close modals
    if (event.key === 'Escape') {
        const openModal = document.querySelector('.modal.active');
        if (openModal) {
            closeModal(openModal.id);
        }
    }
}

/**
 * Handle messages from background script
 */
function handleBackgroundMessages(request, sender, sendResponse) {
    if (request.action === "triggerSolve") {
        solveQuestion();
    }
    return true;
}

/**
 * Fetch and display user information
 */
async function fetchAndDisplayUserInfo() {
    try {
        // Try to get userName from storage first
        if (!userName) {
            userName = await fetchUserNameFromPage();
            if (userName) {
                chrome.storage.local.set({ userName });
            }
        }
        
        // Update the UI
        if (userName && dom.userDisplay) {
            dom.userDisplay.textContent = userName;
        } else if (dom.userDisplay) {
            dom.userDisplay.textContent = "Người dùng";
        }
    } catch (error) {
        console.error("Couldn't fetch user info:", error);
    }
}

/**
 * Extract user name from the current page
 */
async function fetchUserNameFromPage() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        // Skip if tab doesn't exist or is a chrome:// page
        if (!tab || !tab.id || !tab.url || tab.url.startsWith('chrome://')) {
            return '';
        }
        
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: () => {
                // List of possible selectors containing username
                const selectors = [
                    'h6.ng-tns-c1366681314-11',
                    '.user-name',
                    '.username',
                    '.profile-name',
                    'h6[class*="ng-tns"]'
                ];
                
                for (const selector of selectors) {
                    const element = document.querySelector(selector);
                    if (element && element.textContent.trim()) {
                        return element.textContent.trim();
                    }
                }
                return '';
            }
        });
        
        return (result && result.length > 0 && result[0]?.result) ? result[0].result : '';
    } catch (error) {
        console.error('Error fetching username:', error);
        return '';
    }
}

/**
 * Main function to solve questions
 */
async function solveQuestion() {
    if (isProcessing) return;
    isProcessing = true;
    
    // Update UI for processing state
    updateUIForProcessing(true);
    
    try {
        // Step 1: Capture screenshot of the current page
        showLoadingState("Đang chụp màn hình...");
        const screenshotUrl = await captureScreenshot();
        if (!screenshotUrl) {
            throw new Error("Không thể chụp màn hình. Vui lòng cấp quyền cho extension.");
        }
        
        // Step 2: Prepare and send to AI for analysis
        showLoadingState("Đang phân tích câu hỏi...");
        const base64Image = screenshotUrl.split(',')[1];
        const payload = createAIPayload(base64Image);
        
        // Step 3: Send to AI API
        showLoadingState("Đang xử lý bằng AI...");
        const answer = await callAIAPI(payload);
        if (!answer) {
            throw new Error("Không nhận được kết quả từ AI.");
        }
        
        // Step 4: Process and display results
        hideLoadingState();
        displayAnswer(answer);
        
        // Step 5: Update statistics
        updateStatistics(answer);
        
        // Step 6: Save to history
        saveToHistory(answer);
        
        // Step 7: Auto-fill if enabled
        if (autoFillEnabled) {
            await autoFillAnswer(answer.answerPart);
        }
        
        // Step 8: Auto-submit if enabled
        if (autoSubmitEnabled) {
            await autoSubmitAnswer();
        }
        
        // Show success notification
        showNotification("success", "Đã giải xong bài tập!");
        
    } catch (error) {
        console.error("Solving error:", error);
        showError(error.message);
    } finally {
        // Reset UI state
        updateUIForProcessing(false);
        isProcessing = false;
    }
}

/**
 * Update UI elements when processing starts/ends
 */
function updateUIForProcessing(isStarting) {
    if (!dom.solveButton) return;
    
    if (isStarting) {
        dom.solveButton.disabled = true;
        dom.solveButton.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Đang xử lý...';
    } else {
        dom.solveButton.disabled = false;
        dom.solveButton.innerHTML = '<i class="fas fa-brain"></i> Giải ngay';
    }
}

/**
 * Show loading state with message
 */
function showLoadingState(message = "Đang xử lý...") {
    if (!dom.loadingSpinner || !dom.loadingText) return;
    
    dom.loadingSpinner.style.display = 'block';
    dom.loadingText.textContent = message;
    
    // Hide error message if visible
    if (dom.errorMessage) {
        dom.errorMessage.style.display = 'none';
    }
    
    // Hide result content
    if (dom.resultContent) {
        dom.resultContent.style.display = 'none';
    }
}

/**
 * Hide loading state
 */
function hideLoadingState() {
    if (!dom.loadingSpinner) return;
    
    dom.loadingSpinner.style.display = 'none';
    
    // Show result content
    if (dom.resultContent) {
        dom.resultContent.style.display = 'block';
    }
}

/**
 * Show error message
 */
function showError(message) {
    if (!dom.errorMessage) return;
    
    dom.errorMessage.textContent = message;
    dom.errorMessage.style.display = 'block';
    
    // Hide loading spinner
    hideLoadingState();
}

/**
 * Show notification message
 */
function showNotification(type, message, duration = 3000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    // Animate in
    setTimeout(() => notification.classList.add('show'), 10);
    
    // Remove after duration
    setTimeout(() => {
        notification.classList.remove('show');
        setTimeout(() => document.body.removeChild(notification), 300);
    }, duration);
}

/**
 * Capture screenshot of current tab
 */
async function captureScreenshot() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        
        if (!tab || !tab.id) {
            throw new Error("Không tìm thấy tab hiện tại");
        }
        
        return await chrome.tabs.captureVisibleTab(null, { format: 'png' });
    } catch (error) {
        console.error("Screenshot error:", error);
        throw new Error("Không thể chụp màn hình. Vui lòng cấp quyền cho extension.");
    }
}

/**
 * Create payload for AI API
 */
function createAIPayload(base64Image) {
    return {
        "contents": [{
            "parts": [
                {
                    "text": "Giải bài tập này và cung cấp câu trả lời theo định dạng sau:\n\n" +
                           "[ĐÁP ÁN]\n{đáp án chính xác, bao gồm toàn bộ nội dung}\n\n" +
                           "[GIẢI THÍCH]\n{giải thích ngắn gọn}\n\n" +
                           "[ĐỘ TIN CẬY]\n{ước tính phần trăm chính xác từ 0-100%}"
                },
                {
                    "inline_data": {
                        "mime_type": "image/png",
                        "data": base64Image
                    }
                }
            ]
        }]
    };
}

/**
 * Get API key (custom or default)
 */
async function getApiKey() {
    try {
        const result = await chrome.storage.local.get(['settings']);
        
        if (result.settings && 
            result.settings.apiKey && 
            result.settings.apiKey.trim() !== '') {
            return result.settings.apiKey;
        }
        
        // Use default encoded API key
        return atob(encodedApiKey).split('').reverse().join('');
    } catch (error) {
        console.error("Error getting API key:", error);
        return atob(encodedApiKey).split('').reverse().join('');
    }
}

/**
 * Call AI API with retry logic
 */
async function callAIAPI(payload) {
    const maxAttempts = 3;
    let attempts = 0;
    
    while (attempts < maxAttempts) {
        attempts++;
        try {
            const apiKey = await getApiKey();
            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-04-17:generateContent?key=${apiKey}`;
            
            const response = await fetch(apiUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            
            if (!response.ok) {
                const errorText = await response.text();
                
                // Handle rate limiting with retry
                if (response.status === 429 && attempts < maxAttempts) {
                    await new Promise(r => setTimeout(r, 1500));
                    continue;
                }
                
                throw new Error(`API Error (${response.status}): ${errorText}`);
            }
            
            const data = await response.json();
            
            // Validate response structure
            if (!data.candidates || !data.candidates[0]?.content?.parts) {
                throw new Error("Định dạng phản hồi API không hợp lệ");
            }
            
            const parts = data.candidates[0].content.parts;
            if (!parts || parts.length === 0 || !parts[0].text) {
                throw new Error("Không có nội dung trong phản hồi API");
            }
            
            // Process the response
            return processAIResponse(parts[0].text);
            
        } catch (error) {
            console.error(`API attempt ${attempts} failed:`, error);
            
            if (attempts >= maxAttempts) {
                throw new Error(`Không thể kết nối tới API: ${error.message}`);
            }
            
            // Wait before retrying
            await new Promise(r => setTimeout(r, 1000));
        }
    }
}

/**
 * Process AI response into structured format
 */
function processAIResponse(text) {
    try {
        // Extract answer section
        const answerMatch = text.match(/\[ĐÁP ÁN\]\s*([\s\S]*?)(?=\n\[GIẢI THÍCH\]|$)/);
        
        // Extract explanation section
        const explanationMatch = text.match(/\[GIẢI THÍCH\]\s*([\s\S]*?)(?=\n\[ĐỘ TIN CẬY\]|$)/);
        
        // Extract confidence percentage
        const confidenceMatch = text.match(/\[ĐỘ TIN CẬY\]\s*(\d+)%/);
        
        return {
            answerPart: answerMatch ? answerMatch[1].trim() : text.split("\n")[0],
            explanationPart: explanationMatch ? explanationMatch[1].trim() : 'Không có giải thích',
            confidence: confidenceMatch ? parseInt(confidenceMatch[1], 10) : 70,
            rawText: text,
            timestamp: new Date().toLocaleString()
        };
    } catch (error) {
        console.error("Error processing AI response:", error);
        
        // Return fallback structure if parsing fails
        return {
            answerPart: text.substring(0, 100) + '...',
            explanationPart: 'Không thể xử lý giải thích.',
            confidence: 50,
            rawText: text,
            timestamp: new Date().toLocaleString()
        };
    }
}

/**
 * Display formatted answer in the UI
 */
function displayAnswer(answer) {
    if (!answer || !dom.resultContent) return;
    
    let html = '';
    
    // Answer section
    html += `
        <div class="result-section answer-section">
            <div class="section-header">
                <i class="fas fa-check-circle"></i> Đáp án
            </div>
            <div class="section-content">
                ${formatAnswerText(answer.answerPart)}
            </div>
        </div>
    `;
    
    // Explanation section
    html += `
        <div class="result-section explanation-section">
            <div class="section-header">
                <i class="fas fa-info-circle"></i> Giải thích
            </div>
            <div class="section-content">
                ${formatExplanationText(answer.explanationPart)}
            </div>
        </div>
    `;
    
    // Confidence badge
    html += createConfidenceBadge(answer.confidence);
    
    // Update DOM and show result
    dom.resultContent.innerHTML = html;
    dom.resultContent.style.display = 'block';
    
    // Save last answer
    lastAnswer = answer;
    chrome.storage.local.set({ lastAnswer });
}

/**
 * Format answer text with highlighting and structure
 */
function formatAnswerText(text) {
    if (!text) return '<div class="no-content">Không có đáp án</div>';
    
    // Check if multiple questions are present
    const multipleAnswersRegex = /\[ĐÁP ÁN (\d+)\]/g;
    if (multipleAnswersRegex.test(text)) {
        return text.replace(/\[ĐÁP ÁN (\d+)\]([\s\S]*?)(?=\n\[ĐÁP ÁN \d+\]|$)/g, 
            (match, num, content) => {
                return `<div class="multi-answer-item">
                    <div class="answer-number">Câu ${num}:</div>
                    <div class="answer-content">${content.trim().replace(/\n/g, '<br>')}</div>
                </div>`;
            }
        );
    }
    
    // Check for multiple-choice identifiers (A, B, C, D)
    const mcMatch = text.match(/^[A-D]$/i) || text.match(/(?:Đáp án|Chọn)[^A-D]*([A-D])/i);
    if (mcMatch) {
        const option = mcMatch[1] || text.trim();
        return `<div class="mc-answer">${option}</div>`;
    }
    
    // Regular formatting with line breaks
    return text.replace(/\n/g, '<br>');
}

/**
 * Format explanation text
 */
function formatExplanationText(text) {
    if (!text) return '<div class="no-content">Không có giải thích</div>';
    
    // Handle markdown-style formatting
    let formatted = text
        .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>') // Bold
        .replace(/\*(.*?)\*/g, '<em>$1</em>')             // Italic
        .replace(/\n/g, '<br>');                          // Line breaks
        
    return formatted;
}

/**
 * Create confidence indicator badge
 */
function createConfidenceBadge(confidence) {
    let levelClass = 'low';
    if (confidence >= 80) {
        levelClass = 'high';
    } else if (confidence >= 50) {
        levelClass = 'medium';
    }
    
    return `
        <div class="confidence-badge ${levelClass}">
            <i class="fas fa-chart-line"></i>
            <span>Độ tin cậy: ${confidence}%</span>
        </div>
    `;
}

/**
 * Auto-fill answer in the page
 */
async function autoFillAnswer(answerText) {
    if (!answerText || !autoFillEnabled) return false;
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error("Không tìm thấy tab đang hoạt động");
        
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: injectAutoFill,
            args: [answerText]
        });
        
        const success = result && result[0] && result[0].result;
        
        if (success) {
            showNotification("success", "Đã tự động điền đáp án!");
            return true;
        } else {
            showNotification("warning", "Không thể điền đáp án tự động");
            return false;
        }
    } catch (error) {
        console.error("Auto-fill error:", error);
        showNotification("error", "Lỗi khi điền đáp án");
        return false;
    }
}

/**
 * This function runs in the context of the web page
 */
function injectAutoFill(answer) {
    try {
        console.log("Attempting to auto-fill answer:", answer);
        let isSuccess = false;
        
        // Handle multiple choice questions
        const handleMultipleChoice = () => {
            const radioButtons = document.querySelectorAll('input[type="radio"]');
            if (radioButtons.length === 0) return false;
            
            // Find choice letters in answer
            let options = [];
            
            // Look for patterns like "Đáp án: X" or single letter at start
            const answerPattern = answer.match(/(đáp án|đáp|câu trả lời|chọn)[\s\:]+([A-D])/i);
            if (answerPattern) {
                options.push(answerPattern[2].toUpperCase());
            } else {
                // Check for single letter answer
                const singleLetter = answer.match(/^[A-D]$/i);
                if (singleLetter) {
                    options.push(singleLetter[0].toUpperCase());
                }
            }
            
            if (options.length === 0) return false;
            
            // Find and select radio buttons
            for (const option of options) {
                for (const btn of radioButtons) {
                    const label = btn.parentElement?.textContent || '';
                    const parentText = btn.parentElement?.parentElement?.textContent || '';
                    
                    if (label.trim().startsWith(option) || 
                        parentText.includes(option + ".") || 
                        parentText.includes(option + ")")) {
                        
                        // Select the radio button
                        btn.checked = true;
                        btn.click(); // Trigger click event
                        btn.dispatchEvent(new Event('change', { bubbles: true }));
                        return true;
                    }
                }
            }
            
            return false;
        };
        
        // Handle checkbox questions (multiple answers)
        const handleCheckboxes = () => {
            const checkboxes = document.querySelectorAll('input[type="checkbox"]');
            if (checkboxes.length === 0) return false;
            
            // Find all options in the answer (A, B, C, D)
            const options = answer.match(/[A-D]/g) || [];
            if (options.length === 0) return false;
            
            // Reset all checkboxes
            checkboxes.forEach(cb => {
                cb.checked = false;
                cb.dispatchEvent(new Event('change', { bubbles: true }));
            });
            
            // Select the appropriate checkboxes
            let selected = false;
            for (const option of options) {
                for (const cb of checkboxes) {
                    const label = cb.parentElement?.textContent || '';
                    const parentText = cb.parentElement?.parentElement?.textContent || '';
                    
                    if (label.trim().startsWith(option) || 
                        parentText.includes(option + ".") || 
                        parentText.includes(option + ")")) {
                        
                        cb.checked = true;
                        cb.dispatchEvent(new Event('change', { bubbles: true }));
                        selected = true;
                    }
                }
            }
            
            return selected;
        };
        
        // Handle text input fields
        const handleTextInputs = () => {
            // Find visible text inputs
            const textInputs = [
                ...document.querySelectorAll('input[type="text"]:not([style*="display: none"])'),
                ...document.querySelectorAll('textarea:not([style*="display: none"])'),
                ...document.querySelectorAll('[contenteditable="true"]:not([style*="display: none"])'),
                ...document.querySelectorAll('.ck-editor__editable:not([style*="display: none"])')
            ];
            
  // If no text inputs found
            if (textInputs.length === 0) return false;
            
            // Clean up answer text
            const cleanAnswer = answer.trim()
                .replace(/\[ĐÁP ÁN\]/g, '')
                .replace(/\[ANSWER\]/g, '')
                .trim();
            
            // For single text input, use entire answer
            if (textInputs.length === 1) {
                const input = textInputs[0];
                
                // Handle different input types
                if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
                    input.value = cleanAnswer;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    // For contenteditable or CKEditor
                    input.innerHTML = cleanAnswer;
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                return true;
            }
            
            // For multiple fields, try to match each field (simple heuristic)
            let filled = false;
            const answerParts = cleanAnswer.split('\n').filter(p => p.trim());
            
            for (let i = 0; i < Math.min(textInputs.length, answerParts.length); i++) {
                const input = textInputs[i];
                
                // Handle different input types
                if (input.tagName === 'INPUT' || input.tagName === 'TEXTAREA') {
                    input.value = answerParts[i].trim();
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                    input.dispatchEvent(new Event('change', { bubbles: true }));
                } else {
                    // For contenteditable or CKEditor
                    input.innerHTML = answerParts[i].trim();
                    input.dispatchEvent(new Event('input', { bubbles: true }));
                }
                
                filled = true;
            }
            
            return filled;
        };
        
        // Try each method in sequence
        isSuccess = handleMultipleChoice() || handleCheckboxes() || handleTextInputs();
        
        return isSuccess;
    } catch (error) {
        console.error("Auto-fill injection error:", error);
        return false;
    }
}

/**
 * Auto-submit form after fill
 */
async function autoSubmitAnswer() {
    if (!autoSubmitEnabled) return false;
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab || !tab.id) throw new Error("Không tìm thấy tab đang hoạt động");
        
        const result = await chrome.scripting.executeScript({
            target: { tabId: tab.id },
            func: injectAutoSubmit
        });
        
        const success = result && result[0] && result[0].result;
        
        if (success) {
            showNotification("success", "Đã gửi câu trả lời!");
            return true;
        } else {
            return false;
        }
    } catch (error) {
        console.error("Auto-submit error:", error);
        return false;
    }
}

/**
 * Inject auto-submit function into page
 */
function injectAutoSubmit() {
    try {
        // Find submit button using common patterns
        const submitSelectors = [
            'button[type="submit"]',
            'input[type="submit"]',
            'button.submit-btn',
            'button.submit',
            'button[id*="submit"]',
            'button[class*="submit"]',
            'button:contains("Gửi")',
            'button:contains("Nộp")',
            'button:contains("Trả lời")',
            'button:contains("Submit")',
            'button:contains("Send")',
            'button.blue-button',
            '.submit-button'
        ];
        
        // Try each selector
        for (const selector of submitSelectors) {
            try {
                const buttons = document.querySelectorAll(selector);
                
                for (const button of buttons) {
                    // Skip invisible or disabled buttons
                    if (button.offsetParent === null || button.disabled) continue;
                    
                    // Click the button
                    button.click();
                    return true;
                }
            } catch (e) {
                // Ignore errors for individual selectors
                console.log(`Selector ${selector} failed: ${e.message}`);
            }
        }
        
        // If no button found, try to submit the form directly
        const forms = document.querySelectorAll('form');
        for (const form of forms) {
            form.submit();
            return true;
        }
        
        return false;
    } catch (error) {
        console.error("Auto-submit injection error:", error);
        return false;
    }
}

/**
 * Copy answer to clipboard
 */
function copyAnswerToClipboard() {
    if (!lastAnswer) {
        showNotification("warning", "Không có đáp án để sao chép!");
        return;
    }
    
    try {
        // Create formatted text for clipboard
        const text = `${lastAnswer.answerPart}`;
        
        // Copy to clipboard
        navigator.clipboard.writeText(text).then(() => {
            showNotification("success", "Đã sao chép đáp án!");
        }).catch(err => {
            console.error('Clipboard error:', err);
            showNotification("error", "Không thể sao chép vào clipboard!");
        });
    } catch (error) {
        console.error("Copy error:", error);
        showNotification("error", "Lỗi khi sao chép!");
    }
}

/**
 * Share answer via modal
 */
function shareAnswer() {
    if (!lastAnswer) {
        showNotification("warning", "Không có đáp án để chia sẻ!");
        return;
    }
    
    try {
        // Prepare share content
        const shareModal = document.getElementById('share-modal');
        const shareContent = document.getElementById('share-content');
        
        if (!shareModal || !shareContent) return;
        
        // Format content for sharing
        shareContent.innerHTML = `
            <div class="share-header">
                <i class="fas fa-share-alt"></i> Chia sẻ đáp án
            </div>
            <div class="share-body">
                <div class="share-answer">
                    <strong>Đáp án:</strong><br>
                    ${lastAnswer.answerPart.replace(/\n/g, '<br>')}
                </div>
                <div class="share-explanation">
                    <strong>Giải thích:</strong><br>
                    ${lastAnswer.explanationPart.replace(/\n/g, '<br>')}
                </div>
                <div class="share-footer">
                    <div class="share-timestamp">
                        <i class="far fa-clock"></i> ${lastAnswer.timestamp}
                    </div>
                    <div class="share-confidence">
                        Độ tin cậy: ${lastAnswer.confidence}%
                    </div>
                </div>
            </div>
            <div class="share-options">
                <button id="copy-share-btn" class="btn btn-primary">
                    <i class="fas fa-copy"></i> Sao chép
                </button>
                <button id="download-share-btn" class="btn btn-secondary">
                    <i class="fas fa-download"></i> Tải PDF
                </button>
            </div>
        `;
        
        // Set up buttons in share modal
        const copyShareBtn = document.getElementById('copy-share-btn');
        if (copyShareBtn) {
            copyShareBtn.addEventListener('click', () => {
                const shareText = `Đáp án: ${lastAnswer.answerPart}\n\nGiải thích: ${lastAnswer.explanationPart}\n\nĐộ tin cậy: ${lastAnswer.confidence}%`;
                navigator.clipboard.writeText(shareText);
                showNotification("success", "Đã sao chép toàn bộ nội dung!");
            });
        }
        
        const downloadShareBtn = document.getElementById('download-share-btn');
        if (downloadShareBtn) {
            downloadShareBtn.addEventListener('click', () => {
                // Basic PDF generation logic here
                showNotification("info", "Tính năng đang phát triển");
            });
        }
        
        // Show the modal
        openModal('share-modal');
    } catch (error) {
        console.error("Share error:", error);
        showNotification("error", "Lỗi khi chia sẻ!");
    }
}

/**
 * Load and display history items
 */
function loadHistoryItems() {
    if (!dom.historyItems) return;
    
    chrome.storage.local.get(['history'], (result) => {
        const history = result.history || [];
        
        if (history.length === 0) {
            dom.historyItems.innerHTML = '<div class="empty-state">Chưa có lịch sử trả lời nào.</div>';
            return;
        }
        
        // Sort by timestamp (newest first)
        history.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
        
        // Generate HTML for history items
        let html = '';
        history.forEach((item, index) => {
            const confidenceBadge = getConfidenceBadgeHtml(item.confidence);
            
            html += `
                <div class="history-item" data-index="${index}">
                    <div class="history-content">
                        <div class="history-answer">${item.answerPart.substring(0, 100)}${item.answerPart.length > 100 ? '...' : ''}</div>
                        <div class="history-meta">
                            <span class="history-timestamp"><i class="far fa-clock"></i> ${item.timestamp}</span>
                            ${confidenceBadge}
                        </div>
                    </div>
                    <div class="history-actions">
                        <button class="btn btn-icon history-view" title="Xem chi tiết">
                            <i class="fas fa-eye"></i>
                        </button>
                        <button class="btn btn-icon history-copy" title="Sao chép">
                            <i class="fas fa-copy"></i>
                        </button>
                        <button class="btn btn-icon history-delete" title="Xóa">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });
        
        dom.historyItems.innerHTML = html;
        
        // Add event listeners to history items
        setupHistoryItemListeners();
    });
}

/**
 * Get HTML for confidence badge
 */
function getConfidenceBadgeHtml(confidence) {
    let levelClass = 'low';
    if (confidence >= 80) {
        levelClass = 'high';
    } else if (confidence >= 50) {
        levelClass = 'medium';
    }
    
    return `<span class="history-confidence ${levelClass}">${confidence}%</span>`;
}

/**
 * Set up event listeners for history items
 */
function setupHistoryItemListeners() {
    // View history item
    document.querySelectorAll('.history-view').forEach(button => {
        button.addEventListener('click', function() {
            const index = this.closest('.history-item').dataset.index;
            viewHistoryItem(parseInt(index, 10));
        });
    });
    
    // Copy history item
    document.querySelectorAll('.history-copy').forEach(button => {
        button.addEventListener('click', function() {
            const index = this.closest('.history-item').dataset.index;
            copyHistoryItem(parseInt(index, 10));
        });
    });
    
    // Delete history item
    document.querySelectorAll('.history-delete').forEach(button => {
        button.addEventListener('click', function() {
            const index = this.closest('.history-item').dataset.index;
            deleteHistoryItem(parseInt(index, 10));
        });
    });
}

/**
 * View a specific history item
 */
function viewHistoryItem(index) {
    chrome.storage.local.get(['history'], (result) => {
        const history = result.history || [];
        
        if (index >= 0 && index < history.length) {
            const item = history[index];
            
            // Load the history item as current answer
            displayAnswer(item);
            lastAnswer = item;
            
            // Switch to result tab
            showTab('result');
        }
    });
}

/**
 * Copy a specific history item
 */
function copyHistoryItem(index) {
    chrome.storage.local.get(['history'], (result) => {
        const history = result.history || [];
        
        if (index >= 0 && index < history.length) {
            const item = history[index];
            
            // Copy to clipboard
            const text = item.answerPart;
            navigator.clipboard.writeText(text).then(() => {
                showNotification("success", "Đã sao chép đáp án!");
            }).catch(() => {
                showNotification("error", "Không thể sao chép!");
            });
        }
    });
}

/**
 * Delete a specific history item
 */
function deleteHistoryItem(index) {
    chrome.storage.local.get(['history'], (result) => {
        const history = result.history || [];
        
        if (index >= 0 && index < history.length) {
            // Remove the item
            history.splice(index, 1);
            
            // Save updated history
            chrome.storage.local.set({ history }, () => {
                // Reload history display
                loadHistoryItems();
                showNotification("success", "Đã xóa mục khỏi lịch sử!");
            });
        }
    });
}

/**
 * Save current answer to history
 */
function saveToHistory(answer) {
    if (!answer) return;
    
    chrome.storage.local.get(['history'], (result) => {
        const history = result.history || [];
        
        // Add new answer to history (limit to 50 items)
        history.unshift(answer);
        if (history.length > 50) {
            history.pop();
        }
        
        // Save updated history
        chrome.storage.local.set({ history });
    });
}

/**
 * Load statistics from storage
 */
function loadStatistics() {
    if (!dom.solvedCount || !dom.averageTime || !dom.accuracy) return;
    
    chrome.storage.local.get(['stats'], (result) => {
        const stats = result.stats || {
            solved: 0,
            totalTime: 0,
            totalConfidence: 0
        };
        
        // Update UI with stats
        dom.solvedCount.textContent = stats.solved;
        
        const avgTime = stats.solved > 0 ? Math.round(stats.totalTime / stats.solved) : 0;
        dom.averageTime.textContent = `${avgTime}s`;
        
        const avgConfidence = stats.solved > 0 ? Math.round(stats.totalConfidence / stats.solved) : 0;
        dom.accuracy.textContent = `${avgConfidence}%`;
        
        // Update chart if available
        updateStatsChart(stats);
    });
}

/**
 * Update statistics chart
 */
function updateStatsChart(stats) {
    const chartCanvas = document.getElementById('stats-chart');
    if (!chartCanvas) return;
    
    // Simple chart display logic
    // Note: In a real implementation, you'd use a library like Chart.js
    const ctx = chartCanvas.getContext('2d');
    if (!ctx) return;
    
    // Clear previous chart
    ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
    
    // Draw simple bar chart
    const barWidth = 40;
    const spacing = 20;
    const maxHeight = chartCanvas.height - 40;
    
    // Usage count bar
    ctx.fillStyle = '#4CAF50';
    const usageHeight = stats.solved / 100 * maxHeight;
    ctx.fillRect(30, chartCanvas.height - usageHeight, barWidth, usageHeight);
    
    // Accuracy bar
    ctx.fillStyle = '#2196F3';
    const accuracyHeight = (stats.solved > 0 ? stats.totalConfidence / stats.solved : 0) / 100 * maxHeight;
    ctx.fillRect(30 + barWidth + spacing, chartCanvas.height - accuracyHeight, barWidth, accuracyHeight);
    
    // Labels
    ctx.fillStyle = '#333';
    ctx.font = '12px Arial';
    ctx.fillText('Sử dụng', 30, chartCanvas.height - 10);
    ctx.fillText('Độ tin cậy', 30 + barWidth + spacing, chartCanvas.height - 10);
}

/**
 * Update statistics with new answer
 */
function updateStatistics(answer) {
    if (!answer) return;
    
    const solveTime = 5; // Fixed solve time for simplicity
    
    chrome.storage.local.get(['stats'], (result) => {
        const stats = result.stats || {
            solved: 0,
            totalTime: 0,
            totalConfidence: 0
        };
        
        // Update stats
        stats.solved++;
        stats.totalTime += solveTime;
        stats.totalConfidence += answer.confidence;
        
        // Save updated stats
        chrome.storage.local.set({ stats }, () => {
            // Refresh stats display
            loadStatistics();
        });
    });
}

/**
 * Toggle auto-fill setting
 */
function handleAutoFillToggle(event) {
    autoFillEnabled = event.target.checked;
    chrome.storage.local.set({ autoFillEnabled });
    
    // Show notification
    const message = autoFillEnabled ? 
        "Đã bật tự động điền đáp án" : 
        "Đã tắt tự động điền đáp án";
    
    showNotification("info", message);
}

/**
 * Toggle auto-submit setting
 */
function handleAutoSubmitToggle(event) {
    autoSubmitEnabled = event.target.checked;
    chrome.storage.local.set({ autoSubmitEnabled });
    
    // Show notification
    const message = autoSubmitEnabled ? 
        "Đã bật tự động gửi đáp án" : 
        "Đã tắt tự động gửi đáp án";
    
    showNotification("info", message);
}

/**
 * Open modal dialog
 */
function openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    // Hide all other modals
    document.querySelectorAll('.modal').forEach(m => {
        m.classList.remove('active');
    });
    
    // Show this modal
    modal.classList.add('active');
}

/**
 * Close modal dialog
 */
function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (!modal) return;
    
    modal.classList.remove('active');
}

/**
 * Save settings from modal
 */
function saveSettings() {
    try {
        // Get settings values
        const darkModeToggle = document.getElementById('dark-mode-toggle');
        const fontSizeSelect = document.getElementById('font-size-select');
        const apiKeyInput = document.getElementById('api-key-input');
        
        const settings = {
            darkMode: darkModeToggle ? darkModeToggle.checked : false,
            fontSize: fontSizeSelect ? fontSizeSelect.value : 'medium',
            apiKey: apiKeyInput ? apiKeyInput.value.trim() : ''
        };
        
        // Save settings
        chrome.storage.local.set({ settings }, () => {
            // Apply settings
            applySettings(settings);
            
            // Close modal
            closeModal('settings-modal');
            
            // Show notification
            showNotification("success", "Đã lưu cài đặt!");
        });
    } catch (error) {
        console.error("Settings save error:", error);
        showNotification("error", "Không thể lưu cài đặt!");
    }
}

// Export functions for testing (not used in production)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        solveQuestion,
        processAIResponse,
        formatAnswerText,
        saveToHistory
    };
}          