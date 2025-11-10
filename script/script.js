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
        logoutBtn.addEventListener('click', function () {
            if (confirm('Вы уверены, что хотите выйти из системы?')) {
                // В реальном приложении здесь будет запрос на выход
                console.log('Выход из системы выполнен');
                // window.location.href = '/login'; // перенаправление на страницу входа
            }
        });
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

document.addEventListener('DOMContentLoaded', function () {
    const viewButtons = document.querySelectorAll('.btn-view');

    viewButtons.forEach(button => {
        button.addEventListener('click', function () {
            const card = this.closest('.approval-card');
            if (card) {
                const title = card.querySelector('.approval-title').textContent;
                console.log(`Просмотр документа "${title}"`);
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

document.addEventListener('DOMContentLoaded', function () {
    const viewReportButtons = document.querySelectorAll('.btn-view');

    viewReportButtons.forEach(button => {
        button.addEventListener('click', function () {
            const card = this.closest('.report-card');
            if (card) {
                const title = card.querySelector('.report-title').textContent;
                console.log(`Просмотр отчета: "${title}"`);
            }
        });
    });
});

document.addEventListener('DOMContentLoaded', function () {
    const scheduleButtons = document.querySelectorAll('.btn-schedule');

    scheduleButtons.forEach(button => {
        button.addEventListener('click', function () {
            const card = this.closest('.report-card');
            if (card) {
                const title = card.querySelector('.report-title').textContent;
                console.log(`Настройка расписания для отчета: "${title}"`);
            }
        });
    });
});
