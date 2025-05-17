// script.js
document.addEventListener('DOMContentLoaded', () => {
    // ==========================================================================
    // === 配置区域：请在这里修改为你自己的 API 地址和 Key ===
    // ==========================================================================
    const API_BASE_URL = 'http://43.153.180.91:5000'; // 替换为你的云服务器公网IP和端口
    const API_KEY = 'R+5w(wPD3H-,WCBDS#]vl85}cM{8rn';             // 替换为你的真实API Key
    // ==========================================================================
    // === 配置区域结束 ===
    // ==========================================================================

    // --- 启动时检查配置是否已修改 ---
    const PLACEHOLDER_URL = 'http://YOUR_SERVER_IP_HERE:5000';
    const PLACEHOLDER_KEY = 'YOUR_ACTUAL_API_KEY_HERE';

    if (API_BASE_URL === PLACEHOLDER_URL || API_KEY === PLACEHOLDER_KEY) {
        document.body.innerHTML = `<div style="padding: 20px; text-align: center; font-size: 18px; color: red;">
            <h2>配置错误</h2>
            <p>请打开 <code>script.js</code> 文件顶部, 将 <code>API_BASE_URL</code> 和 <code>API_KEY</code> 修改为你的实际值。</p>
            <p style="font-size:0.9em; color: #555;">(当前读取到的 URL: ${escapeHtml(API_BASE_URL)}, Key: ${API_KEY === PLACEHOLDER_KEY ? '仍为占位符' : '已修改但可能与URL占位符相同'})</p>
        </div>`;
        function escapeHtml(unsafe) { // 临时定义，以防主函数未执行
            if (unsafe === null || typeof unsafe === 'undefined') return '';
            return String(unsafe).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, " ").replace(/'/g, "'");
        }
        return; 
    }
    // --- 配置检查结束 ---

    console.log("Script loaded. API_BASE_URL:", API_BASE_URL, "API_KEY:", API_KEY ? "****** (set)" : "NOT SET");


    const TELEGRAM_REFRESH_INTERVAL = 60000; 
    let telegramAutoRefreshTimer = null;
    let currentTelegramDate = null;
    let lastTelegramMessageId = null;
    let isLoadingTelegram = false; 

    // --- DOM Elements ---
    const indicatorDateEl = document.getElementById('indicatorDate');
    const indicatorIntervalEl = document.getElementById('indicatorInterval');
    const indicatorHourEl = document.getElementById('indicatorHour');
    const fetchIndicatorsBtn = document.getElementById('fetchIndicatorsBtn');
    const indicatorsResultEl = document.getElementById('indicatorsResult');
    const hourHintEl = document.getElementById('hourHint');

    const telegramDateEl = document.getElementById('telegramDate');
    const fetchTelegramBtn = document.getElementById('fetchTelegramBtn'); // 新增按钮的引用
    const telegramMessagesContainerEl = document.getElementById('telegramMessagesContainer');
    const telegramStatusEl = document.getElementById('telegramStatus');



// --- 初始化 ---
function init() {
    console.log("init() called"); 
    const today = new Date().toISOString().split('T')[0];
    indicatorDateEl.value = today;
    telegramDateEl.value = today; 

    updateHourHintAndValidation(); 
    indicatorIntervalEl.addEventListener('change', updateHourHintAndValidation);
    
    if (fetchIndicatorsBtn) {
        console.log("Attaching click listener to fetchIndicatorsBtn"); 
        fetchIndicatorsBtn.addEventListener('click', handleFetchIndicators);
    } else {
        console.error("ERROR: fetchIndicatorsBtn not found!"); 
    }

    if (telegramDateEl) {
        telegramDateEl.addEventListener('change', () => {
            console.log("Telegram date changed to:", telegramDateEl.value);
            currentTelegramDate = telegramDateEl.value; 
            telegramMessagesContainerEl.innerHTML = ''; 
            telegramMessagesContainerEl.classList.remove('loading-initial', 'no-messages'); 
            telegramStatusEl.textContent = '选择日期后请点击“获取消息”。';
            if (telegramAutoRefreshTimer) clearInterval(telegramAutoRefreshTimer); 
            lastTelegramMessageId = null; 
        });
    } else {
        console.error("ERROR: telegramDateEl not found!");
    }

    if (fetchTelegramBtn) {
        console.log("Attaching click listener to fetchTelegramBtn");
        fetchTelegramBtn.addEventListener('click', () => {
            console.log("fetchTelegramBtn clicked for date:", currentTelegramDate);
            if (currentTelegramDate) {
                loadTelegramMessages(currentTelegramDate, true); 
            } else {
                telegramStatusEl.textContent = '请先选择一个日期。';
                console.warn("fetchTelegramBtn clicked but currentTelegramDate is not set.");
            }
        });
    } else {
        console.error("ERROR: fetchTelegramBtn not found!");
    }
    
    currentTelegramDate = today; 
    telegramStatusEl.textContent = '选择日期并点击“获取消息”。';
    // 页面加载时，如果页面是可见的，可以考虑加载一次
    if (document.visibilityState === 'visible' && currentTelegramDate) {
        console.log("Initial page load is visible, loading Telegram messages for today.");
        loadTelegramMessages(currentTelegramDate, true); 
    }


    // ==========================================================================
    // === 新增/修改：处理页面可见性变化 ===
    // ==========================================================================
    document.addEventListener('visibilitychange', () => {
        const now = new Date().toLocaleTimeString();
        console.log(`[${now}] Page visibility changed to: ${document.visibilityState}`);
        if (document.visibilityState === 'visible') {
            // 页面从后台切回前台
            if (currentTelegramDate && !isLoadingTelegram) { // 确保有当前日期且不在加载中
                console.log(`[${now}] Page became visible. Immediately refreshing Telegram messages for date: ${currentTelegramDate}`);
                // 立即刷新一次，将其视为一次“刷新”而不是“初次加载”
                // 这样会使用 lastTelegramMessageId 获取增量消息
                loadTelegramMessages(currentTelegramDate, false); 
            }
            // 并且（重新）启动定时器（如果 loadTelegramMessages 内部的 startTelegramAutoRefresh 没有覆盖所有情况）
            // 通常 loadTelegramMessages 内部会调用 startTelegramAutoRefresh，所以这里可能不需要额外调用
            // startTelegramAutoRefresh(currentTelegramDate); // 可以考虑是否需要这行
        } else {
            // 页面切换到后台，可以考虑清除定时器，但我们当前的逻辑是定时器内部会检查可见性
            // 如果希望后台完全不跑 tick，可以在这里 clearInterval
            // console.log(`[${now}] Page became hidden. Auto-refresh will be paused by visibility check.`);
        }
    });
    // ==========================================================================
    // === 可见性变化处理结束 ===
    // ==========================================================================

} // init 函数结束

// ... (其他函数如 updateHourHintAndValidation, fetchData 等) ...

// init(); // 保持 init 的调用

    function updateHourHintAndValidation() {
        // ... (此函数内容不变) ...
        const interval = indicatorIntervalEl.value;
        let hint = "";
        indicatorHourEl.disabled = false; 
        if (interval === '1h') {
            hint = " (0-23)";
            indicatorHourEl.min = "0";
            indicatorHourEl.max = "23";
        } else if (interval === '4h') {
            hint = " (0, 4, 8, 12, 16, 20)";
            indicatorHourEl.min = "0";
            indicatorHourEl.max = "20";
        } else if (interval === '1d') {
            hint = " (固定为 00)";
            indicatorHourEl.value = "0";
            indicatorHourEl.min = "0";
            indicatorHourEl.max = "0";
        }
        hourHintEl.textContent = hint;
    }

    function validateHour(hourStr, interval) {
        // ... (此函数内容不变) ...
        const hour = parseInt(hourStr, 10);
        if (isNaN(hour)) return false;
        if (interval === '1h') { return hour >= 0 && hour <= 23; }
        else if (interval === '4h') { return [0, 4, 8, 12, 16, 20].includes(hour); }
        else if (interval === '1d') { return hour === 0; }
        return false;
    }

    async function fetchData(url, options = {}) {
        
        // ... (此函数内容不变) ...
        console.log(`fetchData called for URL: ${url}`);
        console.log("--- Sending API Key from frontend:", API_KEY); // <<<--- 添加这行
        const defaultHeaders = { 'X-API-KEY': API_KEY };
        const response = await fetch(url, {
            ...options,
            headers: { ...defaultHeaders, ...options.headers }
        });
        if (!response.ok) {
            let errorData;
            try {errorData = await response.json();} 
            catch (e) {errorData = { error: `HTTP Error: ${response.status} ${response.statusText}` };}
            const errorMessage = errorData.error || `Request failed with status: ${response.status}`;
            console.error("Fetch error data for URL:", url, "Response:", errorData); 
            throw new Error(errorMessage);
        }
        return response.json();
    }

    async function handleFetchIndicators() {
        console.log("handleFetchIndicators() called"); 
        const date = indicatorDateEl.value;
        const interval = indicatorIntervalEl.value;
        const hourStr = indicatorHourEl.value;
        console.log(`Parameters: date=${date}, interval=${interval}, hourStr=${hourStr}`); 

        if (!date || !interval || hourStr === '') {
            console.log("Validation failed: Missing fields for indicators"); 
            indicatorsResultEl.innerHTML = '<p class="error">Please fill in all fields: Date, Interval, and Hour.</p>';
            return;
        }
        if (!validateHour(hourStr, interval)) {
            console.log("Validation failed: Invalid hour for indicators"); 
            indicatorsResultEl.innerHTML = `<p class="error">Hour (${hourStr}) is invalid for interval (${interval}). ${hourHintEl.textContent}</p>`;
            return;
        }
        const hour = String(parseInt(hourStr, 10)).padStart(2, '0');
        indicatorsResultEl.innerHTML = '<p class="loading">Fetching indicator data...</p>';
        fetchIndicatorsBtn.disabled = true;
        try {
            const url = `${API_BASE_URL}/api/indicators?date=${date}&interval=${interval}&hour=${hour}`;
            console.log("Fetching indicators from URL:", url); 
            const data = await fetchData(url); 
            console.log("Indicators data received:", data); 
            displayIndicators(data);
        } catch (error) {
            indicatorsResultEl.innerHTML = `<p class="error">Failed to fetch indicator data: ${escapeHtml(error.message)}</p>`;
        } finally {
            fetchIndicatorsBtn.disabled = false;
        }
    }

    function displayIndicators(data) {
        // ... (此函数内容不变) ...
        if (data.error) { 
            indicatorsResultEl.innerHTML = `<p class="error">${escapeHtml(data.error)}</p>`;
            return;
        }
        let html = `<h3>${escapeHtml(data.date)} - ${escapeHtml(data.interval)} - ${escapeHtml(String(data.hour).padStart(2, '0'))}:00</h3>`;
        html += '<h4>Up Indicators</h4>';
        if (data.up_indicators && data.up_indicators.length > 0) { html += createTableHtml(data.up_indicators); } 
        else { html += '<p>No up indicator data.</p>'; }
        html += '<h4>Down Indicators</h4>';
        if (data.down_indicators && data.down_indicators.length > 0) { html += createTableHtml(data.down_indicators); } 
        else { html += '<p>No down indicator data.</p>'; }
        indicatorsResultEl.innerHTML = html;
    }

    function createTableHtml(indicatorArray) {
        // ... (此函数内容不变) ...
        if (!indicatorArray || indicatorArray.length === 0) return '<p>No data</p>';
        let table = '<table><thead><tr>';
        const headers = indicatorArray.length > 0 ? Object.keys(indicatorArray[0]) : [];
        if (headers.length === 0 && indicatorArray.length > 0) { console.warn("Indicator array has items but no headers found.", indicatorArray[0]); return '<p>Data structure error.</p>';}
        if (headers.length === 0) return '<p>No data to display (no headers).</p>';
        headers.forEach(header => table += `<th>${escapeHtml(header)}</th>`);
        table += '</tr></thead><tbody>';
        indicatorArray.forEach(row => {
            table += '<tr>';
            headers.forEach(header => {
                const value = row[header] === null || typeof row[header] === 'undefined' ? '' : row[header];
                table += `<td>${escapeHtml(String(value))}</td>`;
            });
            table += '</tr>';
        });
        table += '</tbody></table>';
        return table;
    }
    
    // --- Telegram 消息 ---
    // handleTelegramDateChange 现在只更新 currentTelegramDate 和 UI提示
    function handleTelegramDateChange() {
        const newDate = telegramDateEl.value;
        console.log("Telegram date input changed to:", newDate);
        if (newDate) { // 确保选择了日期
            currentTelegramDate = newDate;
            telegramMessagesContainerEl.innerHTML = ''; // 清空消息
            telegramMessagesContainerEl.classList.remove('loading-initial', 'no-messages'); // 重置状态
            telegramStatusEl.textContent = '选择日期后请点击“获取消息”。';
            if (telegramAutoRefreshTimer) {
                clearInterval(telegramAutoRefreshTimer);
                console.log("Cleared old telegram auto refresh timer.");
            }
            lastTelegramMessageId = null; // 重置 last ID
        } else {
            currentTelegramDate = null;
            telegramStatusEl.textContent = '请选择一个日期。';
        }
    }

    async function loadTelegramMessages(date, isInitialLoad = false) {
        console.log(`loadTelegramMessages called for date: ${date}, isInitialLoad: ${isInitialLoad}, lastTelegramMessageId: ${lastTelegramMessageId}`);
        if (!date) {
            console.warn("loadTelegramMessages called without a date.");
            telegramStatusEl.textContent = '错误：未指定日期。';
            return;
        }
        if (isLoadingTelegram) {
            console.log("Telegram messages are already loading, skipping.");
            return;
        }
        isLoadingTelegram = true;
        fetchTelegramBtn.disabled = true; // 禁用按钮

        telegramMessagesContainerEl.classList.remove('no-messages'); 
        if (isInitialLoad) {
            telegramMessagesContainerEl.innerHTML = ''; 
            telegramMessagesContainerEl.classList.add('loading-initial'); 
            lastTelegramMessageId = null; // 确保初次加载时重置
            console.log("Initial load for Telegram, clearing messages and lastTelegramMessageId.");
        } else {
            telegramStatusEl.textContent = '正在刷新新消息...';
            console.log("Refreshing Telegram messages.");
        }
        
        const sinceIdParam = lastTelegramMessageId && !isInitialLoad ? `&since_message_id=${lastTelegramMessageId}` : '';
        const limit = isInitialLoad ? 2000 : 500; 

        try {
            const url = `${API_BASE_URL}/api/telegram/messages?date=${date}${sinceIdParam}&limit=${limit}`;
            console.log("Fetching Telegram messages from URL:", url);
            const data = await fetchData(url);
            console.log("Telegram messages data received:", data);
            
            if (telegramMessagesContainerEl.classList.contains('loading-initial')) {
                telegramMessagesContainerEl.classList.remove('loading-initial');
                if (isInitialLoad) telegramMessagesContainerEl.innerHTML = ''; 
            }
            telegramStatusEl.textContent = `最后更新: ${new Date().toLocaleTimeString()}`;

            if (data.messages && data.messages.length > 0) {
                displayTelegramMessages(data.messages, isInitialLoad); // isInitialLoad 决定是替换还是追加
                lastTelegramMessageId = data.messages[data.messages.length - 1].message_id;
                console.log("New lastTelegramMessageId set to:", lastTelegramMessageId);
            } else {
                if (isInitialLoad) {
                    telegramMessagesContainerEl.classList.add('no-messages'); 
                    console.log("No messages found for initial load.");
                } else {
                    console.log("No new messages found on refresh.");
                }
            }
            
            startTelegramAutoRefresh(date);

        } catch (error) {
            const errorMessage = `<p class="error">获取Telegram消息失败: ${escapeHtml(error.message)}</p>`;
            telegramMessagesContainerEl.classList.remove('loading-initial', 'no-messages');
            if (isInitialLoad) {
                telegramMessagesContainerEl.innerHTML = errorMessage;
            } else {
                telegramStatusEl.textContent = `刷新失败: ${escapeHtml(error.message)}`;
            }
            console.error('Error fetching Telegram messages:', error);
            // 即使失败也尝试重启自动刷新，以防是临时网络问题
            startTelegramAutoRefresh(date); 
        } finally {
            isLoadingTelegram = false;
            fetchTelegramBtn.disabled = false; // 启用按钮
        }
    }

    function displayTelegramMessages(messages, isInitialLoad) {
        console.log(`Displaying ${messages.length} messages. isInitialLoad: ${isInitialLoad}`);
        // 如果是初次加载，先清空现有内容（虽然 loadTelegramMessages 已经做了一次）
        if (isInitialLoad) {
            telegramMessagesContainerEl.innerHTML = '';
        }

        messages.forEach(msg => {
            // ... (message item creation logic - 与之前版本基本一致) ...
            const messageItemEl = document.createElement('div');
            messageItemEl.classList.add('message-item', 'received'); 
            const messageBubbleEl = document.createElement('div');
            messageBubbleEl.classList.add('message-bubble');
            let contentHtml = '';
            if (msg.message_type === 'text') {
                const formattedContent = escapeHtml(msg.content || '').replace(/\n/g, '<br>');
                contentHtml = `<div class="message-content text-content">${formattedContent}</div>`;
            } else if (msg.message_type === 'photo' && msg.image_url) {
                const imageUrl = API_BASE_URL + msg.image_url; 
                contentHtml = `<div class="message-content image-content"><img src="${imageUrl}" alt="Image message" onerror="this.style.display='none'; this.parentElement.insertAdjacentHTML('beforeend', '<p class=\\'error\\'>Image failed to load for: ${escapeHtml(msg.image_url)}</p>'); console.error('Failed to load image:', imageUrl);"></div>`;
            } else {
                contentHtml = `<div class="message-content text-content error">[Unknown message type or content error: ${escapeHtml(msg.content || msg.message_type || '')}]</div>`;
            }
            let displayTimestamp = msg.timestamp;
            if (msg.timestamp) {
                try {
                    let dateObj;
                    if (String(msg.timestamp).match(/[\-T:]/)) { 
                        let isoTimestamp = String(msg.timestamp).replace(' ', 'T');
                        if (!isoTimestamp.includes('Z') && (isoTimestamp.match(/:/g) || []).length === 2 && isoTimestamp.length >= 19) {} 
                        else if (!isoTimestamp.endsWith('Z')){ isoTimestamp += 'Z'; }
                        dateObj = new Date(isoTimestamp);
                    } else if (!isNaN(parseFloat(msg.timestamp)) && isFinite(msg.timestamp)) { 
                        const tsNumber = parseFloat(msg.timestamp);
                        dateObj = new Date(tsNumber * (String(tsNumber).length === 10 ? 1000 : 1));
                    }
                    if (dateObj && !isNaN(dateObj.getTime())) { 
                         displayTimestamp = dateObj.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
                    }
                } catch (e) {}
            }
            messageBubbleEl.innerHTML = `
                <div class="message-meta">
                    <span class="sender">${escapeHtml(msg.sender_name || 'Unknown User')}</span>
                    <span class="timestamp">${escapeHtml(displayTimestamp || 'Unknown Time')}</span>
                </div>
                ${contentHtml}
            `;
            messageItemEl.appendChild(messageBubbleEl);
            telegramMessagesContainerEl.appendChild(messageItemEl); // 总是追加到末尾
        });
        
        // 滚动逻辑: 只有当有新消息添加时才考虑滚动
        if (messages.length > 0) {
            // 简单的总是滚动到底部
            telegramMessagesContainerEl.scrollTop = telegramMessagesContainerEl.scrollHeight;
        }
    }
    
    function startTelegramAutoRefresh(dateToRefresh) {
        console.log("startTelegramAutoRefresh called for date:", dateToRefresh);
        if (telegramAutoRefreshTimer) {
            clearInterval(telegramAutoRefreshTimer);
            console.log("Cleared existing telegram auto refresh timer.");
        }
        telegramAutoRefreshTimer = setInterval(() => {
            const now = new Date().toLocaleTimeString();
            // 在这里加入更详细的日志，如我上一条回复中建议的
            console.log(`[${now}] setInterval tick. Visibility: ${document.visibilityState}, isLoading: ${isLoadingTelegram}, currentDate: ${currentTelegramDate}, dateToRefresh: ${dateToRefresh}`);
            
            if (currentTelegramDate === dateToRefresh && 
                document.visibilityState === 'visible' &&  // 这个条件保持
                !isLoadingTelegram) { 
                
                console.log(`[${now}] Conditions MET. Auto-refreshing Telegram messages for date: ${dateToRefresh}`);
                loadTelegramMessages(dateToRefresh, false); 
            } else {
                let reasons = [];
                if (currentTelegramDate !== dateToRefresh) reasons.push("date mismatch");
                if (document.visibilityState !== 'visible') reasons.push("page not visible");
                if (isLoadingTelegram) reasons.push("already loading");
                if (reasons.length > 0) {
                    console.log(`[${now}] Skipping auto-refresh. Reasons: ${reasons.join(', ')}`);
                }
                // 如果只是因为页面不可见而跳过，上面的日志已经包含了 "page not visible"
            }
        }, TELEGRAM_REFRESH_INTERVAL);
        console.log("New telegram auto refresh timer started. Interval ID:", telegramAutoRefreshTimer);
    }

    function escapeHtml(unsafe) {
        // ... (此函数内容不变) ...
        if (unsafe === null || typeof unsafe === 'undefined') return '';
        return String(unsafe).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">").replace(/"/g, " ").replace(/'/g, "'"); 
    }
    
    init(); 
});