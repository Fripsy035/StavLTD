// Глобальные валидаторы
(function (global) {
    const validators = global.validators || {};

    validators.validateEmail = function (email) {
        if (!email) return false;
        const trimmed = email.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(trimmed);
    };

    validators.validatePhone = function (phone, options = {}) {
        const { allowEmpty = false } = options;
        if (!phone || !phone.trim()) {
            return allowEmpty;
        }
        const cleaned = phone.replace(/[\s\-\(\)\+]/g, '');
        const phoneRegex = /^(\+?7|8)?\d{10}$/;
        return phoneRegex.test(cleaned);
    };

    global.validators = validators;
})(window);

(function (global) {
    const PHONE_MASK_SELECTOR = 'input[data-phone-mask]';

    function normalizeDigits(value) {
        let digits = (value || '').replace(/\D/g, '');
        if (!digits) {
            return '';
        }
        if (digits[0] === '8') {
            digits = '7' + digits.slice(1);
        }
        if (digits[0] !== '7') {
            digits = '7' + digits;
        }
        return digits.slice(0, 11);
    }

    function formatPhoneValue(value) {
        const digits = normalizeDigits(value);
        if (!digits) {
            return '';
        }

        const part1 = digits.slice(1, 4); // код
        const part2 = digits.slice(4, 7); // первые 3
        const part3 = digits.slice(7, 9); // следующие 2
        const part4 = digits.slice(9, 11); // последние 2

        let formatted = '+7';

        if (part1.length) {
            formatted += ' (' + part1;
            if (part1.length === 3) {
                formatted += ')';
            }
        }

        if (part1.length === 3 && part2.length) {
            formatted += ' ' + part2;
        }

        if (part2.length === 3 && part3.length) {
            formatted += ' ' + part3;
        }

        if (part3.length === 2 && part4.length) {
            formatted += '-' + part4;
        }

        return formatted.trimEnd();
    }

    function applyMask(input) {
        if (!input) return;
        const formatted = formatPhoneValue(input.value);
        input.value = formatted || '';
    }

    function isPhoneInput(element) {
        return element && element.matches(PHONE_MASK_SELECTOR);
    }

    document.addEventListener('input', event => {
        if (isPhoneInput(event.target)) {
            const previousSelection = event.target.selectionStart;
            applyMask(event.target);
            if (typeof previousSelection === 'number') {
                event.target.setSelectionRange(event.target.value.length, event.target.value.length);
            }
        }
    });

    document.addEventListener('focus', event => {
        if (isPhoneInput(event.target)) {
            applyMask(event.target);
        }
    }, true);

    document.addEventListener('blur', event => {
        if (isPhoneInput(event.target)) {
            const digits = (event.target.value || '').replace(/\D/g, '');
            if (digits.length <= 1) {
                event.target.value = '';
            } else {
                applyMask(event.target);
            }
        }
    }, true);

    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll(PHONE_MASK_SELECTOR).forEach(input => applyMask(input));
    });

    global.phoneMask = {
        format: formatPhoneValue,
        applyTo(input) {
            applyMask(input);
        }
    };
})(window);

// Toast notifications
(function (global) {
    const container = document.createElement('div');
    container.className = 'toast-container';

    function ensureContainer() {
        if (document.body && !document.body.contains(container)) {
            document.body.appendChild(container);
        } else if (!document.body) {
            document.addEventListener('DOMContentLoaded', ensureContainer, { once: true });
        }
    }

    function createToast(message, type, timeout) {
        ensureContainer();
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        container.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('visible'));
        setTimeout(() => {
            toast.classList.remove('visible');
            setTimeout(() => toast.remove(), 300);
        }, timeout);
    }

    const notify = {
        show(message, type = 'info', timeout = 4000) {
            createToast(message, type, timeout);
        },
        success(message, timeout) {
            this.show(message, 'success', timeout);
        },
        error(message, timeout) {
            this.show(message, 'error', timeout);
        },
        info(message, timeout) {
            this.show(message, 'info', timeout);
        }
    };

    global.notify = notify;
    global.alert = function (message) {
        notify.info(message);
    };
})(window);

// Настройки приложения (формат даты и т.п.)
(function (global) {
    const appSettings = global.appSettings || {};
    const DEFAULT_DATE_FORMAT = 'dd.mm.yyyy';
    const SUPPORTED_FORMATS = new Set([DEFAULT_DATE_FORMAT, 'yyyy-mm-dd']);

    function getSystemSettings() {
        try {
            return JSON.parse(localStorage.getItem('system_settings') || '{}');
        } catch (error) {
            console.warn('Не удалось прочитать system_settings', error);
            return {};
        }
    }

    appSettings.getDateFormat = function () {
        const settings = getSystemSettings();
        const format = settings.general && settings.general.dateFormat;
        if (format && SUPPORTED_FORMATS.has(format)) {
            return format;
        }
        return DEFAULT_DATE_FORMAT;
    };

    function pad(value) {
        return String(value).padStart(2, '0');
    }

    appSettings.formatDate = function (dateInput) {
        if (!dateInput) return '';
        const date = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (Number.isNaN(date.getTime())) {
            return '';
        }
        const day = pad(date.getDate());
        const month = pad(date.getMonth() + 1);
        const year = date.getFullYear();
        switch (this.getDateFormat()) {
            case 'yyyy-mm-dd':
                return `${year}-${month}-${day}`;
            case 'dd.mm.yyyy':
            default:
                return `${day}.${month}.${year}`;
        }
    };

    global.appSettings = appSettings;
    global.formatDateBySettings = appSettings.formatDate.bind(appSettings);
})(window);

// Мобильное меню
document.addEventListener('DOMContentLoaded', function () {
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const mainNav = document.getElementById('main-nav');

    if (mobileMenuToggle && mainNav) {
        mobileMenuToggle.addEventListener('click', function () {
            mainNav.classList.toggle('active');
        });
    }
});

// Простой поиск с автодополнением (заглушка)
document.addEventListener('DOMContentLoaded', function () {
    const searchInput = document.querySelector('.search-input');

    if (searchInput) {
        searchInput.addEventListener('input', function () {
            // В реальном приложении здесь будет запрос к API для автодополнения
            console.log('Поисковый запрос:', this.value);
        });
    }
});

// Кнопка выхода
document.addEventListener('DOMContentLoaded', function () {
    const logoutBtn = document.querySelector('.logout-btn');

    if (logoutBtn) {
        const modal = document.createElement('div');
        modal.className = 'confirm-modal';
        modal.innerHTML = `
            <div class="confirm-modal__content">
                <div class="confirm-modal__title">Выйти из аккаунта?</div>
                <div class="confirm-modal__text">Текущая сессия будет завершена.</div>
                <div class="confirm-modal__actions">
                    <button class="btn btn-secondary" data-action="cancel">Отмена</button>
                    <button class="btn btn-danger" data-action="confirm">Выйти</button>
                </div>
            </div>
        `;
        document.body.appendChild(modal);

        const closeModal = () => modal.classList.remove('active');
        const openModal = () => modal.classList.add('active');

        logoutBtn.addEventListener('click', function (e) {
            e.preventDefault();
            openModal();
        });

        modal.addEventListener('click', function (e) {
            if (e.target === modal || e.target.dataset.action === 'cancel') {
                closeModal();
            }
        });

        const confirmBtn = modal.querySelector('[data-action="confirm"]');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', function () {
                if (typeof auth !== 'undefined' && auth.logout) {
                    auth.logout();
                }
                window.location.href = 'login.html';
            });
        }
    }
});

// Обработчики для кнопок документов
document.addEventListener('DOMContentLoaded', function () {
    const downloadButtons = document.querySelectorAll('.btn-download');

    downloadButtons.forEach(button => {
        button.addEventListener('click', function () {
            const documentItem = this.closest('.document-item');
            if (documentItem) {
                const documentName = documentItem.querySelector('.document-name').textContent;
                console.log(`Документ "${documentName}" будет скачан`);
                // В реальном приложении здесь будет запрос на скачивание
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const editButtons = document.querySelectorAll('.btn-edit');

    editButtons.forEach(button => {
        button.addEventListener('click', function () {
            const documentItem = this.closest('.document-item');
            if (documentItem) {
                const documentName = documentItem.querySelector('.document-name').textContent;
                console.log(`Редактирование документа: "${documentName}"`);
                // В реальном приложении здесь будет переход к редактированию
            }
        });
    });
});

// Обработчики для задач согласования
document.addEventListener('DOMContentLoaded', function () {
    const taskItems = document.querySelectorAll('.task-item');

    taskItems.forEach(task => {
        task.addEventListener('click', function () {
            const taskId = this.getAttribute('data-task-id');
            const taskTitle = this.querySelector('.task-title').textContent;
            console.log(`Переход к задаче согласования: "${taskTitle}" (ID: ${taskId})`);
            // В реальном приложении здесь будет переход к задаче согласования
        });
    });
});

// Кнопка создания документа
document.addEventListener('DOMContentLoaded', function () {
    const createButton = document.querySelector('.btn-create');

    if (createButton) {
        createButton.addEventListener('click', function () {
            console.log('Создание нового документа');
            // В реальном приложении здесь будет переход к созданию документа
        });
    }
});

// Пагинация
document.addEventListener('DOMContentLoaded', function () {
    const paginationLinks = document.querySelectorAll('.pagination a');

    paginationLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();
            if (!this.classList.contains('active')) {
                document.querySelectorAll('.pagination a').forEach(a => a.classList.remove('active'));
                this.classList.add('active');
                console.log(`Переход на страницу ${this.textContent}`);
                // В реальном приложении здесь будет загрузка данных для выбранной страницы
            }
        });
    });
});

// Навигация по настройкам
document.addEventListener('DOMContentLoaded', function () {
    const settingsNavLinks = document.querySelectorAll('.settings-nav a');

    settingsNavLinks.forEach(link => {
        link.addEventListener('click', function (e) {
            e.preventDefault();

            // Убираем активный класс у всех ссылок
            document.querySelectorAll('.settings-nav a').forEach(a => a.classList.remove('active'));
            // Добавляем активный класс текущей ссылке
            this.classList.add('active');

            // Скрываем все разделы настроек
            document.querySelectorAll('.settings-section').forEach(section => {
                section.style.display = 'none';
            });

            // Показываем выбранный раздел
            const sectionId = this.getAttribute('href');
            const targetSection = document.querySelector(sectionId);
            if (targetSection) {
                targetSection.style.display = 'block';
            }
        });
    });
});

// Обработчики для кнопок пользователей
document.addEventListener('DOMContentLoaded', function () {
    const editUserButtons = document.querySelectorAll('.user-actions .btn-secondary');

    editUserButtons.forEach(button => {
        button.addEventListener('click', function () {
            const userItem = this.closest('.user-item');
            if (userItem) {
                const userName = userItem.querySelector('.user-name').textContent;
                console.log(`Редактирование пользователя: "${userName}"`);
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const deleteUserButtons = document.querySelectorAll('.user-actions .btn-danger');

    deleteUserButtons.forEach(button => {
        button.addEventListener('click', function () {
            const userItem = this.closest('.user-item');
            if (userItem) {
                const userName = userItem.querySelector('.user-name').textContent;
                if (confirm(`Вы уверены, что хотите удалить пользователя "${userName}"?`)) {
                    console.log(`Пользователь "${userName}" удален`);
                }
            }
        });
    });
});

// Обработчики для кнопок сохранения настроек
document.addEventListener('DOMContentLoaded', function () {
    const saveButtons = document.querySelectorAll('.btn-primary');

    saveButtons.forEach(button => {
        button.addEventListener('click', function () {
            const form = this.closest('form');
            const section = this.closest('.settings-section');
            if (section) {
                const sectionName = section.querySelector('.settings-card-title').textContent;
                console.log(`Настройки сохранены: "${sectionName}"`);
            }
        });
    });
});

// Кнопка добавления пользователя
document.addEventListener('DOMContentLoaded', function () {
    const addUserButton = document.querySelector('.btn-success');

    if (addUserButton) {
        addUserButton.addEventListener('click', function () {
            console.log('Добавление нового пользователя');
        });
    }
});

// Табы
document.addEventListener('DOMContentLoaded', function () {
    const tabs = document.querySelectorAll('.tab');

    tabs.forEach(tab => {
        tab.addEventListener('click', function () {
            // Убираем активный класс у всех табов
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            // Добавляем активный класс текущему табу
            this.classList.add('active');

            // Скрываем все содержимое табов
            document.querySelectorAll('.tab-content').forEach(content => {
                content.classList.remove('active');
            });

            // Показываем содержимое активного таба
            const tabId = this.getAttribute('data-tab');
            const targetContent = document.getElementById(tabId);
            if (targetContent) {
                targetContent.classList.add('active');
            }
        });
    });
});

// Обработчики для кнопок согласования
document.addEventListener('DOMContentLoaded', function () {
    const approveButtons = document.querySelectorAll('.btn-approve');

    approveButtons.forEach(button => {
        button.addEventListener('click', function () {
            const card = this.closest('.approval-card');
            if (card) {
                const title = card.querySelector('.approval-title').textContent;
                console.log(`Документ "${title}" согласован`);
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const rejectButtons = document.querySelectorAll('.btn-reject');

    rejectButtons.forEach(button => {
        button.addEventListener('click', function () {
            const card = this.closest('.approval-card');
            if (card) {
                const title = card.querySelector('.approval-title').textContent;
                console.log(`Документ "${title}" отклонен`);
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const reviseButtons = document.querySelectorAll('.btn-revise');

    reviseButtons.forEach(button => {
        button.addEventListener('click', function () {
            const card = this.closest('.approval-card');
            if (card) {
                const title = card.querySelector('.approval-title').textContent;
                console.log(`Документ "${title}" возвращен на доработку`);
            }
        });
    });
});


// Обработчики для кнопок отчетов
document.addEventListener('DOMContentLoaded', function () {
    const generateButtons = document.querySelectorAll('.btn-generate');

    generateButtons.forEach(button => {
        button.addEventListener('click', function () {
            const card = this.closest('.report-card');
            if (card) {
                const title = card.querySelector('.report-title').textContent;
                console.log(`Формирование отчета: "${title}"`);
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const downloadReportButtons = document.querySelectorAll('.btn-download');

    downloadReportButtons.forEach(button => {
        button.addEventListener('click', function () {
            const card = this.closest('.report-card');
            if (card) {
                const title = card.querySelector('.report-title').textContent;
                console.log(`Скачивание отчета: "${title}"`);
            }
        });
    });
});
