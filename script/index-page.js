// Скрипт для главной страницы

document.addEventListener('DOMContentLoaded', function() {
    if (typeof auth === 'undefined' || !auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    loadScripts().then(() => {
        initIndexPage();
    });

    function loadScripts() {
        return new Promise((resolve) => {
            const scripts = ['script/auth.js', 'script/documents.js', 'script/approvals.js'];
            let loaded = 0;
            
            scripts.forEach(src => {
                if (!document.querySelector(`script[src="${src}"]`)) {
                    const script = document.createElement('script');
                    script.src = src;
                    script.onload = () => {
                        loaded++;
                        if (loaded === scripts.length) resolve();
                    };
                    document.head.appendChild(script);
                } else {
                    loaded++;
                    if (loaded === scripts.length) resolve();
                }
            });
        });
    }

    async function initIndexPage() {
        await refreshFilterCounts();
        await renderTasks();
        await renderRecentDocuments();
        setupSearch();
        setupSidebarFilters();
    }

    async function refreshFilterCounts() {
        const stats = await documentsManager.getDocumentStats();
        updateFilterCounts(stats);
    }

    async function renderTasks() {
        const user = auth.getCurrentUser();
        const isRegularUser = user && user.role === 'Пользователь';
        
        // Скрываем секцию задач для обычных пользователей
        if (isRegularUser) {
            const tasksSection = document.querySelector('.dashboard-section');
            const tasksHeader = tasksSection ? tasksSection.querySelector('h2.section-title') : null;
            if (tasksHeader && tasksHeader.textContent.includes('задачи согласования')) {
                tasksSection.style.display = 'none';
            }
            return;
        }
        
        const myApprovals = await approvalsManager.getMyApprovals();
        const container = document.querySelector('.task-list');
        
        if (!container) return;

        if (myApprovals.length === 0) {
            container.innerHTML = '<li class="task-item"><div class="task-title">Нет задач согласования</div></li>';
            return;
        }

        container.innerHTML = myApprovals.slice(0, 3).map(approval => {
            const isOverdue = approvalsManager.checkOverdue(approval);
            const deadline = approvalsManager.formatDate(approval.deadline);
            const today = new Date();
            const deadlineDate = new Date(approval.deadline);
            const daysLeft = Math.ceil((deadlineDate - today) / (1000 * 60 * 60 * 24));
            
            let statusText = '';
            if (isOverdue) {
                statusText = 'Просрочено';
            } else if (daysLeft <= 3) {
                statusText = `Осталось ${daysLeft} ${daysLeft === 1 ? 'день' : daysLeft < 5 ? 'дня' : 'дней'}`;
            } else {
                statusText = `Осталось ${daysLeft} дней`;
            }

            return `
                <li class="task-item ${isOverdue ? 'urgent' : ''}" data-task-id="${approval.id}">
                    <div class="task-title">${approval.documentName}</div>
                    <div class="task-meta">
                        <span>Срок: до ${deadline}</span>
                        <span>${statusText}</span>
                    </div>
                </li>
            `;
        }).join('');

        // Обработчик клика на задачу
        container.querySelectorAll('.task-item').forEach(item => {
            item.addEventListener('click', function() {
                window.location.href = 'approvals.html';
            });
        });
    }

    async function renderRecentDocuments() {
        const documents = await documentsManager.getAllDocuments();
        const sorted = documents.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
        const recent = sorted.slice(0, 4);
        const container = document.querySelector('.document-list');
        
        if (!container) return;

        // Проверяем роль пользователя
        const user = auth.getCurrentUser();
        const isRegularUser = user && user.role === 'Пользователь';

        container.innerHTML = recent.map(doc => {
            // Для обычных пользователей показываем только кнопку "Скачать"
            const actions = isRegularUser 
                ? `<button class="btn btn-download" data-doc-id="${doc.id}">Скачать</button>`
                : `
                    <button class="btn btn-download" data-doc-id="${doc.id}">Скачать</button>
                    <button class="btn btn-edit" data-doc-id="${doc.id}">Редактировать</button>
                `;
            
            return `
            <li class="document-item" data-doc-id="${doc.id}">
                <div class="document-details">
                    <div class="document-name">${doc.name}</div>
                    <div class="document-meta">
                        <div>Изменен: ${documentsManager.formatDate(doc.updatedAt)}</div>
                        <div><span class="status ${documentsManager.getStatusClass(doc.status)}">${documentsManager.getStatusText(doc.status)}</span></div>
                        <div>Автор: ${doc.author}</div>
                    </div>
                </div>
                <div class="document-actions">
                    ${actions}
                </div>
            </li>
        `;
        }).join('');

        // Обработчики действий
        container.querySelectorAll('.btn-download').forEach(btn => {
            btn.addEventListener('click', function() {
                const docId = this.getAttribute('data-doc-id');
                const doc = documentsManager.getDocumentById(docId);
                if (doc && doc.fileUrl) {
                    window.open(doc.fileUrl, '_blank');
                } else {
                    alert('Файл не прикреплен к документу');
                }
            });
        });

        // Обработчик редактирования только для не-обычных пользователей
        if (!isRegularUser) {
            container.querySelectorAll('.btn-edit').forEach(btn => {
                btn.addEventListener('click', function() {
                    const docId = this.getAttribute('data-doc-id');
                    window.location.href = `documents.html?edit=${docId}`;
                });
            });
        }
    }

    function setupSidebarFilters() {
        const filterLinks = document.querySelectorAll('.filter-options a[data-filter-type]');
        filterLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                const type = this.dataset.filterType;
                const value = this.dataset.filterValue;
                sessionStorage.setItem('documentsFilter', JSON.stringify({ type, value }));
                window.location.href = 'documents.html';
            });
        });
    }

    function updateFilterCounts(stats) {
        const statusCounts = Object.assign({}, stats.byStatus, { all: stats.total });
        const categoryCounts = Object.assign({}, stats.byCategory, { category_all: stats.total });

        document.querySelectorAll('.filter-count').forEach(span => {
            const key = span.dataset.filterKey;
            if (key in statusCounts) {
                span.textContent = statusCounts[key];
            } else if (key && key in categoryCounts) {
                span.textContent = categoryCounts[key];
            }
        });
    }

    function setupSearch() {
        const searchInput = document.querySelector('.search-input');
        const searchButton = document.querySelector('.search-button');

        if (searchInput && searchButton) {
            searchButton.addEventListener('click', function() {
                const query = searchInput.value.trim();
                if (query) {
                    window.location.href = `documents.html?search=${encodeURIComponent(query)}`;
                } else {
                    window.location.href = 'documents.html';
                }
            });

            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    searchButton.click();
                }
            });
        }
    }

});

