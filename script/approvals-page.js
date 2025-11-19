// Скрипт для страницы согласований

document.addEventListener('DOMContentLoaded', function() {
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
        // Проверяем роль пользователя
        const user = auth.getCurrentUser();
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
                document.querySelector('.tab[data-tab="my-approvals"]').classList.remove('active');
                document.getElementById('my-approvals').classList.remove('active');
                document.getElementById('initiated').classList.add('active');
            }
        }
        
        // Настройка табов
        setupTabs();
        
        await renderApprovals();
        setupEventHandlers();
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

    async function renderApprovals() {
        const user = auth.getCurrentUser();
        console.log('Текущий пользователь для отображения согласований:', user);
        const isRegularUser = user && user.role === 'Пользователь';
        
        console.log('Получение моих согласований...');
        const myApprovals = await approvalsManager.getMyApprovals();
        console.log('Мои согласования получены:', myApprovals);
        console.log('Количество моих согласований:', myApprovals.length);
        
        const container = document.querySelector('#my-approvals .approval-grid');
        
        if (container && !isRegularUser) {
            if (myApprovals.length === 0) {
                container.innerHTML = '<p style="text-align: center; padding: 20px;">Нет задач согласования</p>';
            } else {
                container.innerHTML = myApprovals.map(approval => {
                    const isOverdue = approvalsManager.checkOverdue(approval);
                    const currentStep = approval.steps.find(s => s.status === 'pending');
                    const completedSteps = approval.steps.filter(s => s.status === 'approved').length;
                    const totalSteps = approval.steps.length;
                    const progress = (completedSteps / totalSteps) * 100;

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
                                ${isRegularUser ? '' : `
                                    <button class="btn btn-approve" data-approval-id="${approval.id}" data-step-id="${currentStep.id}">Согласовать</button>
                                    <button class="btn btn-reject" data-approval-id="${approval.id}" data-step-id="${currentStep.id}">Отклонить</button>
                                `}
                                <button class="btn btn-view" data-doc-id="${approval.documentId}">Просмотреть</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Инициированные мной
        console.log('Получение всех согласований...');
        const allApprovals = await approvalsManager.getAllApprovals();
        console.log('Все согласования получены:', allApprovals);
        console.log('Количество всех согласований:', allApprovals.length);
        console.log('ID текущего пользователя:', user.user_id);
        
        const initiated = allApprovals.filter(a => {
            console.log('Проверка согласования:', a.id, 'initiatorId:', a.initiatorId, 'user_id:', user.user_id, 'совпадение:', a.initiatorId === user.user_id);
            return a.initiatorId === user.user_id;
        });
        console.log('Инициированные мной согласования:', initiated);
        console.log('Количество инициированных:', initiated.length);
        
        const initiatedContainer = document.querySelector('#initiated .approval-grid');
        
        if (initiatedContainer) {
            if (initiated.length === 0) {
                initiatedContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Нет инициированных согласований</p>';
            } else {
                initiatedContainer.innerHTML = initiated.map(approval => {
                    const completedSteps = approval.steps.filter(s => s.status === 'approved').length;
                    const totalSteps = approval.steps.length;
                    const progress = (completedSteps / totalSteps) * 100;
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
                                <button class="btn btn-view" data-doc-id="${approval.documentId}">Просмотреть</button>
                                ${isCompleted ? '<button class="btn btn-download" data-doc-id="' + approval.documentId + '">Скачать</button>' : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
        
        // Завершенные согласования
        const completed = allApprovals.filter(a => a.status === 'completed' || a.status === 'rejected');
        const completedContainer = document.querySelector('#completed .approval-grid');
        
        if (completedContainer) {
            console.log('Завершенные согласования:', completed);
            if (completed.length === 0) {
                completedContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Нет завершенных согласований</p>';
            } else {
                completedContainer.innerHTML = completed.map(approval => {
                    const completedSteps = approval.steps.filter(s => s.status === 'approved').length;
                    const totalSteps = approval.steps.length;
                    const progress = (completedSteps / totalSteps) * 100;
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
                                <button class="btn btn-view" data-doc-id="${approval.documentId}">Просмотреть</button>
                                ${!isRejected ? '<button class="btn btn-download" data-doc-id="' + approval.documentId + '">Скачать</button>' : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
        
        // Завершенные согласования
        const completed = allApprovals.filter(a => a.status === 'completed' || a.status === 'rejected');
        const completedContainer = document.querySelector('#completed .approval-grid');
        
        if (completedContainer) {
            console.log('Завершенные согласования:', completed);
            if (completed.length === 0) {
                completedContainer.innerHTML = '<p style="text-align: center; padding: 20px;">Нет завершенных согласований</p>';
            } else {
                completedContainer.innerHTML = completed.map(approval => {
                    const completedSteps = approval.steps.filter(s => s.status === 'approved').length;
                    const totalSteps = approval.steps.length;
                    const progress = (completedSteps / totalSteps) * 100;
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
                                <button class="btn btn-view" data-doc-id="${approval.documentId}">Просмотреть</button>
                                ${!isRejected ? '<button class="btn btn-download" data-doc-id="' + approval.documentId + '">Скачать</button>' : ''}
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }
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
        // Согласование
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-approve')) {
                const approvalId = e.target.getAttribute('data-approval-id');
                const stepId = e.target.getAttribute('data-step-id');
                approveStep(approvalId, stepId);
            }
        });

        // Отклонение
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-reject')) {
                const approvalId = e.target.getAttribute('data-approval-id');
                const stepId = e.target.getAttribute('data-step-id');
                rejectStep(approvalId, stepId);
            }
        });
    }

    async function approveStep(approvalId, stepId) {
        const comment = prompt('Комментарий (необязательно):');
        if (await approvalsManager.approveStep(approvalId, stepId, comment)) {
            alert('Документ согласован!');
            await renderApprovals();
        }
    }

    async function rejectStep(approvalId, stepId) {
        const comment = prompt('Причина отклонения:');
        if (comment && await approvalsManager.rejectStep(approvalId, stepId, comment)) {
            alert('Документ отклонен!');
            await renderApprovals();
        }
    }

});

