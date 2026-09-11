/**
 * PHÒNG KẾ HOẠCH VẬT TƯ - PC VŨNG TÀU
 * HỆ THỐNG PHÂN CÔNG & QUẢN LÝ CÔNG VIỆC
 * Application Logic & Drag-and-Drop Controller (v2)
 */

(function() {
  'use strict';

  // Versioned key to ensure updated state with Tran Thi Minh Nguyet & external coordination frame
  const STORAGE_KEY = 'PCVT_KHVT_TASKS_DATA_V4';
  const SYNC_URL_KEY = 'PCVT_KHVT_SYNC_URL';
  const DEFAULT_CLOUD_API = 'https://script.google.com/macros/s/AKfycbzA-azuFkdluVkQ7bEuatjNzKfEG3GrcCqNltiVe_2TJXGplirpnjb8DWDIQJXMtc8c/exec';

  // Global App State
  const state = {
    categories: [],
    employees: [],
    tasks: [],
    activeView: 'staff', // 'staff' | 'category' | 'dashboard'
    searchQuery: '',
    draggedTaskId: null,
    editingTaskId: null,
    cloudApiUrl: DEFAULT_CLOUD_API,
    syncStatus: 'synced', // 'synced' | 'syncing' | 'local' | 'error'
    lastSavedAt: null,
    syncDebounceTimer: null,
    hasUnsavedLocalChanges: false,
    initialCloudSyncDone: false
  };

  // DOM Elements
  const elements = {
    mainContent: document.getElementById('mainContent'),
    stagingSidebar: document.getElementById('stagingSidebar'),
    stagingDropzone: document.getElementById('stagingDropzone'),
    stagingCounter: document.getElementById('stagingCounter'),
    toggleSidebarBtn: document.getElementById('toggleSidebarBtn'),
    searchInput: document.getElementById('searchInput'),
    searchClear: document.getElementById('searchClear'),
    tabStaff: document.getElementById('tabStaff'),
    tabCategory: document.getElementById('tabCategory'),
    tabDashboard: document.getElementById('tabDashboard'),
    quickTotal: document.getElementById('quickTotal'),
    quickAssigned: document.getElementById('quickAssigned'),
    quickCompleted: document.getElementById('quickCompleted'),
    quickPending: document.getElementById('quickPending'),
    saveBtn: document.getElementById('saveBtn'),
    exportBtn: document.getElementById('exportBtn'),
    resetBtn: document.getElementById('resetBtn'),
    createTaskBtn: document.getElementById('createTaskBtn'),
    sidebarCreateBtn: document.getElementById('sidebarCreateBtn'),
    // Sync Elements
    syncConfigBtn: document.getElementById('syncConfigBtn'),
    syncStatusDot: document.getElementById('syncStatusDot'),
    syncStatusLabel: document.getElementById('syncStatusLabel'),
    syncModal: document.getElementById('syncModal'),
    syncModalClose: document.getElementById('syncModalClose'),
    syncStatusCard: document.getElementById('syncStatusCard'),
    syncStatusIcon: document.getElementById('syncStatusIcon'),
    syncStatusTitle: document.getElementById('syncStatusTitle'),
    syncStatusDesc: document.getElementById('syncStatusDesc'),
    syncLastTime: document.getElementById('syncLastTime'),
    fieldSyncUrl: document.getElementById('fieldSyncUrl'),
    shareUrlGroup: document.getElementById('shareUrlGroup'),
    shareUrlInput: document.getElementById('shareUrlInput'),
    btnCopyShareUrl: document.getElementById('btnCopyShareUrl'),
    btnSyncNow: document.getElementById('btnSyncNow'),
    btnSaveSyncConfig: document.getElementById('btnSaveSyncConfig'),
    // Modals
    taskModal: document.getElementById('taskModal'),
    taskModalTitle: document.getElementById('taskModalTitle'),
    taskForm: document.getElementById('taskForm'),
    taskModalClose: document.getElementById('taskModalClose'),
    taskModalCancel: document.getElementById('taskModalCancel'),
    deleteTaskBtn: document.getElementById('deleteTaskBtn'),
    // Form fields
    fieldTaskId: document.getElementById('fieldTaskId'),
    fieldTitle: document.getElementById('fieldTitle'),
    fieldDetail: document.getElementById('fieldDetail'),
    fieldCategory: document.getElementById('fieldCategory'),
    fieldAssignee: document.getElementById('fieldAssignee'),
    fieldFollower: document.getElementById('fieldFollower'),
    fieldDeadline: document.getElementById('fieldDeadline'),
    fieldStatus: document.getElementById('fieldStatus'),
    fieldPriority: document.getElementById('fieldPriority'),
    // Toast
    toastContainer: document.getElementById('toastContainer')
  };

  // =========================================================================
  // INITIALIZATION & REAL-TIME CLOUD SYNC
  // =========================================================================
  function init() {
    // 1. Detect query parameters or default to official cloud API
    const urlParams = new URLSearchParams(window.location.search);
    const apiParam = urlParams.get('api');
    if (apiParam && apiParam.startsWith('http')) {
      state.cloudApiUrl = apiParam.trim();
      localStorage.setItem(SYNC_URL_KEY, state.cloudApiUrl);
      try {
        const cleanUrl = window.location.origin + window.location.pathname;
        window.history.replaceState({}, document.title, cleanUrl);
      } catch (e) {}
    } else {
      state.cloudApiUrl = localStorage.getItem(SYNC_URL_KEY) || DEFAULT_CLOUD_API;
      if (!localStorage.getItem(SYNC_URL_KEY)) {
        localStorage.setItem(SYNC_URL_KEY, DEFAULT_CLOUD_API);
      }
    }

    loadData();
    setupEventListeners();
    populateFormSelects();
    render();
    updateQuickStats();
    updateHeaderHeight();
    window.addEventListener('resize', updateHeaderHeight);
    updateSyncUI('syncing', 'Đang kết nối máy chủ...');

    // 2. Initial cloud fetch immediately on page open
    if (state.cloudApiUrl) {
      pullFromCloud(false);
    }

    // 3. Periodic cloud polling (every 5s) when tab is active and user is not editing
    setInterval(() => {
      if (state.cloudApiUrl && !document.hidden && !state.hasUnsavedLocalChanges && !state.draggedTaskId && !state.editingTaskId) {
        pullFromCloud(false);
      }
    }, 5000);
  }

  function updateHeaderHeight() {
    const header = document.querySelector('.app-header');
    if (header) {
      const h = header.getBoundingClientRect().height;
      if (h > 0) {
        document.documentElement.style.setProperty('--header-height', `${Math.round(h)}px`);
      }
    }
  }

  function mergeEmployeeMetadata() {
    if (window.INITIAL_APP_DATA && window.INITIAL_APP_DATA.employees) {
      state.employees.forEach(emp => {
        const initEmp = window.INITIAL_APP_DATA.employees.find(e => e.id === emp.id);
        if (initEmp) {
          emp.local_photo = initEmp.local_photo;
          emp.photo = initEmp.photo;
          emp.team = initEmp.team;
          emp.team_name = initEmp.team_name;
          emp.dept_short = initEmp.dept_short;
          emp.dept_full = initEmp.dept_full;
          emp.position = initEmp.position;
        }
      });
    }
  }

  function loadData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        state.categories = parsed.categories || window.INITIAL_APP_DATA.categories;
        state.employees = parsed.employees || window.INITIAL_APP_DATA.employees;
        state.tasks = parsed.tasks || window.INITIAL_APP_DATA.tasks;
        state.lastSavedAt = parsed.savedAt || parsed.lastModified || 0;
        state.hasUnsavedLocalChanges = false;

        mergeEmployeeMetadata();
        return;
      } catch (e) {
        console.error('Failed to parse localStorage data, falling back to initial data', e);
      }
    }

    // Default to initial data for fresh session
    if (window.INITIAL_APP_DATA) {
      state.categories = JSON.parse(JSON.stringify(window.INITIAL_APP_DATA.categories));
      state.employees = JSON.parse(JSON.stringify(window.INITIAL_APP_DATA.employees));
      state.tasks = JSON.parse(JSON.stringify(window.INITIAL_APP_DATA.tasks));

      // Ensure all tasks start with status in_progress and full dates in 2026
      state.tasks.forEach(t => {
        t.status = 'in_progress';
        if (t.deadline) {
          t.deadline = formatFullDate(t.deadline);
        }
      });

      // Fresh session: set timestamp to 0 so cloud data ALWAYS takes precedence
      state.lastSavedAt = 0;
      state.hasUnsavedLocalChanges = false;
      // Note: Do NOT call saveData here and do NOT push to cloud! Wait for cloud fetch!
    }
  }

  function saveData(showToast = true, skipCloud = false) {
    const timestamp = new Date().toISOString();
    state.lastSavedAt = timestamp;

    const payload = {
      categories: state.categories,
      employees: state.employees,
      tasks: state.tasks,
      savedAt: timestamp,
      lastModified: timestamp
    };

    // 1. Instant local persistence (survives F5 / browser reload 100%)
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));

    if (showToast) {
      notify('success', 'Đã lưu dữ liệu vào hệ thống!');
    }

    // 2. Real-time Cloud Sync to Google Apps Script / Google Sheet
    if (state.cloudApiUrl && !skipCloud) {
      state.hasUnsavedLocalChanges = true;
      updateSyncUI('syncing', 'Đang lưu máy chủ...');
      clearTimeout(state.syncDebounceTimer);
      state.syncDebounceTimer = setTimeout(() => {
        pushToCloud(payload);
      }, 400);
    } else {
      updateSyncUI(state.cloudApiUrl ? 'synced' : 'local');
    }
  }

  function pushToCloud(payload) {
    if (!state.cloudApiUrl) return;
    updateSyncUI('syncing', 'Đang lưu máy chủ...');

    const payloadStr = JSON.stringify(payload);

    // 1. Thử gửi POST với fetch thông thường (Content-Type: text/plain hỗ trợ CORS)
    fetch(state.cloudApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'text/plain;charset=utf-8'
      },
      body: payloadStr
    }).then(() => {
      state.hasUnsavedLocalChanges = false;
      updateSyncUI('synced', 'Đã đồng bộ máy chủ');
      console.log('Đồng bộ máy chủ thành công lúc:', new Date().toLocaleTimeString());
    }).catch(err => {
      // 2. Fallback sang no-cors nếu trình duyệt báo lỗi redirect CORS
      fetch(state.cloudApiUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: {
          'Content-Type': 'text/plain'
        },
        body: payloadStr
      }).then(() => {
        state.hasUnsavedLocalChanges = false;
        updateSyncUI('synced', 'Đã đồng bộ máy chủ');
      }).catch(e => {
        console.warn('Lỗi đồng bộ máy chủ:', e);
        updateSyncUI('local', 'Đã lưu máy (chờ kết nối)');
      });
    });
  }

  let jsonpCounter = 0;
  function pullFromCloud(manual = false) {
    if (!state.cloudApiUrl) {
      if (manual) notify('info', 'Chưa kích hoạt kết nối máy chủ');
      return;
    }

    if (manual) updateSyncUI('syncing', 'Đang tải máy chủ...');

    // Thử gọi fetch trực tiếp trước để có tốc độ cao nhất
    fetch(`${state.cloudApiUrl}?_t=${Date.now()}`)
      .then(res => res.json())
      .then(response => {
        handleCloudResponse(response, manual);
      })
      .catch(() => {
        // Nếu fetch bị chặn cross-origin, fallback dùng JSONP (chắc chắn thành công 100%)
        pullViaJsonp(manual);
      });
  }

  function pullViaJsonp(manual) {
    const callbackName = 'khvt_sync_cb_' + (++jsonpCounter) + '_' + Date.now();
    const script = document.createElement('script');
    const separator = state.cloudApiUrl.includes('?') ? '&' : '?';
    script.src = `${state.cloudApiUrl}${separator}callback=${callbackName}&_t=${Date.now()}`;

    let timeout = setTimeout(() => {
      cleanup();
      if (manual) {
        notify('warning', 'Hết thời gian chờ phản hồi từ máy chủ');
        updateSyncUI('synced', 'Đã đồng bộ máy chủ');
      }
    }, 12000);

    function cleanup() {
      clearTimeout(timeout);
      delete window[callbackName];
      if (script.parentNode) script.parentNode.removeChild(script);
    }

    window[callbackName] = function(response) {
      cleanup();
      handleCloudResponse(response, manual);
    };

    script.onerror = function() {
      cleanup();
      if (manual) {
        notify('error', 'Lỗi kết nối tới máy chủ');
      }
    };

    document.head.appendChild(script);
  }

  function handleCloudResponse(response, manual = false) {
    if (!response || response.status !== 'success' || !response.hasData || !response.data) {
      state.initialCloudSyncDone = true;
      if (manual) notify('info', 'Dữ liệu trên máy của bạn hiện là mới nhất');
      updateSyncUI('synced', 'Đã đồng bộ máy chủ');
      return;
    }

    const remoteData = response.data;
    if (!remoteData.tasks || !Array.isArray(remoteData.tasks) || remoteData.tasks.length === 0) {
      state.initialCloudSyncDone = true;
      return;
    }

    const remoteTime = new Date(remoteData.lastModified || remoteData.savedAt || 0).getTime();
    const localTime = state.lastSavedAt ? new Date(state.lastSavedAt).getTime() : 0;

    // ĐIỀU KIỆN ÁP DỤNG DỮ LIỆU TỪ MÁY CHỦ:
    // 1. Bấm làm mới thủ công (manual = true)
    // 2. Lần đầu tải trang web và chưa có chỉnh sửa mới trên máy (!state.initialCloudSyncDone && !state.hasUnsavedLocalChanges)
    // 3. Máy chưa có dữ liệu (state.lastSavedAt === 0)
    // 4. Máy chủ có bản ghi mới hơn thời gian lưu trên máy (remoteTime > localTime && !state.hasUnsavedLocalChanges)
    const shouldApply = manual ||
                        (!state.initialCloudSyncDone && !state.hasUnsavedLocalChanges) ||
                        !state.lastSavedAt ||
                        state.lastSavedAt === 0 ||
                        (remoteTime > localTime && !state.hasUnsavedLocalChanges);

    state.initialCloudSyncDone = true;

    if (shouldApply) {
      state.tasks = remoteData.tasks;
      if (remoteData.categories && Array.isArray(remoteData.categories)) {
        state.categories = remoteData.categories;
      }
      if (remoteData.employees && Array.isArray(remoteData.employees)) {
        state.employees = remoteData.employees;
        mergeEmployeeMetadata();
      }

      state.lastSavedAt = remoteData.lastModified || remoteData.savedAt || new Date().toISOString();
      state.hasUnsavedLocalChanges = false;

      // Lưu đệm vào localStorage để lần sau mở nhanh, TUYỆT ĐỐI KHÔNG gửi ngược lên đè máy chủ
      const cached = {
        categories: state.categories,
        employees: state.employees,
        tasks: state.tasks,
        savedAt: state.lastSavedAt,
        lastModified: state.lastSavedAt
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cached));

      render();
      updateQuickStats();
      updateSyncUI('synced', 'Đã đồng bộ máy chủ');

      if (manual) {
        notify('success', 'Đã cập nhật dữ liệu mới nhất từ máy chủ thành công!');
      }
    } else {
      updateSyncUI('synced', 'Đã đồng bộ máy chủ');
    }
  }

  function updateSyncUI(status, customLabel) {
    state.syncStatus = status;
    const dot = elements.syncStatusDot;
    const label = elements.syncStatusLabel;
    if (!dot || !label) return;

    dot.className = 'sync-status-dot';
    if (status === 'synced') {
      dot.classList.add('dot-synced');
      label.textContent = customLabel || (state.cloudApiUrl ? 'Đã đồng bộ máy chủ' : 'Đã lưu máy');
    } else if (status === 'syncing') {
      dot.classList.add('dot-syncing');
      label.textContent = customLabel || 'Đang lưu máy chủ...';
    } else if (status === 'local') {
      dot.classList.add('dot-local');
      label.textContent = customLabel || 'Đã lưu máy';
    } else if (status === 'error') {
      dot.classList.add('dot-error');
      label.textContent = customLabel || 'Lỗi kết nối';
    }

    updateSyncModalCard();
  }

  function updateSyncModalCard() {
    if (!elements.syncStatusCard) return;
    const card = elements.syncStatusCard;
    const icon = elements.syncStatusIcon;
    const title = elements.syncStatusTitle;
    const desc = elements.syncStatusDesc;
    const lastTime = elements.syncLastTime;

    card.className = 'sync-status-card';
    if (state.lastSavedAt && lastTime) {
      const d = new Date(state.lastSavedAt);
      lastTime.textContent = d.toLocaleTimeString('vi-VN') + ' ' + d.toLocaleDateString('vi-VN');
    }

    if (state.syncStatus === 'syncing') {
      card.classList.add('status-syncing');
      icon.textContent = '⏳';
      title.textContent = 'Đang đồng bộ dữ liệu...';
      desc.textContent = 'Hệ thống đang truyền dữ liệu công việc lên máy chủ đám mây EVNHCMC.';
    } else if (state.cloudApiUrl) {
      card.classList.add('status-synced');
      icon.textContent = '🟢';
      title.textContent = 'Hệ Thống Trực Tuyến & Đồng Bộ Tức Thì';
      desc.textContent = 'Toàn bộ dữ liệu phân công và tiến độ công việc được kết nối và đồng bộ 2 chiều tức thì với máy chủ đám mây EVNHCMC. Mọi thay đổi đều được bảo toàn 100%.';
    } else {
      card.classList.add('status-local');
      icon.textContent = '⚡';
      title.textContent = 'Lưu tự động trên trình duyệt (Ngoại tuyến)';
      desc.textContent = 'Mọi thao tác kéo thả phân công đều được lưu tức thì vào bộ nhớ trình duyệt. Khi có mạng trở lại, hệ thống sẽ tự động đồng bộ lên máy chủ.';
    }

    // Share URL group
    if (elements.shareUrlGroup && elements.shareUrlInput) {
      elements.shareUrlGroup.style.display = 'block';
      elements.shareUrlInput.value = window.location.origin + window.location.pathname;
    }
  }

  function openSyncModal() {
    if (!elements.syncModal) return;
    if (elements.fieldSyncUrl) {
      elements.fieldSyncUrl.value = state.cloudApiUrl || '';
    }
    updateSyncModalCard();
    elements.syncModal.classList.add('active');
  }

  function closeSyncModal() {
    if (!elements.syncModal) return;
    elements.syncModal.classList.remove('active');
  }

  function resetToDefault() {
    if (confirm('Bạn có chắc chắn muốn khôi phục toàn bộ dữ liệu phân công về mặc định từ file Excel ban đầu? Mọi thay đổi sẽ bị làm mới.')) {
      localStorage.removeItem(STORAGE_KEY);
      loadData();
      render();
      updateQuickStats();
      saveData(false);
      notify('info', 'Đã khôi phục dữ liệu gốc thành công!');
    }
  }

  // =========================================================================
  // EVENT LISTENERS
  // =========================================================================
  function setupEventListeners() {
    // Navigation Tabs
    elements.tabStaff.addEventListener('click', () => switchView('staff'));
    elements.tabCategory.addEventListener('click', () => switchView('category'));
    elements.tabDashboard.addEventListener('click', () => switchView('dashboard'));

    // Sidebar Toggle
    elements.toggleSidebarBtn.addEventListener('click', () => {
      elements.stagingSidebar.classList.toggle('collapsed');
    });

    // Save & Export & Reset
    elements.saveBtn.addEventListener('click', () => saveData(true));
    elements.resetBtn.addEventListener('click', resetToDefault);
    elements.exportBtn.addEventListener('click', exportToExcel);

    // Search
    elements.searchInput.addEventListener('input', (e) => {
      state.searchQuery = e.target.value.trim().toLowerCase();
      elements.searchClear.style.display = state.searchQuery ? 'block' : 'none';
      render();
    });

    elements.searchClear.addEventListener('click', () => {
      elements.searchInput.value = '';
      state.searchQuery = '';
      elements.searchClear.style.display = 'none';
      render();
    });

    // Create Task Buttons
    elements.createTaskBtn.addEventListener('click', () => openTaskModal());
    elements.sidebarCreateBtn.addEventListener('click', () => openTaskModal(null, true));

    // Modal Events
    elements.taskModalClose.addEventListener('click', closeTaskModal);
    elements.taskModalCancel.addEventListener('click', closeTaskModal);
    elements.taskForm.addEventListener('submit', handleTaskFormSubmit);
    elements.deleteTaskBtn.addEventListener('click', handleDeleteTask);

    // Staging Sidebar Dropzone Drag Events
    setupDropzone(elements.stagingDropzone, (taskId) => {
      moveToStaging(taskId);
    });

    // Sync status & Modal
    if (elements.syncConfigBtn) {
      elements.syncConfigBtn.addEventListener('click', openSyncModal);
    }
    if (elements.syncModalClose) {
      elements.syncModalClose.addEventListener('click', closeSyncModal);
    }
    if (elements.syncModal) {
      elements.syncModal.addEventListener('click', (e) => {
        if (e.target === elements.syncModal) closeSyncModal();
      });
    }
    if (elements.btnSyncNow) {
      elements.btnSyncNow.addEventListener('click', () => {
        pullFromCloud(true);
      });
    }
    if (elements.btnSaveSyncConfig) {
      elements.btnSaveSyncConfig.addEventListener('click', () => {
        const url = (elements.fieldSyncUrl ? elements.fieldSyncUrl.value.trim() : '') || DEFAULT_CLOUD_API;
        state.cloudApiUrl = url;
        localStorage.setItem(SYNC_URL_KEY, url);
        notify('success', 'Đã lưu thiết lập máy chủ thành công!');
        saveData(false); // Push current state to the URL
        updateSyncUI('synced', 'Đã đồng bộ máy chủ');
        updateSyncModalCard();
        closeSyncModal();
      });
    }
    if (elements.btnCopyShareUrl) {
      elements.btnCopyShareUrl.addEventListener('click', () => {
        if (elements.shareUrlInput && elements.shareUrlInput.value) {
          navigator.clipboard.writeText(elements.shareUrlInput.value).then(() => {
            notify('success', 'Đã sao chép link tự động đồng bộ vào bộ nhớ tạm!');
          }).catch(() => {
            elements.shareUrlInput.select();
            document.execCommand('copy');
            notify('success', 'Đã sao chép liên kết!');
          });
        }
      });
    }

    // Cross-tab auto sync (instant sync across multiple browser tabs)
    window.addEventListener('storage', (e) => {
      if (e.key === STORAGE_KEY && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed.tasks) state.tasks = parsed.tasks;
          if (parsed.categories) state.categories = parsed.categories;
          if (parsed.employees) state.employees = parsed.employees;
          state.lastSavedAt = parsed.savedAt || new Date().toISOString();
          mergeEmployeeMetadata();
          render();
          updateQuickStats();
          updateSyncUI(state.cloudApiUrl ? 'synced' : 'local', 'Đã cập nhật');
        } catch (err) {
          console.error('Storage sync error:', err);
        }
      }
    });

    // Cloud polling on window focus & tab visibility
    window.addEventListener('focus', () => {
      if (state.cloudApiUrl) pullFromCloud(false);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && state.cloudApiUrl) {
        pullFromCloud(false);
      }
    });
  }

  function switchView(viewName) {
    state.activeView = viewName;
    elements.tabStaff.classList.toggle('active', viewName === 'staff');
    elements.tabCategory.classList.toggle('active', viewName === 'category');
    elements.tabDashboard.classList.toggle('active', viewName === 'dashboard');
    render();
  }

  // =========================================================================
  // TOAST NOTIFICATIONS
  // =========================================================================
  function notify(type, message) {
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    const icon = type === 'success' ? '✓' : 'ℹ';
    toast.innerHTML = `<span><strong>${icon}</strong> ${message}</span>`;
    elements.toastContainer.appendChild(toast);

    setTimeout(() => toast.classList.add('show'), 10);
    setTimeout(() => {
      toast.classList.remove('show');
      setTimeout(() => toast.remove(), 300);
    }, 3500);
  }

  // =========================================================================
  // DRAG AND DROP HANDLING
  // =========================================================================
  function makeTaskCardDraggable(cardElement, task) {
    cardElement.setAttribute('draggable', 'true');
    cardElement.dataset.taskId = task.id;

    cardElement.addEventListener('dragstart', (e) => {
      state.draggedTaskId = task.id;
      cardElement.classList.add('dragging');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', task.id);
    });

    cardElement.addEventListener('dragend', () => {
      cardElement.classList.remove('dragging');
      state.draggedTaskId = null;
      document.querySelectorAll('.drag-over').forEach(el => el.classList.remove('drag-over'));
    });

    // Clicking card opens edit modal (except when clicking interactive child elements)
    cardElement.addEventListener('click', (e) => {
      if (e.target.closest('.no-click-modal')) return;
      openTaskModal(task.id);
    });
  }

  function setupDropzone(dropzoneElement, onDropCallback) {
    dropzoneElement.addEventListener('dragover', (e) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      dropzoneElement.classList.add('drag-over');
    });

    dropzoneElement.addEventListener('dragleave', (e) => {
      if (!dropzoneElement.contains(e.relatedTarget)) {
        dropzoneElement.classList.remove('drag-over');
      }
    });

    dropzoneElement.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzoneElement.classList.remove('drag-over');
      const taskId = e.dataTransfer.getData('text/plain') || state.draggedTaskId;
      if (taskId) {
        onDropCallback(taskId);
      }
    });
  }

  function assignTaskToEmployee(taskId, empId) {
    const task = state.tasks.find(t => t.id === taskId);
    const emp = state.employees.find(e => e.id === empId);
    if (!task || !emp) return;

    task.in_staging = false;
    task.assignee_ids = [empId];
    task.assignee_text = emp.name;

    saveData(false);
    render();
    updateQuickStats();
    notify('success', `Đã phân công việc cho <strong>${emp.name}</strong>`);
  }

  function assignTaskToCategory(taskId, catId) {
    const task = state.tasks.find(t => t.id === taskId);
    const cat = state.categories.find(c => c.id === catId);
    if (!task || !cat) return;

    task.category_id = catId;
    task.category = cat.title;
    if (catId === 'cat_4_2026') {
      task.subcategory = 'Năm 2026';
    } else if (catId === 'cat_4_2027') {
      task.subcategory = 'Năm 2027';
    } else {
      task.subcategory = '';
    }

    saveData(false);
    render();
    updateQuickStats();
    notify('info', `Đã chuyển việc sang nhóm: <strong>${cat.title}</strong>`);
  }

  function moveToStaging(taskId) {
    const task = state.tasks.find(t => t.id === taskId);
    if (!task) return;

    task.in_staging = true;
    task.assignee_ids = [];
    task.assignee_text = 'Chưa phân công (Danh sách chờ)';

    saveData(false);
    render();
    updateQuickStats();
    notify('info', `Đã chuyển công việc vào <strong>Danh sách chờ</strong>`);
  }

  // =========================================================================
  // RENDER CONTROLLER
  // =========================================================================
  function render() {
    renderStagingSidebar();

    if (state.activeView === 'staff') {
      renderStaffView();
    } else if (state.activeView === 'category') {
      renderCategoryView();
    } else if (state.activeView === 'dashboard') {
      renderDashboardView();
    }
  }

  function updateQuickStats() {
    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.status === 'completed').length;
    const pending = state.tasks.filter(t => t.in_staging || !t.assignee_ids || t.assignee_ids.length === 0).length;
    const assigned = total - pending;

    elements.quickTotal.textContent = total;
    elements.quickAssigned.textContent = assigned;
    elements.quickCompleted.textContent = completed;
    elements.quickPending.textContent = pending;
  }

  // =========================================================================
  // 1. RENDER STAGING SIDEBAR (DANH SÁCH CHỜ)
  // =========================================================================
  function renderStagingSidebar() {
    elements.stagingDropzone.innerHTML = '';
    
    const stagingTasks = state.tasks.filter(t => t.in_staging || !t.assignee_ids || t.assignee_ids.length === 0);
    elements.stagingCounter.textContent = stagingTasks.length;

    if (stagingTasks.length === 0) {
      elements.stagingDropzone.innerHTML = `
        <div class="staging-placeholder">
          <div class="staging-placeholder-icon">📥</div>
          <strong>Kéo công việc vào đây</strong><br>
          để tạm giữ hoặc nhấn <em>"+ Thêm mới"</em> để tạo việc chờ phân công.
        </div>
      `;
      return;
    }

    stagingTasks.forEach(task => {
      const card = createTaskCardElement(task, { showAssignees: false });
      elements.stagingDropzone.appendChild(card);
    });
  }

  // =========================================================================
  // 2. RENDER VIEW: XEM THEO NHÂN VIÊN (STAFF KANBAN VIEW)
  // =========================================================================
  function renderStaffView() {
    elements.mainContent.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'staff-view-container';

    // Group employees by Teams
    const teams = [
      { id: 'BLĐ', name: 'Ban Lãnh đạo Phòng', icon: '🏛️', class: 'team-bld' },
      { id: 'TKH', name: 'Tổ Kế hoạch', icon: '📊', class: 'team-tkh' },
      { id: 'TVT', name: 'Tổ Vật tư', icon: '📦', class: 'team-tvt' },
      { id: 'EXT', name: 'Đơn vị phối hợp ngoài phòng', icon: '🤝', class: 'team-ext' }
    ];

    teams.forEach(team => {
      const teamEmps = state.employees.filter(e => e.team === team.id);
      if (teamEmps.length === 0) return;

      let teamTaskCount = 0;
      teamEmps.forEach(emp => {
        teamTaskCount += state.tasks.filter(t => !t.in_staging && t.assignee_ids && t.assignee_ids.includes(emp.id)).length;
      });

      const section = document.createElement('div');
      section.className = `team-group-section ${team.class}`;

      section.innerHTML = `
        <div class="team-group-header">
          <div class="team-title-wrap">
            <div class="team-icon">${team.icon}</div>
            <h3 class="team-name">${team.name}</h3>
          </div>
          <span class="team-stats-badge">${teamEmps.length} nhân sự • ${teamTaskCount} việc</span>
        </div>
        <div class="staff-columns-grid" id="team_grid_${team.id}"></div>
      `;

      container.appendChild(section);
      const grid = section.querySelector(`#team_grid_${team.id}`);

      teamEmps.forEach(emp => {
        const empCol = createEmployeeColumn(emp);
        grid.appendChild(empCol);
      });
    });

    elements.mainContent.appendChild(container);
  }

  function createEmployeeColumn(emp) {
    const col = document.createElement('div');
    col.className = 'employee-column';
    col.dataset.empId = emp.id;

    // Get tasks assigned to this employee
    let empTasks = state.tasks.filter(t => !t.in_staging && t.assignee_ids && t.assignee_ids.includes(emp.id));

    // Filter by search query if any
    if (state.searchQuery) {
      empTasks = empTasks.filter(t => 
        t.title.toLowerCase().includes(state.searchQuery) ||
        t.detail.toLowerCase().includes(state.searchQuery) ||
        (t.category && t.category.toLowerCase().includes(state.searchQuery))
      );
    }

    const initials = getInitials(emp.name);
    const photoUrl = emp.local_photo || emp.photo;
    const isExternal = (emp.team === 'EXT') || (emp.dept_short && emp.dept_short !== 'KHVT');

    col.innerHTML = `
      <div class="employee-header ${isExternal ? 'is-external-header' : ''}">
        <div class="employee-avatar-wrap">
          ${photoUrl ? `
            <img class="employee-avatar-img" src="${photoUrl}" alt="${emp.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
            <div class="employee-avatar-fallback ${isExternal ? 'fallback-external' : ''}" style="display:none;">${initials}</div>
          ` : `
            <div class="employee-avatar-fallback ${isExternal ? 'fallback-external' : ''}">${initials}</div>
          `}
        </div>
        <div class="employee-info">
          <div class="employee-name" title="${emp.name}">${emp.name}</div>
          <div class="employee-role" title="${emp.position}">${emp.position}</div>
          ${isExternal ? `<div class="employee-ext-tag">🤝 Ngoài phòng (${emp.dept_short || 'Phối hợp'})</div>` : ''}
        </div>
        <div class="employee-task-count" title="Số lượng công việc">${empTasks.length} việc</div>
      </div>
      <div class="employee-tasks-dropzone" id="dropzone_${emp.id}"></div>
    `;

    const dropzone = col.querySelector(`#dropzone_${emp.id}`);

    setupDropzone(dropzone, (taskId) => {
      assignTaskToEmployee(taskId, emp.id);
    });

    if (empTasks.length === 0) {
      dropzone.innerHTML = `
        <div class="empty-task-placeholder">
          Chưa có việc • Thả việc vào đây
        </div>
      `;
    } else {
      empTasks.forEach(task => {
        const card = createTaskCardElement(task, { showAssignees: false, currentEmpId: emp.id });
        dropzone.appendChild(card);
      });
    }

    return col;
  }

  // =========================================================================
  // 3. RENDER VIEW: XEM THEO CÔNG VIỆC (CATEGORY KANBAN VIEW)
  // =========================================================================
  function renderCategoryView() {
    elements.mainContent.innerHTML = '';

    const grid = document.createElement('div');
    grid.className = 'category-view-grid';

    state.categories.forEach(cat => {
      let catTasks = state.tasks.filter(t => t.category_id === cat.id && !t.in_staging);

      if (state.searchQuery) {
        catTasks = catTasks.filter(t => 
          t.title.toLowerCase().includes(state.searchQuery) ||
          t.detail.toLowerCase().includes(state.searchQuery) ||
          t.assignee_text.toLowerCase().includes(state.searchQuery)
        );
      }

      const card = document.createElement('div');
      card.className = 'category-card';
      card.dataset.catId = cat.id;

      card.innerHTML = `
        <div class="category-header" style="background: ${cat.bg_color}; border-color: ${cat.border_color};">
          <div class="category-header-title" style="color: ${cat.color};">
            <span>🏷️</span>
            <span>${cat.title}</span>
          </div>
          <span class="category-badge-count" style="color: ${cat.color};">${catTasks.length} việc</span>
        </div>
        <div class="category-tasks-dropzone" id="cat_dropzone_${cat.id}"></div>
      `;

      const dropzone = card.querySelector(`#cat_dropzone_${cat.id}`);
      setupDropzone(dropzone, (taskId) => {
        assignTaskToCategory(taskId, cat.id);
      });

      if (catTasks.length === 0) {
        dropzone.innerHTML = `
          <div class="empty-task-placeholder">
            Chưa có công việc nào thuộc nhóm này
          </div>
        `;
      } else {
        catTasks.forEach(task => {
          const taskCard = createTaskCardElement(task, { showAssignees: true });
          dropzone.appendChild(taskCard);
        });
      }

      grid.appendChild(card);
    });

    elements.mainContent.appendChild(grid);
  }

  // =========================================================================
  // 4. RENDER VIEW: DASHBOARD & THỐNG KÊ TỔNG QUAN
  // =========================================================================
  function renderDashboardView() {
    elements.mainContent.innerHTML = '';

    const container = document.createElement('div');
    container.className = 'dashboard-container';

    const total = state.tasks.length;
    const completed = state.tasks.filter(t => t.status === 'completed').length;
    const inProgress = state.tasks.filter(t => t.status === 'in_progress' && !t.in_staging && t.assignee_ids && t.assignee_ids.length > 0).length;
    const pending = state.tasks.filter(t => t.in_staging || !t.assignee_ids || t.assignee_ids.length === 0).length;

    // KPI Cards
    const kpiRow = document.createElement('div');
    kpiRow.className = 'dashboard-kpi-row';
    kpiRow.innerHTML = `
      <div class="kpi-card kpi-blue">
        <div class="kpi-info">
          <span class="kpi-label">Tổng số công việc</span>
          <span class="kpi-value">${total}</span>
          <span class="kpi-subtext">Danh mục phòng KHVT</span>
        </div>
        <div class="kpi-icon-wrap">📋</div>
      </div>
      <div class="kpi-card kpi-amber">
        <div class="kpi-info">
          <span class="kpi-label">Đang thực hiện</span>
          <span class="kpi-value">${inProgress}</span>
          <span class="kpi-subtext">Đã phân công CBCNV</span>
        </div>
        <div class="kpi-icon-wrap">⏳</div>
      </div>
      <div class="kpi-card kpi-green">
        <div class="kpi-info">
          <span class="kpi-label">Đã hoàn thành</span>
          <span class="kpi-value">${completed}</span>
          <span class="kpi-subtext">Hoàn tất công tác</span>
        </div>
        <div class="kpi-icon-wrap">✅</div>
      </div>
      <div class="kpi-card kpi-purple">
        <div class="kpi-info">
          <span class="kpi-label">Danh sách chờ</span>
          <span class="kpi-value">${pending}</span>
          <span class="kpi-subtext">Chưa gán nhân sự</span>
        </div>
        <div class="kpi-icon-wrap">📥</div>
      </div>
    `;
    container.appendChild(kpiRow);

    // 2-Column Panels: Workload Distribution & Category Breakdown
    const grid2 = document.createElement('div');
    grid2.className = 'dashboard-grid-2col';

    // 1. Separate internal KHVT staff vs External coordination staff
    const internalEmps = state.employees.filter(e => e.team !== 'EXT' && e.dept_short === 'KHVT');
    const externalEmps = state.employees.filter(e => e.team === 'EXT' || (e.dept_short && e.dept_short !== 'KHVT'));

    const internalWorkloadList = internalEmps.map(emp => {
      const count = state.tasks.filter(t => !t.in_staging && t.assignee_ids && t.assignee_ids.includes(emp.id)).length;
      return { emp, count };
    }).sort((a, b) => b.count - a.count);

    const maxCount = Math.max(...internalWorkloadList.map(w => w.count), 1);

    const leftCol = document.createElement('div');
    leftCol.className = 'dashboard-left-col';

    // Frame 1: Phân bổ khối lượng công việc - Nội bộ Phòng Kế hoạch và Vật tư
    const internalPanel = document.createElement('div');
    internalPanel.className = 'dashboard-panel';
    internalPanel.innerHTML = `
      <div class="panel-header">
        <div>
          <h4 class="panel-title">👥 Phân bổ khối lượng công việc theo Nhân sự</h4>
          <span style="font-size: 11.5px; color: var(--text-muted);">Nội bộ Phòng Kế hoạch và Vật tư (${internalWorkloadList.length} CBCNV)</span>
        </div>
        <span style="font-size: 11px; color: var(--text-muted); font-weight: 500;">Sắp xếp theo số việc</span>
      </div>
      <div class="workload-chart-list">
        ${internalWorkloadList.map(item => {
          const photoUrl = item.emp.local_photo || item.emp.photo;
          const initials = getInitials(item.emp.name);
          const barPercent = item.count > 0 ? Math.max(Math.round((item.count / maxCount) * 100), 10) : 0;

          return `
            <div class="workload-bar-item">
              <div class="workload-avatar-wrap">
                ${photoUrl ? `
                  <img class="workload-avatar-img" src="${photoUrl}" alt="${item.emp.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                  <span class="workload-avatar-fallback" style="display:none;">${initials}</span>
                ` : `
                  <span class="workload-avatar-fallback">${initials}</span>
                `}
              </div>
              <div class="workload-staff-info">
                <span class="workload-staff-name" title="${item.emp.name} (${item.emp.position})">${item.emp.name}</span>
                <div class="workload-sub-row">
                  <span class="workload-role-text">${item.emp.position}</span>
                </div>
              </div>
              <div class="workload-track">
                <div class="workload-fill" style="width: ${barPercent}%;">
                  ${item.count > 0 ? `${item.count}` : ''}
                </div>
              </div>
              <span class="workload-count">${item.count} việc</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
    leftCol.appendChild(internalPanel);

    // Frame 2 (Riêng biệt): Đơn vị phối hợp ngoài phòng
    const externalWorkloadList = externalEmps.map(emp => {
      const count = state.tasks.filter(t => !t.in_staging && t.assignee_ids && t.assignee_ids.includes(emp.id)).length;
      return { emp, count };
    });

    const externalPanel = document.createElement('div');
    externalPanel.className = 'dashboard-panel external-coordination-panel';
    externalPanel.innerHTML = `
      <div class="panel-header">
        <div>
          <h4 class="panel-title">🤝 Đơn vị phối hợp ngoài phòng</h4>
          <span style="font-size: 11.5px; color: var(--text-muted);">Cán bộ chuyên môn các đơn vị phối hợp cùng phòng KHVT</span>
        </div>
        <span class="external-count-badge">${externalWorkloadList.length} nhân sự phối hợp</span>
      </div>
      <div class="external-staff-list">
        ${externalWorkloadList.map(item => {
          const extTasks = state.tasks.filter(t => !t.in_staging && t.assignee_ids && t.assignee_ids.includes(item.emp.id));
          const photoUrl = item.emp.local_photo || item.emp.photo;
          const initials = getInitials(item.emp.name);

          return `
            <div class="external-coordination-card">
              <div class="external-coordination-header">
                <div class="workload-avatar-wrap" style="width: 38px; height: 38px;">
                  ${photoUrl ? `
                    <img class="workload-avatar-img" src="${photoUrl}" alt="${item.emp.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='flex';" />
                    <span class="workload-avatar-fallback fallback-external" style="display:none;">${initials}</span>
                  ` : `
                    <span class="workload-avatar-fallback fallback-external">${initials}</span>
                  `}
                </div>
                <div class="external-header-info">
                  <div class="external-name-row">
                    <strong class="external-emp-name">${item.emp.name}</strong>
                    <span class="external-dept-tag">🤝 ${item.emp.dept_full || item.emp.dept_short || 'Đơn vị ngoài phòng'}</span>
                  </div>
                  <div class="external-role-text">${item.emp.position}</div>
                </div>
                <div class="external-task-pill">${item.count} việc phối hợp</div>
              </div>

              <div class="external-tasks-list">
                ${extTasks.length > 0 ? extTasks.map(t => `
                  <div class="external-task-item" data-task-id="${t.id}" title="Nhấn để xem chi tiết công việc">
                    <span class="ext-task-icon">📌</span>
                    <span class="ext-task-title">${escapeHtml(t.title)}</span>
                    <span class="ext-task-deadline">📅 ${formatFullDate(t.deadline) || '2026'}</span>
                  </div>
                `).join('') : `
                  <div style="font-size: 11.5px; color: var(--text-muted); font-style: italic; padding: 4px 0;">Hiện chưa có công việc phân công trực tiếp</div>
                `}
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    // Click handler for task item in external frame
    externalPanel.querySelectorAll('.external-task-item').forEach(el => {
      el.addEventListener('click', () => {
        const tid = el.dataset.taskId;
        if (tid) openTaskModal(tid);
      });
    });

    leftCol.appendChild(externalPanel);
    grid2.appendChild(leftCol);

    // Category Breakdown: Parent-Child hierarchy for Section IV
    const rightPanel = document.createElement('div');
    rightPanel.className = 'dashboard-panel';

    const cat1Count = state.tasks.filter(t => t.category_id === 'cat_1').length;
    const cat2Count = state.tasks.filter(t => t.category_id === 'cat_2').length;
    const cat3Count = state.tasks.filter(t => t.category_id === 'cat_3').length;
    const cat4_2026Count = state.tasks.filter(t => t.category_id === 'cat_4_2026' || t.subcategory === 'Năm 2026').length;
    const cat4_2027Count = state.tasks.filter(t => t.category_id === 'cat_4_2027' || t.subcategory === 'Năm 2027').length;
    const cat4_totalCount = cat4_2026Count + cat4_2027Count;
    const cat5Count = state.tasks.filter(t => t.category_id === 'cat_5').length;
    const catbCount = state.tasks.filter(t => t.category_id === 'cat_b').length;

    rightPanel.innerHTML = `
      <div class="panel-header">
        <div>
          <h4 class="panel-title">🏷️ Cơ cấu công việc theo Nhóm công tác</h4>
          <span style="font-size: 11px; color: var(--text-muted);">Phân lớp mục IV (ĐTXD 2026 + 2027)</span>
        </div>
      </div>
      <div class="category-stat-list">
        <!-- I. Công tác kế hoạch -->
        <div class="category-stat-item" style="border-left-color: #2563eb;">
          <span class="category-stat-name">I. Công tác kế hoạch</span>
          <span class="category-stat-count">${cat1Count} việc</span>
        </div>

        <!-- II. Công tác Sửa chữa lớn 2026-2027 -->
        <div class="category-stat-item" style="border-left-color: #059669;">
          <span class="category-stat-name">II. Công tác Sửa chữa lớn 2026-2027</span>
          <span class="category-stat-count">${cat2Count} việc</span>
        </div>

        <!-- III. Công tác chỉnh trang dây thông tin 2026 -->
        <div class="category-stat-item" style="border-left-color: #d97706;">
          <span class="category-stat-name">III. Công tác chỉnh trang dây thông tin 2026</span>
          <span class="category-stat-count">${cat3Count} việc</span>
        </div>

        <!-- IV. Công tác ĐTXD (Cấp cha) -->
        <div class="category-stat-item category-stat-parent">
          <div class="category-parent-header">
            <span class="category-parent-icon">🏗️</span>
            <span class="category-stat-name">IV. Công tác ĐTXD</span>
          </div>
          <span class="category-stat-count parent-count">${cat4_totalCount} việc</span>
        </div>

        <!-- IV. Năm 2026 (Cấp con) -->
        <div class="category-stat-item category-stat-child">
          <div class="category-child-label">
            <span class="tree-line">↳</span>
            <span class="category-stat-name">Năm 2026</span>
          </div>
          <span class="category-stat-count child-count">${cat4_2026Count} việc</span>
        </div>

        <!-- IV. Năm 2027 (Cấp con) -->
        <div class="category-stat-item category-stat-child">
          <div class="category-child-label">
            <span class="tree-line">↳</span>
            <span class="category-stat-name">Năm 2027</span>
          </div>
          <span class="category-stat-count child-count">${cat4_2027Count} việc</span>
        </div>

        <!-- V. Công tác đấu thầu -->
        <div class="category-stat-item" style="border-left-color: #db2777;">
          <span class="category-stat-name">V. Công tác đấu thầu</span>
          <span class="category-stat-count">${cat5Count} việc</span>
        </div>

        <!-- B. Công tác Tổ Vật tư -->
        <div class="category-stat-item" style="border-left-color: #0d9488;">
          <span class="category-stat-name">B. Công tác Tổ Vật tư</span>
          <span class="category-stat-count">${catbCount} việc</span>
        </div>
      </div>
    `;
    grid2.appendChild(rightPanel);

    container.appendChild(grid2);
    elements.mainContent.appendChild(container);
  }

  // =========================================================================
  // TASK CARD COMPONENT BUILDER (UPDATED PER USER REQUEST)
  // - No Roman numerals
  // - No '#' STT numbers
  // - No default detail shown, interactive toggle button instead
  // - Specific sub-assignment highlighted for that employee
  // - Full date (DD/MM/2026)
  // =========================================================================
  function createTaskCardElement(task, options = {}) {
    const card = document.createElement('div');
    card.className = 'task-card';
    card.dataset.taskId = task.id;

    // Check specific sub-assignment for this employee if in staff view
    let subAssignmentText = '';
    if (options.currentEmpId && task.sub_assignments && task.sub_assignments[options.currentEmpId]) {
      subAssignmentText = task.sub_assignments[options.currentEmpId];
    }

    // Build Assignees Chips if in Category view
    let assigneesHtml = '';
    if (options.showAssignees) {
      if (task.assignee_ids && task.assignee_ids.length > 0) {
        const assignedEmps = state.employees.filter(e => task.assignee_ids.includes(e.id));
        assigneesHtml = `
          <div class="task-assignees-list">
            ${assignedEmps.map(e => {
              const pUrl = e.local_photo || e.photo;
              return `
                <span class="assignee-chip" title="${e.name} - ${e.position}">
                  ${pUrl ? `
                    <img class="assignee-chip-mini-photo" src="${pUrl}" alt="${e.name}" onerror="this.style.display='none'; this.nextElementSibling.style.display='inline-flex';" />
                    <span class="assignee-chip-mini-avatar" style="display:none;">${getInitials(e.name)}</span>
                  ` : `
                    <span class="assignee-chip-mini-avatar">${getInitials(e.name)}</span>
                  `}
                  <span class="assignee-chip-name">${e.short_name || e.name}</span>
                </span>
              `;
            }).join('')}
          </div>
        `;
      } else {
        assigneesHtml = `
          <div class="task-assignees-list">
            <span class="assignee-chip" style="color: #ef4444; background: #fef2f2; border-color: #fecaca;">
              ⚠️ Chưa phân công
            </span>
          </div>
        `;
      }
    }

    // Multi-assignees breakdown list for expandable box in category view
    let subBreakdownHtml = '';
    if (options.showAssignees && task.sub_assignments && Object.keys(task.sub_assignments).length > 0) {
      subBreakdownHtml = `
        <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; color: #166534; font-size: 11.5px;">
          <strong>🎯 Phân công cụ thể:</strong>
          <ul style="margin: 4px 0 0 16px; padding: 0;">
            ${Object.entries(task.sub_assignments).map(([eId, subText]) => `
              <li style="margin-bottom: 2px;"><strong>${getShortName(eId)}:</strong> ${escapeHtml(subText)}</li>
            `).join('')}
          </ul>
        </div>
      `;
    }

    card.innerHTML = `
      <!-- Title only, NO Roman numeral, NO '#' STT -->
      <div class="task-title">${escapeHtml(task.title)}</div>

      <!-- Specific assignment badge if applicable -->
      ${subAssignmentText ? `
        <div class="task-sub-assigned-box">
          <strong>🎯 Phân công:</strong> ${escapeHtml(subAssignmentText)}
        </div>
      ` : ''}

      <!-- Assignees list (in Category view) -->
      ${assigneesHtml}

      <!-- Detail toggle button -->
      <div>
        <button type="button" class="task-detail-toggle-btn no-click-modal" title="Bấm để xem/thu gọn chi tiết">
          <span>Chi tiết</span> <span class="toggle-arrow">▾</span>
        </button>
      </div>

      <!-- Expandable Detail (Hidden by default) -->
      <div class="task-detail-expandable no-click-modal" style="display: none;">
        <div style="font-weight: 700; margin-bottom: 4px; color: #1e293b;">Nội dung công việc:</div>
        <div>${escapeHtml(task.detail || task.title)}</div>
        ${subAssignmentText ? `
          <div style="margin-top: 8px; padding-top: 6px; border-top: 1px dashed #cbd5e1; color: #166534;">
            <strong>🎯 Nhiệm vụ cụ thể:</strong> ${escapeHtml(subAssignmentText)}
          </div>
        ` : ''}
        ${subBreakdownHtml}
      </div>

      <!-- Footer: Full Date, Follower & Status -->
      <div class="task-card-footer">
        <div>
          ${task.deadline ? `
            <span class="task-deadline" title="Thời hạn hoàn thành">
              📅 ${formatFullDate(task.deadline)}
            </span>
          ` : ''}
          ${task.follower_text ? `
            <span class="task-follower" title="Theo dõi: ${escapeHtml(task.follower_text)}">
              👁️ ${task.follower_ids && task.follower_ids.length > 0 ? getShortName(task.follower_ids[0]) : escapeHtml(task.follower_text.substring(0, 15))}
            </span>
          ` : ''}
        </div>
        <span class="task-status-chip ${task.status === 'completed' ? 'task-status-completed' : 'task-status-inprogress'}">
          ${task.status === 'completed' ? '✓ Xong' : '● Đang làm'}
        </span>
      </div>
    `;

    // Bind Expand/Collapse Event
    const toggleBtn = card.querySelector('.task-detail-toggle-btn');
    const expandBox = card.querySelector('.task-detail-expandable');
    const toggleArrow = card.querySelector('.toggle-arrow');
    const toggleSpan = toggleBtn.querySelector('span');

    if (toggleBtn && expandBox) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        const isShown = expandBox.style.display === 'block';
        expandBox.style.display = isShown ? 'none' : 'block';
        toggleSpan.textContent = isShown ? 'Chi tiết' : 'Thu gọn';
        toggleArrow.textContent = isShown ? '▾' : '▴';
      });
    }

    makeTaskCardDraggable(card, task);
    return card;
  }

  // =========================================================================
  // TASK MODAL: CREATE & EDIT
  // =========================================================================
  function populateFormSelects() {
    elements.fieldCategory.innerHTML = state.categories.map(cat => `
      <option value="${cat.id}">${cat.title}</option>
    `).join('');

    const teams = [
      { id: 'BLĐ', name: 'Ban Lãnh đạo Phòng' },
      { id: 'TKH', name: 'Tổ Kế hoạch' },
      { id: 'TVT', name: 'Tổ Vật tư' },
      { id: 'EXT', name: 'Đơn vị phối hợp ngoài phòng' }
    ];

    let assigneeOpts = `<option value="">-- Chưa phân công (Đưa vào Danh sách chờ) --</option>`;
    teams.forEach(team => {
      const emps = state.employees.filter(e => e.team === team.id);
      if (emps.length > 0) {
        assigneeOpts += `<optgroup label="${team.name}">`;
        emps.forEach(emp => {
          assigneeOpts += `<option value="${emp.id}">${emp.name} - ${emp.position}</option>`;
        });
        assigneeOpts += `</optgroup>`;
      }
    });
    elements.fieldAssignee.innerHTML = assigneeOpts;

    let followerOpts = `
      <option value="">-- Không có / Tự theo dõi --</option>
      <option value="emp_006552">Nguyễn Mạnh Hiệp (Trưởng phòng)</option>
      <option value="emp_012229">Lê Trung Hiếu (Phó trưởng phòng)</option>
      <option value="emp_012732">Lê Anh Ngọc (Tổ trưởng Kế hoạch)</option>
      <option value="emp_011892">Vũ Hoành Sơn (Tổ trưởng Vật tư)</option>
    `;
    elements.fieldFollower.innerHTML = followerOpts;
  }

  function openTaskModal(taskId = null, isStagingOnly = false) {
    state.editingTaskId = taskId;

    if (taskId) {
      const task = state.tasks.find(t => t.id === taskId);
      if (!task) return;

      elements.taskModalTitle.innerHTML = `✏️ Chỉnh sửa công việc: ${escapeHtml(task.title.substring(0, 35))}...`;
      elements.fieldTaskId.value = task.id;
      elements.fieldTitle.value = task.title;
      elements.fieldDetail.value = task.detail || '';
      elements.fieldCategory.value = task.category_id || state.categories[0].id;
      elements.fieldAssignee.value = (task.assignee_ids && task.assignee_ids[0]) || '';
      elements.fieldFollower.value = (task.follower_ids && task.follower_ids[0]) || '';
      elements.fieldDeadline.value = formatFullDate(task.deadline) || '';
      elements.fieldStatus.value = task.status || 'in_progress';
      elements.fieldPriority.value = task.priority || 'normal';
      elements.deleteTaskBtn.style.display = 'inline-flex';
    } else {
      elements.taskModalTitle.innerHTML = `➕ Thêm mới công việc phòng KHVT`;
      elements.taskForm.reset();
      elements.fieldTaskId.value = '';
      elements.fieldCategory.value = state.categories[0].id;
      elements.fieldStatus.value = 'in_progress';
      elements.fieldPriority.value = 'normal';
      if (isStagingOnly) {
        elements.fieldAssignee.value = '';
      }
      elements.deleteTaskBtn.style.display = 'none';
    }

    elements.taskModal.classList.add('active');
  }

  function closeTaskModal() {
    elements.taskModal.classList.remove('active');
    state.editingTaskId = null;
  }

  function handleTaskFormSubmit(e) {
    e.preventDefault();

    const title = elements.fieldTitle.value.trim();
    if (!title) {
      alert('Vui lòng nhập tên công việc!');
      return;
    }

    const detail = elements.fieldDetail.value.trim() || title;
    const catId = elements.fieldCategory.value;
    const cat = state.categories.find(c => c.id === catId);
    const assigneeId = elements.fieldAssignee.value;
    const followerId = elements.fieldFollower.value;
    const deadline = formatFullDate(elements.fieldDeadline.value.trim());
    const status = elements.fieldStatus.value;
    const priority = elements.fieldPriority.value;

    const assigneeEmp = state.employees.find(e => e.id === assigneeId);
    const followerEmp = state.employees.find(e => e.id === followerId);

    if (state.editingTaskId) {
      const task = state.tasks.find(t => t.id === state.editingTaskId);
      if (task) {
        task.title = title;
        task.detail = detail;
        task.category_id = catId;
        task.category = cat ? cat.title : '';
        task.assignee_ids = assigneeId ? [assigneeId] : [];
        task.assignee_text = assigneeEmp ? assigneeEmp.name : 'Chưa phân công (Danh sách chờ)';
        task.follower_ids = followerId ? [followerId] : [];
        task.follower_text = followerEmp ? followerEmp.name : '';
        task.deadline = deadline;
        task.status = status;
        task.priority = priority;
        task.in_staging = !assigneeId;

        saveData(false);
        notify('success', 'Đã cập nhật công việc thành công!');
      }
    } else {
      const newId = `task_${Date.now()}`;
      const newTask = {
        id: newId,
        stt: `${state.tasks.length + 1}`,
        title: title,
        detail: detail,
        section: cat ? cat.section : '',
        category: cat ? cat.title : '',
        subcategory: catId === 'cat_4_2026' ? 'Năm 2026' : (catId === 'cat_4_2027' ? 'Năm 2027' : ''),
        category_id: catId,
        assignee_ids: assigneeId ? [assigneeId] : [],
        assignee_text: assigneeEmp ? assigneeEmp.name : 'Chưa phân công (Danh sách chờ)',
        follower_ids: followerId ? [followerId] : [],
        follower_text: followerEmp ? followerEmp.name : '',
        deadline: deadline,
        status: status,
        priority: priority,
        in_staging: !assigneeId,
        sub_assignments: {}
      };

      state.tasks.unshift(newTask);
      saveData(false);
      notify('success', assigneeId ? `Đã tạo công việc và phân công cho ${assigneeEmp.name}!` : 'Đã thêm công việc vào Danh sách chờ!');
    }

    closeTaskModal();
    render();
    updateQuickStats();
  }

  function handleDeleteTask() {
    if (!state.editingTaskId) return;
    if (confirm('Bạn có chắc chắn muốn xóa công việc này?')) {
      state.tasks = state.tasks.filter(t => t.id !== state.editingTaskId);
      saveData(false);
      closeTaskModal();
      render();
      updateQuickStats();
      notify('info', 'Đã xóa công việc khỏi danh sách!');
    }
  }

  // =========================================================================
  // EXCEL / CSV EXPORT
  // =========================================================================
  function exportToExcel() {
    const headers = [
      'STT',
      'Tổ / Mục',
      'Loại công việc',
      'Năm',
      'Tên công việc',
      'Chi tiết nội dung',
      'Cán bộ phụ trách',
      'Người theo dõi',
      'Thời hạn hoàn thành',
      'Trạng thái'
    ];

    const rows = state.tasks.map((t, idx) => [
      t.stt || idx + 1,
      t.section || '',
      t.category || '',
      t.subcategory || '',
      `"${(t.title || '').replace(/"/g, '""')}"`,
      `"${(t.detail || '').replace(/"/g, '""')}"`,
      `"${(t.assignee_text || '').replace(/"/g, '""')}"`,
      `"${(t.follower_text || '').replace(/"/g, '""')}"`,
      formatFullDate(t.deadline) || '',
      t.status === 'completed' ? 'Đã hoàn thành' : 'Đang thực hiện'
    ]);

    const csvContent = '\uFEFF' + [
      headers.join(','),
      ...rows.map(r => r.join(','))
    ].join('\r\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `Phan_Cong_Cong_Viec_KHVT_${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    notify('success', 'Đã xuất file Excel/CSV thành công!');
  }

  // =========================================================================
  // HELPER FUNCTIONS
  // =========================================================================
  function formatFullDate(dateStr) {
    if (!dateStr) return '';
    dateStr = dateStr.trim();
    const m = dateStr.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
    if (m) {
      const d = String(m[1]).padStart(2, '0');
      const mo = String(m[2]).padStart(2, '0');
      const y = m[3] || '2026';
      return `${d}/${mo}/${y}`;
    }
    return dateStr;
  }

  function getInitials(name) {
    if (!name) return 'VT';
    const words = name.trim().split(/\s+/);
    if (words.length === 1) return words[0].substring(0, 2).toUpperCase();
    return (words[0][0] + words[words.length - 1][0]).toUpperCase();
  }

  function getShortName(empId) {
    const emp = state.employees.find(e => e.id === empId);
    return emp ? (emp.short_name || emp.name.split(' ').pop()) : '';
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  // Start Application
  document.addEventListener('DOMContentLoaded', init);
})();
