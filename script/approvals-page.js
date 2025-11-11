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
        await renderApprovals();
        setupEventHandlers();
    }

    async function renderApprovals() {
        const user = auth.getCurrentUser();
        const myApprovals = await approvalsManager.getMyApprovals();
        const container = document.querySelector('#my-approvals .approval-grid');
        
        if (container) {
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
                                <button class="btn btn-approve" data-approval-id="${approval.id}" data-step-id="${currentStep.id}">Согласовать</button>
                                <button class="btn btn-reject" data-approval-id="${approval.id}" data-step-id="${currentStep.id}">Отклонить</button>
                                <button class="btn btn-view" data-doc-id="${approval.documentId}">Просмотреть</button>
                            </div>
                        </div>
                    `;
                }).join('');
            }
        }

        // Инициированные мной
        const allApprovals = await approvalsManager.getAllApprovals();
        const initiated = allApprovals.filter(a => a.initiatorId === user.user_id);
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

