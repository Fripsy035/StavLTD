// Скрипт для страницы согласований

document.addEventListener('DOMContentLoaded', function() {
    const APPROVALS_PER_PAGE = 4;
    const approvalsPaginationState = {
        'my-approvals': 1,
        initiated: 1,
        completed: 1
    };

    if (typeof auth === 'undefined' || !auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    loadScripts().then(() => {
        initApprovalsPage();
    });

    function loadScripts() {
        return new Promise((resolve) => {
            const scripts = ['script/auth.js', 'script/documents.js', 'script/approvals.js', 'script/modals.js'];
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

    async function initApprovalsPage() {
        // Принудительно синхронизируем данные перед инициализацией
        if (typeof database !== 'undefined') {
            console.log('Синхронизация данных перед инициализацией страницы согласований...');
            database.syncWithLocalStorage();
        }
        
        // Проверяем роль пользователя
        const user = auth.getCurrentUser();
        console.log('Пользователь на странице согласований:', user);
        const isRegularUser = user && user.role === 'Пользователь';
        
        // Скрываем вкладку "Мои согласования" для обычных пользователей
        if (isRegularUser) {
            const myApprovalsTab = document.querySelector('.tab[data-tab="my-approvals"]');
            if (myApprovalsTab) {
                myApprovalsTab.style.display = 'none';
            }
            // Активируем вкладку "Инициированные мной" или "Завершенные"
            const initiatedTab = document.querySelector('.tab[data-tab="initiated"]');
            if (initiatedTab) {
                initiatedTab.classList.add('active');
                const myApprovalsTabEl = document.querySelector('.tab[data-tab="my-approvals"]');
                if (myApprovalsTabEl) {
                    myApprovalsTabEl.classList.remove('active');
                }
                const myApprovalsContent = document.getElementById('my-approvals');
                if (myApprovalsContent) {
                    myApprovalsContent.classList.remove('active');
                }
                document.getElementById('initiated').classList.add('active');
            }
        }
        
        // Настройка табов
        setupTabs();
        
        // Настройка поиска
        setupSearch();
        
        await renderApprovals();
        setupEventHandlers();
        setupPaginationHandlers();
    }
    
    function setupTabs() {
        const tabs = document.querySelectorAll('.tabs .tab');
        const tabContents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');

                const targetTab = this.dataset.tab;
                tabContents.forEach(content => {
                    content.classList.toggle('active', content.id === targetTab);
                });
            });
        });
    }

    let currentSearchQuery = '';
    
    function setupSearch() {
        const searchInput = document.querySelector('.search-input');
        const searchButton = document.querySelector('.search-button');
        
        if (searchInput && searchButton) {
            const performSearch = async () => {
                currentSearchQuery = searchInput.value.trim().toLowerCase();
                resetApprovalsPagination();
                await renderApprovals();
            };
            
            searchButton.addEventListener('click', performSearch);
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
        }
    }
    
    function filterApprovalsBySearch(approvals) {
        if (!currentSearchQuery) {
            return approvals;
        }
        
        return approvals.filter(approval => {
            const searchLower = currentSearchQuery.toLowerCase();
            return (
                approval.documentName.toLowerCase().includes(searchLower) ||
                approval.initiatorName.toLowerCase().includes(searchLower) ||
                approval.steps.some(step => step.approverName.toLowerCase().includes(searchLower))
            );
        });
    }
    
    async function renderApprovals() {
        const user = auth.getCurrentUser();
        console.log('Текущий пользователь для отображения согласований:', user);
        const isRegularUser = user && user.role === 'Пользователь';
        
        console.log('Получение моих согласований...');
        let myApprovals = await approvalsManager.getMyApprovals();
        console.log('Мои согласования получены:', myApprovals);
        console.log('Количество моих согласований:', myApprovals.length);
        
        // Применяем поиск
        myApprovals = filterApprovalsBySearch(myApprovals);
        
        const container = document.querySelector('#my-approvals .approval-grid');
        
        if (container && !isRegularUser) {
            renderPaginatedSection({
                tabKey: 'my-approvals',
                items: myApprovals,
                containerSelector: '#my-approvals .approval-grid',
                paginationSelector: '#myApprovalsPagination',
                emptyMessage: currentSearchQuery ? 'Ничего не найдено' : 'Нет задач согласования',
                renderItem: approval => buildMyApprovalCard(approval, isRegularUser)
            });
        } else {
            const paginationEl = document.querySelector('#myApprovalsPagination');
            if (paginationEl) {
                paginationEl.innerHTML = '';
                paginationEl.style.display = 'none';
            }
        }

        // Инициированные мной
        console.log('Получение всех согласований...');
        const allApprovals = await approvalsManager.getAllApprovals();
        console.log('Все согласования получены:', allApprovals);
        console.log('Количество всех согласований:', allApprovals.length);
        console.log('ID текущего пользователя:', user.user_id);
        
        let initiated = allApprovals.filter(a => {
            // Приводим к числам для корректного сравнения
            const initiatorId = typeof a.initiatorId === 'string' ? parseInt(a.initiatorId) : a.initiatorId;
            const userId = typeof user.user_id === 'string' ? parseInt(user.user_id) : user.user_id;
            const match = initiatorId === userId;
            console.log('Проверка согласования:', a.id, 'initiatorId:', a.initiatorId, '->', initiatorId, 'user_id:', user.user_id, '->', userId, 'совпадение:', match);
            return match;
        });
        console.log('Инициированные мной согласования:', initiated);
        console.log('Количество инициированных:', initiated.length);
        
        // Применяем поиск
        initiated = filterApprovalsBySearch(initiated);
        
        const initiatedContainer = document.querySelector('#initiated .approval-grid');
        
        renderPaginatedSection({
            tabKey: 'initiated',
            items: initiated,
            containerSelector: '#initiated .approval-grid',
            paginationSelector: '#initiatedApprovalsPagination',
            emptyMessage: currentSearchQuery ? 'Ничего не найдено' : 'Нет инициированных согласований',
            renderItem: approval => buildInitiatedApprovalCard(approval)
        });
        
        // Завершенные согласования
        let completed = allApprovals.filter(a => a.status === 'completed' || a.status === 'rejected');
        console.log('Завершенные согласования:', completed);
        
        // Применяем поиск
        completed = filterApprovalsBySearch(completed);
        
        const completedContainer = document.querySelector('#completed .approval-grid');
        
        renderPaginatedSection({
            tabKey: 'completed',
            items: completed,
            containerSelector: '#completed .approval-grid',
            paginationSelector: '#completedApprovalsPagination',
            emptyMessage: currentSearchQuery ? 'Ничего не найдено' : 'Нет завершенных согласований',
            renderItem: approval => buildCompletedApprovalCard(approval)
        });
    }
    
    function setupTabs() {
        const tabs = document.querySelectorAll('.tabs .tab');
        const tabContents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                tabs.forEach(t => t.classList.remove('active'));
                this.classList.add('active');

                const targetTab = this.dataset.tab;
                tabContents.forEach(content => {
                    content.classList.toggle('active', content.id === targetTab);
                });
            });
        });
    }

    function setupEventHandlers() {
        // Согласование – показываем поле комментария
        document.addEventListener('click', function(e) {
            const approveBtn = e.target.closest('.btn-approve');
            if (!approveBtn) {
                return;
            }
            e.preventDefault();
            showApproveCommentInput(approveBtn);
        });

        // Подтверждение согласования
        document.addEventListener('click', async function(e) {
            const confirmBtn = e.target.closest('.btn-approve-confirm');
            if (!confirmBtn) {
                return;
            }
            e.preventDefault();
            const approvalId = confirmBtn.getAttribute('data-approval-id');
            const stepId = confirmBtn.getAttribute('data-step-id');
            const commentInput = confirmBtn.closest('.approval-comment-box')?.querySelector('.approval-comment-input');
            const comment = commentInput ? commentInput.value.trim() : '';
            await approveStep(approvalId, stepId, comment);
            removeAllCommentBoxes();
        });

        // Отмена ввода комментария
        document.addEventListener('click', function(e) {
            const cancelBtn = e.target.closest('.btn-approve-cancel');
            if (!cancelBtn) {
                return;
            }
            e.preventDefault();
            const box = cancelBtn.closest('.approval-comment-box');
            if (box) {
                box.remove();
            }
        });

        // Отклонение согласования
        document.addEventListener('click', function(e) {
            const rejectBtn = e.target.closest('.btn-reject');
            if (!rejectBtn) {
                return;
            }
            e.preventDefault();
            const approvalId = rejectBtn.getAttribute('data-approval-id');
            const stepId = rejectBtn.getAttribute('data-step-id');
            rejectStep(approvalId, stepId);
        });

        // Скачивание документа
        document.addEventListener('click', async function(e) {
            const downloadBtn = e.target.closest('.btn-download');
            if (!downloadBtn) {
                return;
            }
            e.preventDefault();
            const docId = parseInt(downloadBtn.getAttribute('data-doc-id'), 10);
            if (!Number.isNaN(docId)) {
                await downloadDocumentFile(docId);
            }
        });
    }

    function setupPaginationHandlers() {
        document.addEventListener('click', function(e) {
            const link = e.target.closest('.pagination a[data-tab]');
            if (!link) {
                return;
            }
            e.preventDefault();
            const tabKey = link.dataset.tab;
            const page = parseInt(link.dataset.page, 10);
            if (!tabKey || Number.isNaN(page)) {
                return;
            }
            approvalsPaginationState[tabKey] = page;
            renderApprovals();
        });
    }

    function resetApprovalsPagination() {
        Object.keys(approvalsPaginationState).forEach(key => {
            approvalsPaginationState[key] = 1;
        });
    }

    function renderPaginatedSection({ tabKey, items, containerSelector, paginationSelector, emptyMessage, renderItem }) {
        const container = document.querySelector(containerSelector);
        const paginationEl = document.querySelector(paginationSelector);

        if (!container || !paginationEl) {
            return;
        }

        if (!items || items.length === 0) {
            container.innerHTML = `<p style="text-align: center; padding: 20px;">${emptyMessage}</p>`;
            paginationEl.innerHTML = '';
            paginationEl.style.display = 'none';
            approvalsPaginationState[tabKey] = 1;
            return;
        }

        const totalPages = Math.max(1, Math.ceil(items.length / APPROVALS_PER_PAGE));
        const currentPage = Math.min(approvalsPaginationState[tabKey] || 1, totalPages);
        approvalsPaginationState[tabKey] = currentPage;
        const startIdx = (currentPage - 1) * APPROVALS_PER_PAGE;
        const paginatedItems = items.slice(startIdx, startIdx + APPROVALS_PER_PAGE);

        container.innerHTML = paginatedItems.map(renderItem).join('');

        if (totalPages <= 1) {
            paginationEl.innerHTML = '';
            paginationEl.style.display = 'none';
            return;
        }

        paginationEl.style.display = 'flex';
        paginationEl.innerHTML = Array.from({ length: totalPages }, (_, index) => {
            const page = index + 1;
            const activeClass = page === currentPage ? 'active' : '';
            return `<li><a href="#" data-tab="${tabKey}" data-page="${page}" class="${activeClass}">${page}</a></li>`;
        }).join('');
    }

    function buildMyApprovalCard(approval, isRegularUser) {
        const isOverdue = approvalsManager.checkOverdue(approval);
        const currentStep = approval.steps.find(s => s.status === 'pending') || approval.steps[approval.steps.length - 1];
        const completedSteps = approval.steps.filter(s => s.status === 'approved').length;
        const totalSteps = approval.steps.length;
        const progress = totalSteps ? (completedSteps / totalSteps) * 100 : 0;

        return `
            <div class="approval-card ${isOverdue ? 'urgent' : 'normal'}" data-approval-id="${approval.id}">
                <div class="approval-header">
                    <div>
                        <div class="approval-title">${approval.documentName}</div>
                        <div class="approval-meta">Создан: ${approvalsManager.formatDate(approval.createdAt)} | Срок: до ${approvalsManager.formatDate(approval.deadline)}</div>
                    </div>
                    <div class="approval-status ${isOverdue ? 'status-pending' : 'status-in-progress'}">${isOverdue ? 'Просрочено' : 'В работе'}</div>
                </div>
                <div class="approval-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-text">${completedSteps} из ${totalSteps} этапов завершено</div>
                </div>
                <div class="approval-steps">
                    ${approval.steps.map((step, index) => {
                        let stepClass = 'pending';
                        let stepIcon = (index + 1).toString();
                        if (step.status === 'approved') {
                            stepClass = 'completed';
                            stepIcon = '✓';
                        } else if (step.status === 'pending') {
                            stepClass = 'current';
                            stepIcon = '!';
                        }

                        return `
                            <div class="step ${stepClass}">
                                <div class="step-icon">${stepIcon}</div>
                                <div class="step-info">
                                    <div class="step-name">${step.approverName}</div>
                                    <div class="step-meta">${step.status === 'approved' ? 'Согласовано ' + approvalsManager.formatDate(step.approvedAt) : step.status === 'pending' ? 'Ожидает вашего решения' : 'Ожидает предыдущих этапов'}</div>
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
                <div class="approval-actions">
                    ${isRegularUser || !currentStep ? '' : `
                        <button class="btn btn-approve" data-approval-id="${approval.id}" data-step-id="${currentStep.id}">Согласовать</button>
                        <button class="btn btn-reject" data-approval-id="${approval.id}" data-step-id="${currentStep.id}">Отклонить</button>
                    `}
                    <button class="btn btn-download" data-doc-id="${approval.documentId}">Скачать</button>
                </div>
            </div>
        `;
    }

    function buildInitiatedApprovalCard(approval) {
        const completedSteps = approval.steps.filter(s => s.status === 'approved').length;
        const totalSteps = approval.steps.length;
        const progress = totalSteps ? (completedSteps / totalSteps) * 100 : 0;
        const isCompleted = approval.status === 'completed';

        return `
            <div class="approval-card ${isCompleted ? 'completed' : 'normal'}" data-approval-id="${approval.id}">
                <div class="approval-header">
                    <div>
                        <div class="approval-title">${approval.documentName}</div>
                        <div class="approval-meta">Создан: ${approvalsManager.formatDate(approval.createdAt)}${isCompleted ? ' | Завершен: ' + approvalsManager.formatDate(approval.createdAt) : ''}</div>
                    </div>
                    <div class="approval-status ${isCompleted ? 'status-approved' : 'status-in-progress'}">${isCompleted ? 'Согласован' : 'В работе'}</div>
                </div>
                <div class="approval-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-text">${isCompleted ? 'Все этапы завершены' : completedSteps + ' из ' + totalSteps + ' этапов завершено'}</div>
                </div>
                <div class="approval-actions">
                    <button class="btn btn-download" data-doc-id="${approval.documentId}">Скачать</button>
                </div>
            </div>
        `;
    }

    function buildCompletedApprovalCard(approval) {
        const completedSteps = approval.steps.filter(s => s.status === 'approved').length;
        const totalSteps = approval.steps.length;
        const progress = totalSteps ? (completedSteps / totalSteps) * 100 : 0;
        const isRejected = approval.status === 'rejected';

        return `
            <div class="approval-card ${isRejected ? 'urgent' : 'completed'}" data-approval-id="${approval.id}">
                <div class="approval-header">
                    <div>
                        <div class="approval-title">${approval.documentName}</div>
                        <div class="approval-meta">Создан: ${approvalsManager.formatDate(approval.createdAt)} | ${isRejected ? 'Отклонен' : 'Завершен'}: ${approvalsManager.formatDate(approval.endDate || approval.createdAt)}</div>
                    </div>
                    <div class="approval-status ${isRejected ? 'status-pending' : 'status-approved'}">${isRejected ? 'Отклонен' : 'Завершен'}</div>
                </div>
                <div class="approval-progress">
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${progress}%"></div>
                    </div>
                    <div class="progress-text">${isRejected ? 'Согласование отклонено' : completedSteps + ' из ' + totalSteps + ' этапов завершено'}</div>
                </div>
                <div class="approval-actions">
                    <button class="btn btn-download" data-doc-id="${approval.documentId}">Скачать</button>
                </div>
            </div>
        `;
    }
    function removeAllCommentBoxes() {
        document.querySelectorAll('.approval-comment-box').forEach(box => box.remove());
    }

    function showApproveCommentInput(button) {
        const card = button.closest('.approval-card');
        if (!card) return;

        // Удаляем предыдущие поля ввода во всех карточках
        removeAllCommentBoxes();

        const approvalId = button.getAttribute('data-approval-id');
        const stepId = button.getAttribute('data-step-id');

        const commentBoxHtml = `
            <div class="approval-comment-box">
                <input type="text" class="approval-comment-input" placeholder="Комментарий (необязательно)">
                <div class="comment-actions">
                    <button class="btn btn-primary btn-approve-confirm" data-approval-id="${approvalId}" data-step-id="${stepId}">Подтвердить</button>
                    <button class="btn btn-secondary btn-approve-cancel">Отмена</button>
                </div>
            </div>
        `;

        card.insertAdjacentHTML('beforeend', commentBoxHtml);
        const input = card.querySelector('.approval-comment-box .approval-comment-input');
        if (input) {
            input.focus();
        }
    }

    async function approveStep(approvalId, stepId, comment = '') {
        if (await approvalsManager.approveStep(approvalId, stepId, comment)) {
            notify.success('Документ согласован');
            await renderApprovals();
        }
    }

    async function rejectStep(approvalId, stepId) {
        const comment = prompt('Причина отклонения:');
        if (comment && await approvalsManager.rejectStep(approvalId, stepId, comment)) {
            notify.error('Документ отклонен');
            await renderApprovals();
        }
    }

    async function downloadDocumentFile(docId) {
        try {
            const document = await documentsManager.getDocumentById(docId);
            if (!document) {
                notify.error('Документ не найден');
                return;
            }
            if (document.fileUrl) {
                window.open(document.fileUrl, '_blank');
            } else {
                notify.error('К документу не прикреплен файл');
            }
        } catch (error) {
            console.error('Ошибка при скачивании документа:', error);
            notify.error('Не удалось открыть документ');
        }
    }

});

