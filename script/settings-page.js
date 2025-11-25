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
        
        // Загрузка сохраненных настроек
        loadSettings();
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
        notify.success('Общие настройки сохранены');
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
                    <input type="tel" class="form-control" id="userPhone" placeholder="+7 (999) 123-45-67" inputmode="tel" autocomplete="tel" data-phone-mask="true" required>
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
        const phoneInput = document.getElementById('userPhone');
        if (phoneInput && window.phoneMask) {
            window.phoneMask.applyTo(phoneInput);
        }

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
            notify.error('Пользователь не найден');
            return;
        }

        const dbUser = database.find('users', u => u.user_id === userId);
        if (!dbUser) {
            notify.error('Пользователь не найден в базе данных');
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
                    <input type="tel" class="form-control" id="userPhone" placeholder="+7 (999) 123-45-67" value="${phone}" inputmode="tel" autocomplete="tel" data-phone-mask="true" required>
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
        const phoneInput = document.getElementById('userPhone');
        if (phoneInput && window.phoneMask) {
            window.phoneMask.applyTo(phoneInput);
        }

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
            notify.error('Заполните обязательные поля: ФИО, Email и номер телефона');
            return;
        }

        if (!window.validators || !window.validators.validateEmail(email)) {
            notify.error('Пожалуйста, введите корректный email.');
            return;
        }

        // Валидация телефона
        if (!validatePhone(phone)) {
            notify.error('Неверный формат номера телефона. Используйте формат: +7 (999) 123-45-67');
            return;
        }

        // Проверка уникальности email (кроме текущего пользователя)
        const existingUser = database.find('users', u => u.email === email && u.user_id !== userId);
        if (existingUser) {
            notify.error('Пользователь с таким email уже существует');
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
                notify.success('Пользователь обновлен');
                modals.hide('userModal');
                await renderUsers();
            } else {
                notify.error('Ошибка при обновлении пользователя');
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
                notify.success('Пользователь создан');
                modals.hide('userModal');
                await renderUsers();
            } else {
                notify.error('Ошибка при создании пользователя');
            }
        }
    }

    // Валидация номера телефона
    function validatePhone(phone) {
        if (window.validators && window.validators.validatePhone) {
            return window.validators.validatePhone(phone);
        }
        if (!phone) return false;
        const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
        const phoneRegex = /^(\+?7|8)?\d{10}$/;
        return phoneRegex.test(cleaned);
    }

    async function deleteUser(userId) {
        if (!confirm('Вы уверены, что хотите удалить этого пользователя?')) {
            return;
        }

        const user = await auth.getUserById(userId);
        if (!user) {
            notify.error('Пользователь не найден');
            return;
        }

        // Нельзя удалить текущего пользователя
        if (currentUser.user_id === userId) {
            notify.error('Нельзя удалить текущего пользователя');
            return;
        }

        const deleted = database.delete('users', userId);
        if (deleted) {
            notify.success('Пользователь удален');
            await renderUsers();
        } else {
            notify.error('Ошибка при удалении пользователя');
        }
    }
    
    // Функции для других вкладок настроек
    
});

