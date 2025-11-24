// Скрипт для страницы настроек

document.addEventListener('DOMContentLoaded', function() {
    if (typeof auth === 'undefined' || !auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const currentUser = auth.getCurrentUser();

    // Ждем загрузки модулей
    function waitForModules() {
        return new Promise((resolve) => {
            const checkModules = setInterval(() => {
                if (typeof database !== 'undefined' &&
                    typeof auth !== 'undefined' &&
                    typeof modals !== 'undefined') {
                    clearInterval(checkModules);
                    resolve();
                }
            }, 100);
            setTimeout(() => {
                clearInterval(checkModules);
                console.warn('Timeout waiting for modules on settings page');
                resolve();
            }, 5000);
        });
    }

    waitForModules().then(() => {
        initSettingsPage();
    });

    async function initSettingsPage() {
        console.log('Инициализация страницы настроек...');
        await database.init();
        setupTabs();
        setupAccessControl();
        await renderUsers();
        setupEventHandlers();
        console.log('Страница настроек инициализирована.');
    }

    function setupAccessControl() {
        const isAdmin = currentUser && currentUser.role === 'Администратор';
        const isRegularUser = currentUser && currentUser.role === 'Пользователь';
        
        // Скрываем пункт меню "Пользователи" для не-администраторов
        const usersNavItem = document.querySelector('.settings-nav a[href="#users"]');
        if (usersNavItem) {
            const navItem = usersNavItem.parentElement;
            if (!isAdmin) {
                navItem.style.display = 'none';
            } else {
                navItem.style.display = '';
            }
        }
        
        // Скрываем секцию пользователей для не-администраторов
        const usersSection = document.getElementById('users');
        if (usersSection && !isAdmin) {
            usersSection.style.display = 'none';
        }
        
        // Скрываем пункт меню "Процессы" для обычных пользователей
        if (isRegularUser) {
            const workflowNavItem = document.querySelector('.settings-nav a[href="#workflow"]');
            if (workflowNavItem) {
                workflowNavItem.parentElement.style.display = 'none';
            }
            
            // Скрываем секцию процессов для обычных пользователей
            const workflowSection = document.getElementById('workflow');
            if (workflowSection) {
                workflowSection.style.display = 'none';
            }
        }
    }

    function setupTabs() {
        const navLinks = document.querySelectorAll('.settings-nav a');
        const sections = document.querySelectorAll('.settings-section');

        navLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const targetId = this.getAttribute('href').substring(1);

                // Убираем активный класс у всех ссылок
                navLinks.forEach(l => l.classList.remove('active'));
                this.classList.add('active');

                // Скрываем все секции
                sections.forEach(s => s.style.display = 'none');

                // Показываем выбранную секцию
                const targetSection = document.getElementById(targetId);
                if (targetSection) {
                    targetSection.style.display = 'block';
                }
            });
        });
    }

    async function renderUsers() {
        const users = auth.getUsers();
        const departments = database.getTable('departments');
        const userListContainer = document.querySelector('#users .user-list');
        
        if (!userListContainer) {
            console.error('Контейнер списка пользователей не найден');
            return;
        }

        if (users.length === 0) {
            userListContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Пользователи не найдены</p>';
            return;
        }

        userListContainer.innerHTML = users.map(user => {
            const department = departments.find(d => d.department_id === user.department_id);
            const initials = auth.getInitials(user.fullName);
            const roleText = user.role || 'Пользователь';
            const isCurrentUser = currentUser.user_id === user.user_id;
            const dbUser = database.find('users', u => u.user_id === user.user_id);
            const phone = dbUser ? (dbUser.phone || '') : '';

            return `
                <li class="user-item">
                    <div class="user-avatar-sm">${initials}</div>
                    <div class="user-details">
                        <div class="user-name">${user.fullName || user.name || 'Без имени'}</div>
                        <div class="user-email">${user.email || 'Нет email'}</div>
                        <div class="user-role">${roleText}${department ? ' | ' + department.name : ''}${user.position ? ' | ' + user.position : ''}${phone ? ' | ' + phone : ''}</div>
                    </div>
                    <div class="user-actions">
                        <button class="btn btn-secondary btn-edit-user" data-user-id="${user.user_id}">Редактировать</button>
                        ${isCurrentUser ? '' : `<button class="btn btn-danger btn-delete-user" data-user-id="${user.user_id}">Удалить</button>`}
                    </div>
                </li>
            `;
        }).join('');
    }

    function setupEventHandlers() {
        // Кнопка "Добавить пользователя" (только для администраторов)
        const isAdmin = currentUser && currentUser.role === 'Администратор';
        const addUserBtn = document.querySelector('#users .btn-success');
        if (addUserBtn && isAdmin) {
            addUserBtn.addEventListener('click', function() {
                createUserModal();
            });
        } else if (addUserBtn && !isAdmin) {
            addUserBtn.style.display = 'none';
        }

        // Редактирование пользователя
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-edit-user')) {
                const userId = parseInt(e.target.getAttribute('data-user-id'));
                editUserModal(userId);
            }
        });

        // Удаление пользователя
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-delete-user')) {
                const userId = parseInt(e.target.getAttribute('data-user-id'));
                deleteUser(userId);
            }
        });
        
        // Сохранение общих настроек
        const generalForm = document.querySelector('#general .settings-form');
        if (generalForm) {
            const saveBtn = generalForm.querySelector('.btn-primary');
            if (saveBtn) {
                saveBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    saveGeneralSettings();
                });
            }
        }
        
        // Сохранение настроек процессов
        const workflowForm = document.querySelector('#workflow .settings-form');
        if (workflowForm) {
            const saveBtn = workflowForm.querySelector('.btn-primary');
            if (saveBtn) {
                saveBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    saveWorkflowSettings();
                });
            }
        }
        
        // Сохранение настроек уведомлений
        const notificationsForm = document.querySelector('#notifications .settings-form');
        if (notificationsForm) {
            const saveBtn = notificationsForm.querySelector('.btn-primary');
            if (saveBtn) {
                saveBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    saveNotificationSettings();
                });
            }
        }
        
        // Загрузка сохраненных настроек
        loadSettings();
        
        // Инициализация информации о системе
        if (document.getElementById('system')) {
            updateSystemInfo();
            updateBackupList();
        }
    }
    
    function loadSettings() {
        // Загружаем общие настройки
        const settings = JSON.parse(localStorage.getItem('system_settings') || '{}');
        
        if (settings.general) {
            const general = settings.general;
            if (general.timezone) {
                const timezoneSelect = document.getElementById('timezone');
                if (timezoneSelect) timezoneSelect.value = general.timezone;
            }
            if (general.dateFormat) {
                const dateFormatSelect = document.getElementById('date-format');
                if (dateFormatSelect) dateFormatSelect.value = general.dateFormat;
            }
            if (general.emailNotifications !== undefined) {
                const emailCheckbox = document.getElementById('email-notifications');
                if (emailCheckbox) emailCheckbox.checked = general.emailNotifications;
            }
            if (general.autoLogout !== undefined) {
                const autoLogoutCheckbox = document.getElementById('auto-logout');
                if (autoLogoutCheckbox) autoLogoutCheckbox.checked = general.autoLogout;
            }
        }
        
        if (settings.workflow) {
            const workflow = settings.workflow;
            if (workflow.defaultApprovalTime) {
                const defaultTimeInput = document.getElementById('default-approval-time');
                if (defaultTimeInput) defaultTimeInput.value = workflow.defaultApprovalTime;
            }
            if (workflow.reminderDays) {
                const reminderDaysInput = document.getElementById('reminder-days');
                if (reminderDaysInput) reminderDaysInput.value = workflow.reminderDays;
            }
            if (workflow.autoEscalation !== undefined) {
                const autoEscalationCheckbox = document.getElementById('auto-escalation');
                if (autoEscalationCheckbox) autoEscalationCheckbox.checked = workflow.autoEscalation;
            }
            if (workflow.parallelApproval !== undefined) {
                const parallelApprovalCheckbox = document.getElementById('parallel-approval');
                if (parallelApprovalCheckbox) parallelApprovalCheckbox.checked = workflow.parallelApproval;
            }
        }
        
        if (settings.notifications) {
            const notifications = settings.notifications;
            if (notifications.notifyNewDocument !== undefined) {
                const notifyNewDocCheckbox = document.getElementById('notify-new-document');
                if (notifyNewDocCheckbox) notifyNewDocCheckbox.checked = notifications.notifyNewDocument;
            }
            if (notifications.notifyApproval !== undefined) {
                const notifyApprovalCheckbox = document.getElementById('notify-approval');
                if (notifyApprovalCheckbox) notifyApprovalCheckbox.checked = notifications.notifyApproval;
            }
            if (notifications.notifyOverdue !== undefined) {
                const notifyOverdueCheckbox = document.getElementById('notify-overdue');
                if (notifyOverdueCheckbox) notifyOverdueCheckbox.checked = notifications.notifyOverdue;
            }
            if (notifications.notifyComments !== undefined) {
                const notifyCommentsCheckbox = document.getElementById('notify-comments');
                if (notifyCommentsCheckbox) notifyCommentsCheckbox.checked = notifications.notifyComments;
            }
            if (notifications.frequency) {
                const frequencySelect = document.getElementById('notification-frequency');
                if (frequencySelect) frequencySelect.value = notifications.frequency;
            }
        }
        
        if (settings.security) {
            const security = settings.security;
            if (security.passwordPolicy) {
                const passwordPolicySelect = document.getElementById('password-policy');
                if (passwordPolicySelect) passwordPolicySelect.value = security.passwordPolicy;
            }
            if (security.sessionTimeout) {
                const sessionTimeoutInput = document.getElementById('session-timeout');
                if (sessionTimeoutInput) sessionTimeoutInput.value = security.sessionTimeout;
            }
            if (security.require2FA !== undefined) {
                const require2FACheckbox = document.getElementById('require-2fa');
                if (require2FACheckbox) require2FACheckbox.checked = security.require2FA;
            }
            if (security.logLoginAttempts !== undefined) {
                const logLoginAttemptsCheckbox = document.getElementById('log-login-attempts');
                if (logLoginAttemptsCheckbox) logLoginAttemptsCheckbox.checked = security.logLoginAttempts;
            }
            if (security.blockAfterFailed !== undefined) {
                const blockAfterFailedCheckbox = document.getElementById('block-after-failed');
                if (blockAfterFailedCheckbox) blockAfterFailedCheckbox.checked = security.blockAfterFailed;
            }
            if (security.ipWhitelist) {
                const ipWhitelistTextarea = document.getElementById('ip-whitelist');
                if (ipWhitelistTextarea) ipWhitelistTextarea.value = security.ipWhitelist.join('\n');
            }
        }
        
        if (settings.backup) {
            const backup = settings.backup;
            if (backup.frequency) {
                const backupFrequencySelect = document.getElementById('backup-frequency');
                if (backupFrequencySelect) backupFrequencySelect.value = backup.frequency;
            }
            if (backup.time) {
                const backupTimeInput = document.getElementById('backup-time');
                if (backupTimeInput) backupTimeInput.value = backup.time;
            }
            if (backup.retention) {
                const backupRetentionInput = document.getElementById('backup-retention');
                if (backupRetentionInput) backupRetentionInput.value = backup.retention;
            }
            if (backup.compress !== undefined) {
                const backupCompressCheckbox = document.getElementById('backup-compress');
                if (backupCompressCheckbox) backupCompressCheckbox.checked = backup.compress;
            }
            if (backup.encrypt !== undefined) {
                const backupEncryptCheckbox = document.getElementById('backup-encrypt');
                if (backupEncryptCheckbox) backupEncryptCheckbox.checked = backup.encrypt;
            }
        }
        
        if (settings.system) {
            const system = settings.system;
            if (system.systemName) {
                const systemNameInput = document.getElementById('system-name');
                if (systemNameInput) systemNameInput.value = system.systemName;
            }
            if (system.maxFileSize) {
                const maxFileSizeInput = document.getElementById('max-file-size');
                if (maxFileSizeInput) maxFileSizeInput.value = system.maxFileSize;
            }
            if (system.allowedFileTypes) {
                const allowedFileTypesInput = document.getElementById('allowed-file-types');
                if (allowedFileTypesInput) allowedFileTypesInput.value = system.allowedFileTypes.join(',');
            }
            if (system.maxDocumentsPerUser) {
                const maxDocumentsPerUserInput = document.getElementById('max-documents-per-user');
                if (maxDocumentsPerUserInput) maxDocumentsPerUserInput.value = system.maxDocumentsPerUser;
            }
            if (system.enableVersioning !== undefined) {
                const enableVersioningCheckbox = document.getElementById('enable-versioning');
                if (enableVersioningCheckbox) enableVersioningCheckbox.checked = system.enableVersioning;
            }
            if (system.enableAuditLog !== undefined) {
                const enableAuditLogCheckbox = document.getElementById('enable-audit-log');
                if (enableAuditLogCheckbox) enableAuditLogCheckbox.checked = system.enableAuditLog;
            }
            if (system.enableMaintenanceMode !== undefined) {
                const enableMaintenanceModeCheckbox = document.getElementById('enable-maintenance-mode');
                if (enableMaintenanceModeCheckbox) enableMaintenanceModeCheckbox.checked = system.enableMaintenanceMode;
            }
            if (system.logLevel) {
                const logLevelSelect = document.getElementById('log-level');
                if (logLevelSelect) logLevelSelect.value = system.logLevel;
            }
        }
    }
    
    function saveGeneralSettings() {
        const settings = JSON.parse(localStorage.getItem('system_settings') || '{}');
        settings.general = {
            timezone: document.getElementById('timezone').value,
            dateFormat: document.getElementById('date-format').value,
            emailNotifications: document.getElementById('email-notifications').checked,
            autoLogout: document.getElementById('auto-logout').checked
        };
        localStorage.setItem('system_settings', JSON.stringify(settings));
        alert('Общие настройки успешно сохранены');
    }
    
    function saveWorkflowSettings() {
        const settings = JSON.parse(localStorage.getItem('system_settings') || '{}');
        settings.workflow = {
            defaultApprovalTime: parseInt(document.getElementById('default-approval-time').value),
            reminderDays: parseInt(document.getElementById('reminder-days').value),
            autoEscalation: document.getElementById('auto-escalation').checked,
            parallelApproval: document.getElementById('parallel-approval').checked
        };
        localStorage.setItem('system_settings', JSON.stringify(settings));
        alert('Настройки процессов успешно сохранены');
    }
    
    function saveNotificationSettings() {
        const settings = JSON.parse(localStorage.getItem('system_settings') || '{}');
        settings.notifications = {
            notifyNewDocument: document.getElementById('notify-new-document').checked,
            notifyApproval: document.getElementById('notify-approval').checked,
            notifyOverdue: document.getElementById('notify-overdue').checked,
            notifyComments: document.getElementById('notify-comments').checked,
            frequency: document.getElementById('notification-frequency').value
        };
        localStorage.setItem('system_settings', JSON.stringify(settings));
        alert('Настройки уведомлений успешно сохранены');
    }

    function createUserModal() {
        const departments = database.getTable('departments');
        const departmentsOptions = departments.map(d => 
            `<option value="${d.department_id}">${d.name}</option>`
        ).join('');

        const modalContent = `
            <form id="userForm">
                <div class="form-group">
                    <label class="form-label" for="userFullName">ФИО *</label>
                    <input type="text" class="form-control" id="userFullName" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="userEmail">Email *</label>
                    <input type="email" class="form-control" id="userEmail" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="userPhone">Номер телефона *</label>
                    <input type="tel" class="form-control" id="userPhone" placeholder="+7 (999) 123-45-67" required>
                </div>
                <div class="form-group password-group">
                    <label class="form-label" for="userPassword">Пароль *</label>
                    <div class="password-field">
                        <input type="password" class="form-control" id="userPassword" required>
                        <button type="button" class="password-toggle" id="togglePassword" aria-label="Показать пароль">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="userPosition">Должность</label>
                    <input type="text" class="form-control" id="userPosition">
                </div>
                <div class="form-group">
                    <label class="form-label" for="userDepartment">Отдел</label>
                    <select class="form-control" id="userDepartment">
                        <option value="">Не выбран</option>
                        ${departmentsOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="userRole">Роль *</label>
                    <select class="form-control" id="userRole" required>
                        <option value="user">Пользователь</option>
                        <option value="editor">Редактор</option>
                        <option value="admin">Администратор</option>
                    </select>
                </div>
                <div class="form-group">
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input" id="userIsActive" checked>
                        <label class="form-check-label" for="userIsActive">Активен</label>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                    <button type="button" class="btn btn-secondary" onclick="modals.hide('userModal')">Отмена</button>
                </div>
            </form>
        `;

        // Удаляем старое модальное окно, если есть
        const oldModal = document.getElementById('userModal');
        if (oldModal) {
            oldModal.remove();
        }

        modals.create('userModal', 'Добавить пользователя', modalContent);
        modals.show('userModal');

        // Обработчик переключателя видимости пароля
        const togglePassword = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('userPassword');
        if (togglePassword && passwordInput) {
            togglePassword.addEventListener('click', function() {
                const isPassword = passwordInput.getAttribute('type') === 'password';
                const type = isPassword ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                togglePassword.classList.toggle('active');
                
                // Обновляем иконку
                const svg = togglePassword.querySelector('svg');
                if (svg) {
                    if (isPassword) {
                        // Показываем иконку "скрыть"
                        svg.innerHTML = `
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        `;
                    } else {
                        // Показываем иконку "показать"
                        svg.innerHTML = `
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        `;
                    }
                }
            });
        }

        // Обработчик формы
        const form = document.getElementById('userForm');
        if (form) {
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                await saveUser();
            });
        }
    }

    async function editUserModal(userId) {
        const user = await auth.getUserById(userId);
        if (!user) {
            alert('Пользователь не найден');
            return;
        }

        const dbUser = database.find('users', u => u.user_id === userId);
        if (!dbUser) {
            alert('Пользователь не найден в базе данных');
            return;
        }

        const departments = database.getTable('departments');
        const departmentsOptions = departments.map(d => 
            `<option value="${d.department_id}" ${d.department_id === user.department_id ? 'selected' : ''}>${d.name}</option>`
        ).join('');

        const roleMap = {
            'Администратор': 'admin',
            'Редактор': 'editor',
            'Пользователь': 'user'
        };
        const currentRole = roleMap[user.role] || 'user';

        const phone = dbUser ? (dbUser.phone || '') : '';

        const modalContent = `
            <form id="userForm">
                <div class="form-group">
                    <label class="form-label" for="userFullName">ФИО *</label>
                    <input type="text" class="form-control" id="userFullName" value="${user.fullName || user.name || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="userEmail">Email *</label>
                    <input type="email" class="form-control" id="userEmail" value="${user.email || ''}" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="userPhone">Номер телефона *</label>
                    <input type="tel" class="form-control" id="userPhone" placeholder="+7 (999) 123-45-67" value="${phone}" required>
                </div>
                <div class="form-group password-group">
                    <label class="form-label" for="userPassword">Новый пароль (оставьте пустым, чтобы не менять)</label>
                    <div class="password-field">
                        <input type="password" class="form-control" id="userPassword">
                        <button type="button" class="password-toggle" id="togglePassword" aria-label="Показать пароль">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                                <circle cx="12" cy="12" r="3"></circle>
                            </svg>
                        </button>
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="userPosition">Должность</label>
                    <input type="text" class="form-control" id="userPosition" value="${user.position || ''}">
                </div>
                <div class="form-group">
                    <label class="form-label" for="userDepartment">Отдел</label>
                    <select class="form-control" id="userDepartment">
                        <option value="">Не выбран</option>
                        ${departmentsOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="userRole">Роль *</label>
                    <select class="form-control" id="userRole" required>
                        <option value="user" ${currentRole === 'user' ? 'selected' : ''}>Пользователь</option>
                        <option value="editor" ${currentRole === 'editor' ? 'selected' : ''}>Редактор</option>
                        <option value="admin" ${currentRole === 'admin' ? 'selected' : ''}>Администратор</option>
                    </select>
                </div>
                <div class="form-group">
                    <div class="form-check">
                        <input type="checkbox" class="form-check-input" id="userIsActive" ${user.is_active !== false ? 'checked' : ''}>
                        <label class="form-check-label" for="userIsActive">Активен</label>
                    </div>
                </div>
                <div class="form-actions">
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                    <button type="button" class="btn btn-secondary" onclick="modals.hide('userModal')">Отмена</button>
                </div>
            </form>
        `;

        // Удаляем старое модальное окно, если есть
        const oldModal = document.getElementById('userModal');
        if (oldModal) {
            oldModal.remove();
        }

        modals.create('userModal', 'Редактировать пользователя', modalContent);
        modals.show('userModal');

        // Обработчик переключателя видимости пароля
        const togglePassword = document.getElementById('togglePassword');
        const passwordInput = document.getElementById('userPassword');
        if (togglePassword && passwordInput) {
            togglePassword.addEventListener('click', function() {
                const isPassword = passwordInput.getAttribute('type') === 'password';
                const type = isPassword ? 'text' : 'password';
                passwordInput.setAttribute('type', type);
                togglePassword.classList.toggle('active');
                
                // Обновляем иконку
                const svg = togglePassword.querySelector('svg');
                if (svg) {
                    if (isPassword) {
                        // Показываем иконку "скрыть"
                        svg.innerHTML = `
                            <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path>
                            <line x1="1" y1="1" x2="23" y2="23"></line>
                        `;
                    } else {
                        // Показываем иконку "показать"
                        svg.innerHTML = `
                            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path>
                            <circle cx="12" cy="12" r="3"></circle>
                        `;
                    }
                }
            });
        }

        // Сохраняем ID пользователя для обновления
        const form = document.getElementById('userForm');
        if (form) {
            form.dataset.userId = userId;
            form.addEventListener('submit', async function(e) {
                e.preventDefault();
                await saveUser(userId);
            });
        }
    }

    async function saveUser(userId = null) {
        const form = document.getElementById('userForm');
        if (!form) {
            console.error('Форма не найдена');
            return;
        }

        const fullName = document.getElementById('userFullName').value.trim();
        const email = document.getElementById('userEmail').value.trim();
        const phone = document.getElementById('userPhone').value.trim();
        const password = document.getElementById('userPassword').value;
        const position = document.getElementById('userPosition').value.trim();
        const departmentId = document.getElementById('userDepartment').value ? 
            parseInt(document.getElementById('userDepartment').value) : null;
        const role = document.getElementById('userRole').value;
        const isActive = document.getElementById('userIsActive').checked;

        // Валидация
        if (!fullName || !email || !phone) {
            alert('Пожалуйста, заполните все обязательные поля (ФИО, Email, Номер телефона)');
            return;
        }

        // Валидация телефона
        if (!validatePhone(phone)) {
            alert('Неверный формат номера телефона. Используйте формат: +7 (999) 123-45-67 или 89991234567');
            return;
        }

        // Проверка уникальности email (кроме текущего пользователя)
        const existingUser = database.find('users', u => u.email === email && u.user_id !== userId);
        if (existingUser) {
            alert('Пользователь с таким email уже существует');
            return;
        }

        if (userId) {
            // Обновление существующего пользователя
            const updates = {
                full_name: fullName,
                email: email,
                phone: phone,
                position: position || '',
                department_id: departmentId,
                role: role,
                is_active: isActive
            };

            // Обновляем пароль только если он указан
            if (password) {
                // В реальном приложении здесь должен быть хеш пароля
                // Для демонстрации просто сохраняем (в продакшене НЕ ДЕЛАТЬ ТАК!)
                updates.password = password;
            }

            const updated = database.update('users', userId, updates);
            if (updated) {
                alert('Пользователь успешно обновлен');
                modals.hide('userModal');
                await renderUsers();
            } else {
                alert('Ошибка при обновлении пользователя');
            }
        } else {
            // Создание нового пользователя
            const newUser = {
                full_name: fullName,
                email: email,
                phone: phone,
                password: password, // В реальном приложении должен быть хеш
                position: position || '',
                department_id: departmentId,
                role: role,
                is_active: isActive
            };

            const created = database.insert('users', newUser);
            if (created) {
                alert('Пользователь успешно создан');
                modals.hide('userModal');
                await renderUsers();
            } else {
                alert('Ошибка при создании пользователя');
            }
        }
    }

    // Валидация номера телефона
    function validatePhone(phone) {
        if (!phone) return false;
        // Удаляем все пробелы, скобки, дефисы и плюсы для проверки
        const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
        // Проверяем, что осталось только цифры и длина от 10 до 11 цифр
        // Форматы: +7 (999) 123-45-67, 89991234567, +79991234567
        const phoneRegex = /^(\+?7|8)?\d{10}$/;
        return phoneRegex.test(cleaned);
    }

    async function deleteUser(userId) {
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
            return;
        }

        const user = await auth.getUserById(userId);
        if (!user) {
            alert('Пользователь не найден');
            return;
        }

        // Нельзя удалить текущего пользователя
        if (currentUser.user_id === userId) {
            alert('Нельзя удалить текущего пользователя');
            return;
        }

        const deleted = database.delete('users', userId);
        if (deleted) {
            alert('Пользователь успешно удален');
            await renderUsers();
        } else {
            alert('Ошибка при удалении пользователя');
        }
    }
    
    // Функции для других вкладок настроек
    window.saveSecuritySettings = function() {
        const settings = JSON.parse(localStorage.getItem('system_settings') || '{}');
        settings.security = {
            passwordPolicy: document.getElementById('password-policy').value,
            sessionTimeout: parseInt(document.getElementById('session-timeout').value),
            require2FA: document.getElementById('require-2fa').checked,
            logLoginAttempts: document.getElementById('log-login-attempts').checked,
            blockAfterFailed: document.getElementById('block-after-failed').checked,
            ipWhitelist: document.getElementById('ip-whitelist').value.split('\n').filter(ip => ip.trim())
        };
        localStorage.setItem('system_settings', JSON.stringify(settings));
        alert('Настройки безопасности успешно сохранены');
    };
    
    window.saveBackupSettings = function() {
        const settings = JSON.parse(localStorage.getItem('system_settings') || '{}');
        settings.backup = {
            frequency: document.getElementById('backup-frequency').value,
            time: document.getElementById('backup-time').value,
            retention: parseInt(document.getElementById('backup-retention').value),
            compress: document.getElementById('backup-compress').checked,
            encrypt: document.getElementById('backup-encrypt').checked
        };
        localStorage.setItem('system_settings', JSON.stringify(settings));
        alert('Настройки резервного копирования успешно сохранены');
    };
    
    window.createBackup = function() {
        if (!confirm('Создать резервную копию всех данных системы?')) {
            return;
        }
        
        try {
            const data = localStorage.getItem('sed_database');
            if (!data) {
                alert('Нет данных для резервного копирования');
                return;
            }
            
            const timestamp = new Date().toISOString();
            const backup = {
                timestamp: timestamp,
                version: '1.0.0',
                data: JSON.parse(data)
            };
            
            const backupData = JSON.stringify(backup, null, 2);
            const blob = new Blob([backupData], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `backup_${new Date().toISOString().split('T')[0]}.json`;
            a.click();
            URL.revokeObjectURL(url);
            
            // Сохраняем информацию о резервной копии
            const backups = JSON.parse(localStorage.getItem('backup_list') || '[]');
            backups.push({
                timestamp: timestamp,
                size: (blob.size / 1024).toFixed(2) + ' KB'
            });
            // Храним только последние 10 копий
            if (backups.length > 10) {
                backups.shift();
            }
            localStorage.setItem('backup_list', JSON.stringify(backups));
            
            // Обновляем список резервных копий
            updateBackupList();
            alert('Резервная копия успешно создана и загружена');
        } catch (error) {
            console.error('Ошибка при создании резервной копии:', error);
            alert('Ошибка при создании резервной копии: ' + error.message);
        }
    };
    
    window.restoreBackup = function() {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.json';
        input.onchange = function(e) {
            const file = e.target.files[0];
            if (!file) return;
            
            if (!confirm('ВНИМАНИЕ! Восстановление из резервной копии заменит все текущие данные. Продолжить?')) {
                return;
            }
            
            const reader = new FileReader();
            reader.onload = function(event) {
                try {
                    const backup = JSON.parse(event.target.result);
                    if (backup.data) {
                        localStorage.setItem('sed_database', JSON.stringify(backup.data));
                        alert('Данные успешно восстановлены из резервной копии. Страница будет перезагружена.');
                        window.location.reload();
                    } else {
                        alert('Неверный формат резервной копии');
                    }
                } catch (error) {
                    console.error('Ошибка при восстановлении:', error);
                    alert('Ошибка при восстановлении: ' + error.message);
                }
            };
            reader.readAsText(file);
        };
        input.click();
    };
    
    function updateBackupList() {
        const backupList = document.getElementById('backup-list');
        if (!backupList) return;
        
        const backups = JSON.parse(localStorage.getItem('backup_list') || '[]');
        if (backups.length === 0) {
            backupList.innerHTML = '<p style="color: #777; font-style: italic;">Резервные копии еще не создавались</p>';
            return;
        }
        
        backupList.innerHTML = backups.map((backup, index) => `
            <div style="padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px;">
                <div><strong>Резервная копия #${index + 1}</strong></div>
                <div style="font-size: 0.9rem; color: #777;">Создана: ${new Date(backup.timestamp).toLocaleString('ru-RU')}</div>
                <div style="font-size: 0.9rem; color: #777;">Размер: ${backup.size || 'N/A'}</div>
            </div>
        `).join('');
    }
    
    window.saveSystemSettings = async function() {
        const settings = JSON.parse(localStorage.getItem('system_settings') || '{}');
        settings.system = {
            systemName: document.getElementById('system-name').value,
            maxFileSize: parseInt(document.getElementById('max-file-size').value),
            allowedFileTypes: document.getElementById('allowed-file-types').value.split(',').map(t => t.trim()),
            maxDocumentsPerUser: parseInt(document.getElementById('max-documents-per-user').value),
            enableVersioning: document.getElementById('enable-versioning').checked,
            enableAuditLog: document.getElementById('enable-audit-log').checked,
            enableMaintenanceMode: document.getElementById('enable-maintenance-mode').checked,
            logLevel: document.getElementById('log-level').value
        };
        localStorage.setItem('system_settings', JSON.stringify(settings));
        
        // Обновляем информацию о системе
        await updateSystemInfo();
        
        alert('Системные настройки успешно сохранены');
    };
    
    async function updateSystemInfo() {
        const installDate = localStorage.getItem('system_install_date') || new Date().toISOString();
        if (!localStorage.getItem('system_install_date')) {
            localStorage.setItem('system_install_date', installDate);
        }
        
        const installDateEl = document.getElementById('install-date');
        if (installDateEl) {
            installDateEl.textContent = new Date(installDate).toLocaleDateString('ru-RU');
        }
        
        const lastUpdateEl = document.getElementById('last-update');
        if (lastUpdateEl) {
            lastUpdateEl.textContent = new Date().toLocaleDateString('ru-RU');
        }
        
        const totalUsersEl = document.getElementById('total-users');
        if (totalUsersEl) {
            const users = auth.getUsers();
            totalUsersEl.textContent = users.length;
        }
        
        const totalDocumentsEl = document.getElementById('total-documents');
        if (totalDocumentsEl) {
            try {
                if (typeof documentsManager !== 'undefined') {
                    const documents = await documentsManager.getAllDocuments();
                    totalDocumentsEl.textContent = documents.length;
                } else {
                    const documents = database.getTable('documents');
                    totalDocumentsEl.textContent = documents.length;
                }
            } catch (error) {
                console.error('Ошибка при получении количества документов:', error);
                totalDocumentsEl.textContent = 'N/A';
            }
        }
    }
    
});

