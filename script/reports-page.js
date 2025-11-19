document.addEventListener('DOMContentLoaded', function() {
    if (typeof auth === 'undefined' || !auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    waitForModules().then(() => {
        initReportsPage();
    });

    function waitForModules() {
        return new Promise(resolve => {
            const start = Date.now();
            const interval = setInterval(() => {
                if (typeof documentsManager !== 'undefined' && typeof approvalsManager !== 'undefined') {
                    clearInterval(interval);
                    resolve();
                } else if (Date.now() - start > 5000) {
                    clearInterval(interval);
                    console.warn('Не удалось дождаться загрузки модулей для отчетов');
                    resolve();
                }
            }, 100);
        });
    }

    async function initReportsPage() {
        setupTabs();
        await updateStats();
    }

    function setupTabs() {
        const tabs = document.querySelectorAll('.tab');
        const contents = document.querySelectorAll('.tab-content');

        tabs.forEach(tab => {
            tab.addEventListener('click', function() {
                const target = this.getAttribute('data-tab');

                tabs.forEach(t => t.classList.remove('active'));
                contents.forEach(c => c.classList.remove('active'));

                this.classList.add('active');
                const content = document.getElementById(target);
                if (content) {
                    content.classList.add('active');
                }
            });
        });
    }

    async function updateStats() {
        try {
            const [docStats, approvalsStats] = await Promise.all([
                documentsManager.getDocumentStats(),
                getApprovalsStats()
            ]);

            updateDocumentStatsUI(docStats);
            updateApprovalsStatsUI(approvalsStats);
            updateProjectStatsUI(docStats);
        } catch (error) {
            console.error('Ошибка обновления статистики отчетов:', error);
        }
    }

    function updateDocumentStatsUI(stats) {
        setValue('reportsStatTotalDocs', stats.total);
        setValue('reportsStatReview', stats.byStatus.review);
        setValue('reportsStatApproved', stats.byStatus.approved);

        setValue('reportDocsTotal', stats.total);
        setValue('reportDocsApproved', stats.byStatus.approved);
        setValue('reportDocsReview', stats.byStatus.review);
    }

    function updateApprovalsStatsUI(stats) {
        setValue('reportsStatOverdue', stats.overdue);
        setValue('reportApprovalsActive', stats.active);
        setValue('reportApprovalsAvg', stats.avgDuration);
        setValue('reportApprovalsOverdue', `${stats.overduePercent}%`);
    }

    function updateProjectStatsUI(stats) {
        const projectDocs = stats.byCategory['Проектные'] || 0;
        const categoriesCount = Object.keys(stats.byCategory).length;
        const progressPercent = stats.total
            ? Math.round((stats.byStatus.approved / stats.total) * 100)
            : 0;

        setValue('reportProjectsCount', categoriesCount);
        setValue('reportProjectsDocs', projectDocs);
        setValue('reportProjectsProgress', `${progressPercent}%`);
    }

    async function getApprovalsStats() {
        const approvals = await approvalsManager.getAllApprovals();
        const active = approvals.filter(p => p.status === 'in_progress');
        const completed = approvals.filter(p => p.status === 'completed');
        const overdue = approvals.filter(p => approvalsManager.checkOverdue(p));

        const avgDuration = completed.length > 0
            ? (completed.reduce((sum, approval) => {
                const start = approval.createdAt ? new Date(approval.createdAt) : null;
                const end = approval.endDate ? new Date(approval.endDate) : null;
                if (!start || !end) return sum;
                const diffDays = (end - start) / (1000 * 60 * 60 * 24);
                return sum + Math.max(diffDays, 0);
            }, 0) / completed.length).toFixed(1)
            : '0';

        const overduePercent = approvals.length > 0
            ? Math.round((overdue.length / approvals.length) * 100)
            : 0;

        return {
            total: approvals.length,
            active: active.length,
            completed: completed.length,
            overdue: overdue.length,
            avgDuration,
            overduePercent
        };
    }

    function setValue(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }
});


