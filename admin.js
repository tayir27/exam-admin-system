// Vika API 配置
const VIKA_CONFIG = {
    baseUrl: 'https://api.vika.cn/fusion/v1',
    token: 'usk3L5CcGGTqFaJllHYE6BA',
    datasheetId: 'dstYgzbt7uSqEoueKG'
};

// CORS代理配置 - 用于解决跨域问题
const PROXY_CONFIG = {
    // AllOrigins代理服务
    allorigins: 'https://api.allorigins.win/get?url=',
    // CORS Anywhere代理服务 (备用)
    corsanywhere: 'https://cors-anywhere.herokuapp.com/',
    // 本地开发代理 (如果有)
    local: 'http://localhost:3001/proxy?url='
};

// 当前使用的代理
let currentProxy = 'allorigins';

// 检测是否需要使用代理
function needsProxy() {
    // 检测当前域名，如果是file://或非localhost，则需要代理
    const protocol = window.location.protocol;
    const hostname = window.location.hostname;
    
    return protocol === 'file:' || 
           (hostname !== 'localhost' && hostname !== '127.0.0.1' && hostname !== '');
}

// 构建API请求URL
function buildApiUrl(endpoint) {
    const fullUrl = `${VIKA_CONFIG.baseUrl}${endpoint}`;
    
    if (needsProxy()) {
        switch (currentProxy) {
            case 'allorigins':
                return `${PROXY_CONFIG.allorigins}${encodeURIComponent(fullUrl)}`;
            case 'corsanywhere':
                return `${PROXY_CONFIG.corsanywhere}${fullUrl}`;
            case 'local':
                return `${PROXY_CONFIG.local}${encodeURIComponent(fullUrl)}`;
            default:
                return fullUrl;
        }
    }
    
    return fullUrl;
}

// 全局变量
let allAnnouncements = []; // 所有公告数据
let filteredAnnouncements = []; // 过滤后的数据
let currentSearchTerm = ''; // 当前搜索词
let currentDateFilter = 'all'; // 当前时间筛选
let customDateRange = { start: null, end: null }; // 自定义时间范围
let editingRecordId = null; // 正在编辑的记录ID

// DOM 元素
const adminLoadingState = document.getElementById('adminLoadingState');
const adminErrorState = document.getElementById('adminErrorState');
const adminTable = document.getElementById('adminTable');
const adminTableBody = document.getElementById('adminTableBody');
const adminSearchInput = document.getElementById('adminSearchInput');
const totalCountElement = document.getElementById('totalCount');
const filteredCountElement = document.getElementById('filteredCount');
const adminUpdateTimeElement = document.getElementById('adminUpdateTime');

// 时间筛选相关元素
const deadlineFilter = document.getElementById('deadlineFilter');
const customDateRangeDiv = document.getElementById('customDateRange');
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const applyCustomFilterButton = document.getElementById('applyCustomFilter');
const filterStatusElement = document.getElementById('filterStatus');

// 按钮元素
const refreshButton = document.getElementById('refreshButton');
const addButton = document.getElementById('addButton');
const clearSearchButton = document.getElementById('clearSearchButton');
const adminRetryButton = document.getElementById('adminRetryButton');

// 模态框元素
const announcementModal = document.getElementById('announcementModal');
const deleteModal = document.getElementById('deleteModal');
const modalTitle = document.getElementById('modalTitle');
const announcementForm = document.getElementById('announcementForm');
const closeModalButton = document.getElementById('closeModalButton');
const cancelButton = document.getElementById('cancelButton');
const saveButton = document.getElementById('saveButton');

// 删除模态框元素
const deleteAnnouncementName = document.getElementById('deleteAnnouncementName');
const closeDeleteModalButton = document.getElementById('closeDeleteModalButton');
const cancelDeleteButton = document.getElementById('cancelDeleteButton');
const confirmDeleteButton = document.getElementById('confirmDeleteButton');

// 特殊字段元素
const deadlineInput = document.getElementById('deadline');
const unlimitedDeadlineCheckbox = document.getElementById('unlimitedDeadline');
const recruitCountInput = document.getElementById('recruitCount');
const unknownRecruitCountCheckbox = document.getElementById('unknownRecruitCount');

// Toast 元素
const toast = document.getElementById('toast');
const toastMessage = document.getElementById('toastMessage');

// 删除确认相关变量
let deleteRecordId = null;

// 应用初始化
document.addEventListener('DOMContentLoaded', async () => {
    console.log('后台管理应用初始化...');
    
    // 绑定事件监听器
    bindEventListeners();
    
    // 加载数据
    await loadAnnouncements();
});

// 绑定事件监听器
function bindEventListeners() {
    // 主要功能按钮
    refreshButton.addEventListener('click', loadAnnouncements);
    addButton.addEventListener('click', () => openModal('add'));
    clearSearchButton.addEventListener('click', clearSearch);
    adminRetryButton.addEventListener('click', loadAnnouncements);
    
    // 搜索功能
    adminSearchInput.addEventListener('input', handleSearch);
    
    // 时间筛选功能
    deadlineFilter.addEventListener('change', handleDateFilterChange);
    applyCustomFilterButton.addEventListener('click', applyCustomDateFilter);
    startDateInput.addEventListener('change', validateCustomDateRange);
    endDateInput.addEventListener('change', validateCustomDateRange);
    
    // 模态框相关
    closeModalButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);
    saveButton.addEventListener('click', saveAnnouncement);
    
    // 删除模态框相关
    closeDeleteModalButton.addEventListener('click', closeDeleteModal);
    cancelDeleteButton.addEventListener('click', closeDeleteModal);
    confirmDeleteButton.addEventListener('click', performDelete);
    
    // 模态框背景点击关闭
    announcementModal.addEventListener('click', (e) => {
        if (e.target === announcementModal) closeModal();
    });
    deleteModal.addEventListener('click', (e) => {
        if (e.target === deleteModal) closeDeleteModal();
    });
    
    // 特殊字段处理
    unlimitedDeadlineCheckbox.addEventListener('change', handleUnlimitedDeadlineChange);
    unknownRecruitCountCheckbox.addEventListener('change', handleUnknownRecruitCountChange);
    
    // 键盘快捷键
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            closeModal();
            closeDeleteModal();
        }
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            adminSearchInput.focus();
        }
        if (e.key === 'F5') {
            e.preventDefault();
            loadAnnouncements();
        }
    });
}

// 加载公告数据
async function loadAnnouncements() {
    console.log('开始加载公告数据...');
    showLoadingState();
    
    try {
        const apiUrl = buildApiUrl(`/datasheets/${VIKA_CONFIG.datasheetId}/records?fieldKey=name`);
        console.log('请求URL:', apiUrl);
        
        let response;
        let data;
        
        if (needsProxy() && currentProxy === 'allorigins') {
            // 使用AllOrigins代理
            response = await fetch(apiUrl);
            if (!response.ok) {
                throw new Error(`代理请求失败: ${response.status}`);
            }
            const proxyData = await response.json();
            data = JSON.parse(proxyData.contents);
        } else {
            // 直接请求或使用其他代理
            response = await fetch(apiUrl, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${VIKA_CONFIG.token}`,
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            }

            data = await response.json();
        }
        
        console.log('API响应数据:', data);

        if (data.success && data.data && data.data.records) {
            allAnnouncements = processAnnouncementData(data.data.records);
            console.log('处理后的公告数据:', allAnnouncements);
            
            // 更新时间显示
            adminUpdateTimeElement.textContent = new Date().toLocaleString('zh-CN');
            
            // 应用搜索过滤
            applySearch();
            
        } else {
            throw new Error('API响应格式不正确或无数据');
        }

    } catch (error) {
        console.error('加载数据失败:', error);
        
        // 尝试切换代理
        if (needsProxy() && currentProxy === 'allorigins') {
            console.log('尝试切换到CORS Anywhere代理...');
            currentProxy = 'corsanywhere';
            return loadAnnouncements();
        }
        
        showErrorState(error.message + '\n\n提示：如果是跨域问题，请尝试使用Chrome的--disable-web-security参数启动，或者部署到HTTPS服务器上。');
    }
}

// 处理公告数据
function processAnnouncementData(records) {
    return records.map(record => {
        const fields = record.fields || {};
        
        // 调试：打印所有字段以确认数据结构
        console.log('Record fields:', fields);
        
        return {
            id: record.recordId,
            examName: fields['公告标题'] || '',
            workLocation: fields['工作地点'] || '',
            contractType: fields['编制类型'] || '',
            recruitCount: fields['招录人数'] || 0,
            deadline: fields['报名截止'] || '',
            educationRequirement: fields['学历要求'] || '',
            majorRequirement: fields['专业要求'] || '',
            officialWebsite: fields['公告链接'] || ''
        };
    });
}

// 应用搜索过滤
function applySearch() {
    let filtered = [...allAnnouncements];
    
    // 应用时间筛选
    filtered = applyDateFilter(filtered);
    
    // 应用关键词搜索
    if (currentSearchTerm.trim()) {
        filtered = filterBySearch(filtered, currentSearchTerm);
    }
    
    filteredAnnouncements = filtered;
    
    // 更新计数
    totalCountElement.textContent = allAnnouncements.length;
    filteredCountElement.textContent = filteredAnnouncements.length;
    
    // 更新筛选状态显示
    updateFilterStatus();
    
    // 渲染表格
    renderTable();
}

// 搜索过滤函数
function filterBySearch(announcements, searchTerm) {
    if (!searchTerm.trim()) return announcements;
    
    const terms = searchTerm.toLowerCase().split(/\s+/).filter(t => t.length > 0);
    
    return announcements.filter(announcement => {
        const searchableText = [
            announcement.examName,
            announcement.workLocation,
            announcement.contractType,
            announcement.educationRequirement,
            announcement.majorRequirement
        ].join(' ').toLowerCase();
        
        return terms.every(term => searchableText.includes(term));
    });
}

// 处理搜索输入
function handleSearch(event) {
    currentSearchTerm = event.target.value;
    applySearch();
}

// 清除搜索
function clearSearch() {
    adminSearchInput.value = '';
    currentSearchTerm = '';
    // 同时清除时间筛选
    deadlineFilter.value = 'all';
    currentDateFilter = 'all';
    customDateRangeDiv.style.display = 'none';
    applySearch();
}

// 处理旲间筛选变化
function handleDateFilterChange(event) {
    currentDateFilter = event.target.value;
    
    if (currentDateFilter === 'custom') {
        customDateRangeDiv.style.display = 'flex';
        // 设置默认日期范围（今天到一个月后）
        const today = new Date();
        const nextMonth = new Date(today);
        nextMonth.setMonth(nextMonth.getMonth() + 1);
        
        startDateInput.value = formatDateForInput(today);
        endDateInput.value = formatDateForInput(nextMonth);
    } else {
        customDateRangeDiv.style.display = 'none';
        applySearch();
    }
}

// 应用自定义时间筛选
function applyCustomDateFilter() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    
    if (!startDate || !endDate) {
        showToast('请选择完整的时间范围', 'error');
        return;
    }
    
    if (new Date(startDate) > new Date(endDate)) {
        showToast('开始时间不能晚于结束时间', 'error');
        return;
    }
    
    applySearch();
}

// 验证自定义旲间范围
function validateCustomDateRange() {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;
    
    if (startDate && endDate && new Date(startDate) > new Date(endDate)) {
        endDateInput.setCustomValidity('结束时间不能早于开始时间');
    } else {
        endDateInput.setCustomValidity('');
    }
}

// 应用时间筛选
function applyDateFilter(announcements) {
    if (currentDateFilter === 'all') {
        return announcements;
    }
    
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const nextWeek = new Date(today);
    nextWeek.setDate(nextWeek.getDate() + 7);
    const nextMonth = new Date(today);
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    return announcements.filter(announcement => {
        const deadline = String(announcement.deadline || '').trim();
        
        // 处理"招满为止"的情况
        if (deadline.includes('招满为止')) {
            return currentDateFilter === 'unlimited';
        }
        
        // 解析截止日期
        const deadlineDate = parseDeadlineDate(deadline);
        if (!deadlineDate) {
            // 无法解析的日期，根据筛选类型决定是否显示
            return currentDateFilter === 'all';
        }
        
        // 设置截止日期为当天的 23:59:59
        const deadlineEnd = new Date(deadlineDate.getFullYear(), deadlineDate.getMonth(), deadlineDate.getDate(), 23, 59, 59);
        
        switch (currentDateFilter) {
            case 'today':
                return isSameDay(deadlineDate, today);
            case 'tomorrow':
                return isSameDay(deadlineDate, tomorrow);
            case 'week':
                return deadlineEnd >= now && deadlineEnd <= nextWeek;
            case 'month':
                return deadlineEnd >= now && deadlineEnd <= nextMonth;
            case 'expired':
                return deadlineEnd < now;
            case 'custom':
                if (!startDateInput.value || !endDateInput.value) {
                    return true;
                }
                const customStart = new Date(startDateInput.value);
                const customEnd = new Date(endDateInput.value);
                customEnd.setHours(23, 59, 59); // 设置为当天的最后一刻
                return deadlineDate >= customStart && deadlineDate <= customEnd;
            default:
                return true;
        }
    });
}

// 判断是否为同一天
function isSameDay(date1, date2) {
    return date1.getFullYear() === date2.getFullYear() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getDate() === date2.getDate();
}

// 格式化日期为 input[type="date"] 所需的格式
function formatDateForInput(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

// 更新筛选状态显示
function updateFilterStatus() {
    if (!filterStatusElement) return;
    
    let statusText = '';
    
    switch (currentDateFilter) {
        case 'all':
            statusText = '';
            break;
        case 'today':
            statusText = '显示今天截止的公告';
            break;
        case 'tomorrow':
            statusText = '显示明天截止的公告';
            break;
        case 'week':
            statusText = '显示一周内截止的公告';
            break;
        case 'month':
            statusText = '显示一个月内截止的公告';
            break;
        case 'expired':
            statusText = '显示已过期的公告';
            break;
        case 'unlimited':
            statusText = '显示招满为止的公告';
            break;
        case 'custom':
            if (startDateInput.value && endDateInput.value) {
                statusText = `显示 ${startDateInput.value} 至 ${endDateInput.value} 的公告`;
            } else {
                statusText = '请设置自定义时间范围';
            }
            break;
    }
    
    filterStatusElement.textContent = statusText;
    filterStatusElement.style.display = statusText ? 'inline-block' : 'none';
}

// 渲染表格
function renderTable() {
    hideAllStates();
    
    if (filteredAnnouncements.length === 0) {
        adminTableBody.innerHTML = `
            <tr>
                <td colspan="8" class="empty-state">
                    <div class="empty-icon">📝</div>
                    <p>${allAnnouncements.length === 0 ? '暂无数据' : '没有符合搜索条件的记录'}</p>
                </td>
            </tr>
        `;
        return;
    }
    
    adminTableBody.innerHTML = '';
    
    filteredAnnouncements.forEach(announcement => {
        const row = createTableRow(announcement);
        adminTableBody.appendChild(row);
    });
}

// 创建表格行
function createTableRow(announcement) {
    const row = document.createElement('tr');
    
    const deadlineDisplay = formatDeadlineDisplay(announcement.deadline);
    const websiteDisplay = formatWebsiteDisplay(announcement.officialWebsite);
    
    // 调试：打印招录人数的值
    console.log('Recruit count for', announcement.examName, ':', announcement.recruitCount, 'type:', typeof announcement.recruitCount);
    
    row.innerHTML = `
        <td>
            <div class="action-buttons">
                <button class="btn btn-warning btn-sm" onclick="editAnnouncement('${announcement.id}')">编辑</button>
                <button class="btn btn-danger btn-sm" onclick="deleteAnnouncement('${announcement.id}', '${escapeHtml(announcement.examName)}')">删除</button>
            </div>
        </td>
        <td title="${escapeHtml(announcement.examName)}">${escapeHtml(announcement.examName)}</td>
        <td title="${escapeHtml(announcement.workLocation)}">${escapeHtml(announcement.workLocation)}</td>
        <td title="${escapeHtml(announcement.contractType)}">${escapeHtml(announcement.contractType)}</td>
        <td title="${escapeHtml(String(announcement.recruitCount))}">${formatRecruitCountDisplay(announcement.recruitCount)}</td>
        <td title="${escapeHtml(announcement.deadline)}">${deadlineDisplay}</td>
        <td title="${escapeHtml(announcement.educationRequirement)}">${escapeHtml(announcement.educationRequirement)}</td>
        <td title="${escapeHtml(announcement.majorRequirement)}">${escapeHtml(announcement.majorRequirement)}</td>
        <td title="${escapeHtml(announcement.officialWebsite)}">${websiteDisplay}</td>
    `;
    
    return row;
}

// 格式化招录人数显示
function formatRecruitCountDisplay(recruitCount) {
    if (recruitCount === null || recruitCount === undefined || recruitCount === '' || recruitCount === -1) {
        return '未知';
    }
    
    // 如果是字符串"未知"
    if (String(recruitCount).trim() === '未知') {
        return '未知';
    }
    
    // 确保转换为数字类型
    const count = parseInt(recruitCount);
    if (isNaN(count) || count <= 0) {
        return '未知';
    }
    
    return `${count}人`;
}

// 格式化截止时间显示
function formatDeadlineDisplay(deadline) {
    if (!deadline) return '';
    
    if (deadline.includes('招满为止')) {
        return `<span class="deadline-status deadline-unlimited">${escapeHtml(deadline)}</span>`;
    }
    
    const status = getDeadlineStatus(deadline);
    const statusClass = `deadline-${status}`;
    
    return `<span class="deadline-status ${statusClass}">${escapeHtml(deadline)}</span>`;
}

// 格式化网站显示
function formatWebsiteDisplay(website) {
    if (!website) return '';
    
    const text = website.trim();
    
    // 如果包含URL，提取并创建链接
    const urlMatch = text.match(/(https?:\/\/[^\s]+)/);
    if (urlMatch) {
        const url = urlMatch[1];
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" class="website-link">查看公告</a>`;
    }
    
    // 如果是纯链接格式
    if (text.startsWith('http://') || text.startsWith('https://')) {
        return `<a href="${escapeHtml(text)}" target="_blank" rel="noopener noreferrer" class="website-link">查看公告</a>`;
    }
    
    // 如果不是链接，只显示文本预览
    const preview = text.length > 50 ? text.substring(0, 50) + '...' : text;
    return `<span title="${escapeHtml(text)}">${escapeHtml(preview)}</span>`;
}

// 获取截止时间状态
function getDeadlineStatus(deadline) {
    if (!deadline || deadline.includes('招满为止')) return 'unlimited';
    
    const deadlineDate = parseDeadlineDate(deadline);
    if (!deadlineDate) return 'normal';
    
    const now = new Date();
    const diffDays = Math.ceil((deadlineDate - now) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) return 'urgent'; // 已过期也用urgent样式
    if (diffDays <= 3) return 'urgent';
    if (diffDays <= 7) return 'warning';
    return 'normal';
}

// 解析截止日期
function parseDeadlineDate(dateStr) {
    if (!dateStr || dateStr.trim() === '') return null;
    
    try {
        const cleanStr = dateStr.replace(/[年月]/g, '-').replace(/[日]/g, '').trim();
        const date = new Date(cleanStr);
        
        if (isNaN(date.getTime())) {
            const patterns = [
                /(\d{4})-(\d{1,2})-(\d{1,2})/,
                /(\d{4})\/(\d{1,2})\/(\d{1,2})/,
                /(\d{1,2})-(\d{1,2})-(\d{4})/,
                /(\d{1,2})\/(\d{1,2})\/(\d{4})/
            ];
            
            for (const pattern of patterns) {
                const match = dateStr.match(pattern);
                if (match) {
                    const [, p1, p2, p3] = match;
                    if (p1.length === 4) {
                        return new Date(parseInt(p1), parseInt(p2) - 1, parseInt(p3));
                    } else if (p3.length === 4) {
                        return new Date(parseInt(p3), parseInt(p2) - 1, parseInt(p1));
                    }
                }
            }
            return null;
        }
        
        return date;
    } catch (e) {
        console.warn('日期解析失败:', dateStr, e);
        return null;
    }
}

// 打开模态框
function openModal(mode, recordId = null) {
    editingRecordId = recordId;
    
    if (mode === 'add') {
        modalTitle.textContent = '添加公告';
        resetForm();
    } else if (mode === 'edit') {
        modalTitle.textContent = '编辑公告';
        const announcement = allAnnouncements.find(a => a.id === recordId);
        if (announcement) {
            fillForm(announcement);
        }
    }
    
    announcementModal.style.display = 'flex';
    // 聚焦到第一个输入框
    setTimeout(() => {
        document.getElementById('examName').focus();
    }, 100);
}

// 关闭模态框
function closeModal() {
    announcementModal.style.display = 'none';
    editingRecordId = null;
    resetForm();
}

// 重置表单
function resetForm() {
    announcementForm.reset();
    unlimitedDeadlineCheckbox.checked = false;
    unknownRecruitCountCheckbox.checked = false;
    handleUnlimitedDeadlineChange();
    handleUnknownRecruitCountChange();
}

// 填充表单
function fillForm(announcement) {
    document.getElementById('examName').value = announcement.examName;
    document.getElementById('workLocation').value = announcement.workLocation;
    document.getElementById('contractType').value = announcement.contractType;
    
    // 处理招录人数
    if (announcement.recruitCount === '未知' || announcement.recruitCount === -1) {
        unknownRecruitCountCheckbox.checked = true;
        recruitCountInput.value = '';
    } else {
        unknownRecruitCountCheckbox.checked = false;
        recruitCountInput.value = announcement.recruitCount;
    }
    
    document.getElementById('educationRequirement').value = announcement.educationRequirement;
    document.getElementById('majorRequirement').value = announcement.majorRequirement;
    document.getElementById('officialWebsite').value = announcement.officialWebsite;
    
    // 处理截止时间
    if (announcement.deadline.includes('招满为止')) {
        unlimitedDeadlineCheckbox.checked = true;
        deadlineInput.value = '';
    } else {
        unlimitedDeadlineCheckbox.checked = false;
        // 尝试将文本日期转换为datetime-local格式
        const dateValue = convertToDatetimeLocal(announcement.deadline);
        deadlineInput.value = dateValue;
    }
    
    handleUnlimitedDeadlineChange();
    handleUnknownRecruitCountChange();
}

// 处理"招满为止"复选框变化
function handleUnlimitedDeadlineChange() {
    const isUnlimited = unlimitedDeadlineCheckbox.checked;
    deadlineInput.disabled = isUnlimited;
    if (isUnlimited) {
        deadlineInput.value = '';
    }
}

// 处理"未知招录人数"复选框变化
function handleUnknownRecruitCountChange() {
    const isUnknown = unknownRecruitCountCheckbox.checked;
    recruitCountInput.disabled = isUnknown;
    if (isUnknown) {
        recruitCountInput.value = '';
    }
}

// 转换日期为date格式
function convertToDatetimeLocal(dateStr) {
    if (!dateStr || dateStr.includes('招满为止')) return '';
    
    const date = parseDeadlineDate(dateStr);
    if (!date) return '';
    
    // 转换为本地date格式（只有年月日）
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${year}-${month}-${day}`;
}

// 保存公告
async function saveAnnouncement() {
    console.log('保存公告...');
    
    // 获取表单数据
    const formData = getFormData();
    
    // 验证必填字段
    if (!formData.examName.trim()) {
        showToast('请填写公告标题', 'error');
        document.getElementById('examName').focus();
        return;
    }
    
    try {
        saveButton.disabled = true;
        saveButton.textContent = '保存中...';
        
        if (editingRecordId) {
            // 更新记录
            await updateRecord(editingRecordId, formData);
            showToast('公告更新成功');
        } else {
            // 添加记录
            await addRecord(formData);
            showToast('公告添加成功');
        }
        
        closeModal();
        await loadAnnouncements();
        
    } catch (error) {
        console.error('保存失败:', error);
        showToast(`保存失败：${error.message}`, 'error');
    } finally {
        saveButton.disabled = false;
        saveButton.textContent = '保存';
    }
}

// 获取表单数据
function getFormData() {
    const formData = {};
    
    formData.examName = document.getElementById('examName').value.trim();
    formData.workLocation = document.getElementById('workLocation').value.trim();
    formData.contractType = document.getElementById('contractType').value.trim();
    
    // 处理招录人数
    if (unknownRecruitCountCheckbox.checked) {
        formData.recruitCount = '未知';
    } else {
        formData.recruitCount = document.getElementById('recruitCount').value.trim();
    }
    
    formData.educationRequirement = document.getElementById('educationRequirement').value.trim();
    formData.majorRequirement = document.getElementById('majorRequirement').value.trim();
    formData.officialWebsite = document.getElementById('officialWebsite').value.trim();
    
    // 处理截止时间
    if (unlimitedDeadlineCheckbox.checked) {
        formData.deadline = '招满为止';
    } else {
        const deadlineValue = deadlineInput.value;
        if (deadlineValue) {
            // 将date格式转换为友好的日期格式（只有年月日）
            const date = new Date(deadlineValue);
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            formData.deadline = `${year}/${month}/${day}`;
        } else {
            formData.deadline = '';
        }
    }
    
    return formData;
}

// 添加记录
async function addRecord(formData) {
    const apiUrl = buildApiUrl(`/datasheets/${VIKA_CONFIG.datasheetId}/records?fieldKey=name`);
    const requestBody = {
        records: [{
            fields: {
                '公告标题': formData.examName,
                '工作地点': formData.workLocation,
                '编制类型': formData.contractType,
                '招录人数': formData.recruitCount === '未知' ? -1 : (parseInt(formData.recruitCount) || 0),
                '报名截止': formData.deadline,
                '学历要求': formData.educationRequirement,
                '专业要求': formData.majorRequirement,
                '公告链接': formData.officialWebsite
            }
        }]
    };
    
    let response;
    
    if (needsProxy() && currentProxy === 'allorigins') {
        // 使用AllOrigins代理，需要特殊处理POST请求
        showToast('网页版本不支持数据修改功能，请使用本地版本或部署到服务器', 'error');
        throw new Error('网页版本不支持数据修改功能');
    } else {
        response = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${VIKA_CONFIG.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
    }
    
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || '添加失败');
    }
    
    console.log('添加成功:', result);
}

// 更新记录
async function updateRecord(recordId, formData) {
    const apiUrl = buildApiUrl(`/datasheets/${VIKA_CONFIG.datasheetId}/records?fieldKey=name`);
    const requestBody = {
        records: [{
            recordId: recordId,
            fields: {
                '公告标题': formData.examName,
                '工作地点': formData.workLocation,
                '编制类型': formData.contractType,
                '招录人数': formData.recruitCount === '未知' ? -1 : (parseInt(formData.recruitCount) || 0),
                '报名截止': formData.deadline,
                '学历要求': formData.educationRequirement,
                '专业要求': formData.majorRequirement,
                '公告链接': formData.officialWebsite
            }
        }]
    };
    
    let response;
    
    if (needsProxy() && currentProxy === 'allorigins') {
        // 使用AllOrigins代理，需要特殊处理PATCH请求
        showToast('网页版本不支持数据修改功能，请使用本地版本或部署到服务器', 'error');
        throw new Error('网页版本不支持数据修改功能');
    } else {
        response = await fetch(apiUrl, {
            method: 'PATCH',
            headers: {
                'Authorization': `Bearer ${VIKA_CONFIG.token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });
    }
    
    if (!response.ok) {
        throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
    }
    
    const result = await response.json();
    if (!result.success) {
        throw new Error(result.message || '更新失败');
    }
    
    console.log('更新成功:', result);
}

// 编辑公告 - 全局函数
window.editAnnouncement = function(recordId) {
    openModal('edit', recordId);
};

// 删除公告 - 全局函数
window.deleteAnnouncement = function(recordId, examName) {
    deleteRecordId = recordId;
    deleteAnnouncementName.textContent = examName;
    deleteModal.style.display = 'flex';
};

// 关闭删除模态框
function closeDeleteModal() {
    deleteModal.style.display = 'none';
    deleteRecordId = null;
}

// 执行删除
async function performDelete() {
    if (!deleteRecordId) return;
    
    try {
        confirmDeleteButton.disabled = true;
        confirmDeleteButton.textContent = '删除中...';
        
        if (needsProxy() && currentProxy === 'allorigins') {
            // 使用AllOrigins代理，需要特殊处理DELETE请求
            showToast('网页版本不支持数据删除功能，请使用本地版本或部署到服务器', 'error');
            throw new Error('网页版本不支持数据删除功能');
        }
        
        const apiUrl = buildApiUrl(`/datasheets/${VIKA_CONFIG.datasheetId}/records?recordIds=${deleteRecordId}`);
        
        const response = await fetch(apiUrl, {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${VIKA_CONFIG.token}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
        }
        
        const result = await response.json();
        if (!result.success) {
            throw new Error(result.message || '删除失败');
        }
        
        console.log('删除成功:', result);
        showToast('公告删除成功');
        closeDeleteModal();
        await loadAnnouncements();
        
    } catch (error) {
        console.error('删除失败:', error);
        showToast(`删除失败：${error.message}`, 'error');
    } finally {
        confirmDeleteButton.disabled = false;
        confirmDeleteButton.textContent = '确认删除';
    }
}

// 显示/隐藏状态
function showLoadingState() {
    hideAllStates();
    adminLoadingState.style.display = 'flex';
}

function showErrorState(message) {
    hideAllStates();
    document.getElementById('adminErrorMessage').textContent = message || '加载失败，请检查网络连接';
    adminErrorState.style.display = 'flex';
}

function hideAllStates() {
    adminLoadingState.style.display = 'none';
    adminErrorState.style.display = 'none';
}

// 显示Toast提示
function showToast(message, type = 'success') {
    toastMessage.textContent = message;
    toast.className = `toast ${type}`;
    toast.style.display = 'block';
    
    setTimeout(() => {
        toast.style.display = 'none';
    }, 3000);
}

// 工具函数
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// 导出函数供调试使用
window.adminApp = {
    loadAnnouncements,
    allAnnouncements: () => allAnnouncements,
    filteredAnnouncements: () => filteredAnnouncements,
    applySearch
};