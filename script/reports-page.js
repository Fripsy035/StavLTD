document.addEventListener('DOMContentLoaded', function() {
    if (typeof auth === 'undefined' || !auth.isAuthenticated()) {
        window.location.href = 'login.html';
        return;
    }

    const REPORTS_ARCHIVE_KEY = 'reports_archive';
    const REPORTS_PER_PAGE = 6;
    let archiveCurrentPage = 1;
    const REPORT_TEMPLATES = {
        documents: {
            title: 'Отчет по документообороту',
            async build(period) {
                const stats = await documentsManager.getDocumentStats(period);
                return {
                    summary: `Всего документов: ${stats.total}. Согласовано: ${stats.byStatus.approved}, на согласовании: ${stats.byStatus.review}.`,
                    metrics: {
                        'Документов всего': stats.total,
                        'Черновики': stats.byStatus.draft,
                        'На согласовании': stats.byStatus.review,
                        'Согласовано': stats.byStatus.approved,
                        'Отклонено': stats.byStatus.rejected
                    },
                    details: stats.byCategory
                };
            }
        },
        approvals: {
            title: 'Отчет по согласованиям',
            async build(period) {
                const stats = await getApprovalsStats(period);
                return {
                    summary: `Активных процессов: ${stats.active}, завершено: ${stats.completed}. Просрочено: ${stats.overdue}.`,
                    metrics: {
                        'Всего процессов': stats.total,
                        'Активных': stats.active,
                        'Завершено': stats.completed,
                        'Просрочено': stats.overdue,
                        'Средняя длительность (дн.)': stats.avgDuration,
                        'Просрочено (%)': `${stats.overduePercent}%`
                    }
                };
            }
        },
        projects: {
            title: 'Отчет по проектам',
            async build(period) {
                const stats = await documentsManager.getDocumentStats(period);
                const projectDocs = stats.byCategory['Проектные'] || 0;
                const progress = stats.total ? Math.round((stats.byStatus.approved / stats.total) * 100) : 0;
                return {
                    summary: `Проектных документов: ${projectDocs}. Готовность по завершенным документам — ${progress}%.`,
                    metrics: {
                        'Документов всего': stats.total,
                        'Проектных документов': projectDocs,
                        'Согласовано': stats.byStatus.approved,
                        'В работе': stats.byStatus.review,
                        'Готовность (%)': `${progress}%`
                    },
                    details: stats.byCategory
                };
            }
        }
    };

    const SCHEDULED_TEMPLATES = {
        'weekly-docs': 'documents',
        'monthly-approvals': 'approvals'
    };
    const ALLOWED_PRESETS = new Set(['last30', 'last7', 'custom']);

    const PERIOD_STORAGE_KEY = 'reports_period';

    waitForModules().then(initReportsPage);

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
        setupActions();
        setupPeriodControls();
        setupPagination();
        await updateStats();
        renderArchiveReports();
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

    function setupPeriodControls() {
        const presetSelect = document.getElementById('reportPeriodPreset');
        const customDatesBlock = document.getElementById('reportCustomDates');
        const startInput = document.getElementById('reportStartDate');
        const endInput = document.getElementById('reportEndDate');
        const applyBtn = document.getElementById('applyReportPeriod');

        if (!presetSelect || !applyBtn) return;

        const config = getStoredPeriodConfig();
        presetSelect.value = config.preset;
        if (startInput && config.start) startInput.value = config.start;
        if (endInput && config.end) endInput.value = config.end;
        toggleCustomBlock();

        presetSelect.addEventListener('change', () => {
            toggleCustomBlock();
        });

        applyBtn.addEventListener('click', async function () {
            const preset = presetSelect.value;
            const nextConfig = { preset };

            if (preset === 'custom') {
                const startValue = startInput?.value;
                const endValue = endInput?.value;
                if (!startValue || !endValue) {
                    notify.error('Укажите даты начала и окончания периода.');
                    return;
                }
                if (new Date(startValue) >= new Date(endValue)) {
                    notify.error('Левая дата должна быть меньше правой.');
                    return;
                }
                nextConfig.start = startValue;
                nextConfig.end = endValue;
            } else {
                if (startInput) startInput.value = '';
                if (endInput) endInput.value = '';
            }

            savePeriodConfig(nextConfig);
            await updateStats();
            notify.success('Период обновлен');
        });

        function toggleCustomBlock() {
            if (!customDatesBlock) return;
            customDatesBlock.classList.toggle('active', presetSelect.value === 'custom');
        }
    }

    function setupActions() {
        document.addEventListener('click', async function(e) {
            const generateBtn = e.target.closest('.btn-generate[data-report-type]');
            if (generateBtn) {
                e.preventDefault();
                await handleGenerateReport(generateBtn.getAttribute('data-report-type'), generateBtn);
                return;
            }

            const downloadArchiveBtn = e.target.closest('.btn-download[data-report-id]');
            if (downloadArchiveBtn) {
                e.preventDefault();
                downloadArchiveReport(downloadArchiveBtn.getAttribute('data-report-id'));
                return;
            }

            const scheduledBtn = e.target.closest('.btn-download[data-scheduled]');
            if (scheduledBtn) {
                e.preventDefault();
                const key = scheduledBtn.getAttribute('data-scheduled');
                await downloadScheduledReport(key);
                return;
            }

            const scheduleBtn = e.target.closest('.btn-schedule[data-schedule]');
            if (scheduleBtn) {
                e.preventDefault();
                showScheduleInfo(scheduleBtn.getAttribute('data-schedule'));
            }
        });
    }

    function setupPagination() {
        document.addEventListener('click', function(e) {
            const link = e.target.closest('#reportsArchivePagination a[data-page]');
            if (!link) return;
            e.preventDefault();
            const page = parseInt(link.getAttribute('data-page'), 10);
            if (isNaN(page) || page === archiveCurrentPage) return;
            archiveCurrentPage = Math.max(1, page);
            renderArchiveReports();
        });
    }

    async function handleGenerateReport(type, button) {
        const template = REPORT_TEMPLATES[type];
        if (!template) {
            notify.error('Неизвестный тип отчета');
            return;
        }
        if (button) {
            button.disabled = true;
        }
        try {
            const period = getCurrentPeriod();
            const payload = await template.build(period);
            const report = {
                id: `r_${Date.now()}`,
                type,
                title: template.title,
                periodLabel: period.label,
                periodStart: period.startDate ? period.startDate.toISOString() : null,
                periodEnd: period.endDate ? period.endDate.toISOString() : null,
                generatedAt: new Date().toISOString(),
                ...payload
            };
            addReportToArchive(report);
            archiveCurrentPage = 1; // Сброс на первую страницу при добавлении нового отчета
            renderArchiveReports();
            notify.success('Отчет сформирован. Начинается скачивание файла.');
            downloadReportFile(report);
            return report;
        } catch (error) {
            console.error('Ошибка формирования отчета:', error);
            notify.error('Не удалось сформировать отчет. Попробуйте позже.');
        } finally {
            if (button) {
                button.disabled = false;
            }
        }
    }

    async function updateStats() {
        try {
            const period = getCurrentPeriod();
            updatePeriodLabels(period.label);

            const [docStats, approvalsStats] = await Promise.all([
                documentsManager.getDocumentStats(period),
                getApprovalsStats(period)
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

    function addReportToArchive(report) {
        const archive = getArchiveReports();
        archive.unshift(report);
        if (archive.length > 12) {
            archive.pop();
        }
        localStorage.setItem(REPORTS_ARCHIVE_KEY, JSON.stringify(archive));
    }

    function getArchiveReports() {
        try {
            return JSON.parse(localStorage.getItem(REPORTS_ARCHIVE_KEY)) || [];
        } catch (error) {
            console.warn('Не удалось прочитать архив отчетов', error);
            return [];
        }
    }

    function renderArchiveReports() {
        const listEl = document.getElementById('reportsArchiveList');
        const emptyEl = document.getElementById('reportsArchiveEmpty');
        const paginationEl = document.getElementById('reportsArchivePagination');
        if (!listEl || !emptyEl) return;

        const archive = getArchiveReports();
        if (archive.length === 0) {
            listEl.innerHTML = '';
            emptyEl.style.display = 'block';
            if (paginationEl) {
                paginationEl.innerHTML = '';
                paginationEl.style.display = 'none';
            }
            archiveCurrentPage = 1;
            return;
        }

        emptyEl.style.display = 'none';

        // Пагинация
        const totalPages = Math.max(1, Math.ceil(archive.length / REPORTS_PER_PAGE));
        archiveCurrentPage = Math.min(archiveCurrentPage, totalPages);
        const startIdx = (archiveCurrentPage - 1) * REPORTS_PER_PAGE;
        const paginatedReports = archive.slice(startIdx, startIdx + REPORTS_PER_PAGE);

        listEl.innerHTML = paginatedReports.map(report => createArchiveCard(report)).join('');

        // Рендеринг пагинации
        if (paginationEl) {
            if (totalPages <= 1) {
                paginationEl.innerHTML = '';
                paginationEl.style.display = 'none';
            } else {
                paginationEl.style.display = 'flex';
                paginationEl.innerHTML = Array.from({ length: totalPages }, (_, index) => {
                    const page = index + 1;
                    const activeClass = page === archiveCurrentPage ? 'active' : '';
                    return `<li><a href="#" data-page="${page}" class="${activeClass}">${page}</a></li>`;
                }).join('');
            }
        }
    }

    function createArchiveCard(report) {
        return `
            <div class="report-card">
                <div class="report-header">
                    <div>
                        <div class="report-title">${report.title}</div>
                        <div class="report-meta">Сформирован: ${formatDateTime(report.generatedAt)}</div>
                    </div>
                    <div class="report-type">Архив</div>
                </div>
                <div class="report-period">
                    <strong>Период:</strong> ${report.periodLabel || '—'}
                </div>
                <div class="report-description">
                    ${report.summary || 'Нет описания'}
                </div>
                <div class="report-actions">
                    <button class="btn btn-download" data-report-id="${report.id}">Скачать</button>
                </div>
            </div>
        `;
    }

    function downloadArchiveReport(reportId) {
        const report = getArchiveReports().find(r => r.id === reportId);
        if (!report) {
            notify.error('Отчет не найден');
            return;
        }
        downloadReportFile(report);
    }

    async function downloadScheduledReport(key) {
        const type = SCHEDULED_TEMPLATES[key];
        if (!type) {
            notify.error('Расписание не настроено');
            return;
        }
        const archive = getArchiveReports();
        const report = archive.find(r => r.type === type);
        if (report) {
            downloadReportFile(report);
            return;
        }
        await handleGenerateReport(type);
    }

    function showScheduleInfo(key) {
        const message = {
            'documents-weekly': 'Еженедельный отчет формируется по понедельникам в 09:00 для руководства.',
            'approvals-monthly': 'Месячный отчет по согласованиям формируется 1 числа каждого месяца.',
            'projects-quarterly': 'Проектный отчет доступен ежеквартально.'
        }[key] || 'Настройка расписания находится в разработке.';
        notify.info(message);
    }

    function downloadReportFile(report) {
        const lines = [];
        lines.push(`Отчет: ${report.title || '-'}`);
        lines.push(`Тип: ${report.type || '-'}`);
        lines.push(`Период: ${report.periodLabel || '-'}`);
        lines.push(`Сформирован: ${formatDateTime(report.generatedAt)}`);
        lines.push('');

        if (report.summary) {
            lines.push('Краткое описание:');
            lines.push(report.summary);
            lines.push('');
        }

        if (report.metrics && typeof report.metrics === 'object') {
            lines.push('Показатели:');
            Object.entries(report.metrics).forEach(([key, value]) => {
                lines.push(` - ${key}: ${value}`);
            });
            lines.push('');
        }

        if (report.details) {
            lines.push('Детализация:');
            if (typeof report.details === 'object') {
                Object.entries(report.details).forEach(([key, value]) => {
                    lines.push(` - ${key}: ${value}`);
                });
            } else {
                lines.push(String(report.details));
            }
            lines.push('');
        }

        const content = lines.join('\r\n').trim() + '\r\n';
        const fileName = `${report.type}_${new Date(report.generatedAt).toISOString().split('T')[0]}.txt`;
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    function formatDateTime(dateString) {
        if (!dateString) return '-';
        const date = new Date(dateString);
        if (Number.isNaN(date.getTime())) return '-';
        const datePart = typeof formatDateBySettings === 'function'
            ? formatDateBySettings(date)
            : date.toLocaleDateString('ru-RU');
        const timePart = date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' });
        return `${datePart} ${timePart}`;
    }

    function setValue(id, value) {
        const el = document.getElementById(id);
        if (el) {
            el.textContent = value;
        }
    }

    function updatePeriodLabels(label) {
        setValue('reportDocsPeriod', label);
        setValue('reportApprovalsPeriod', label);
        setValue('reportProjectsPeriod', label);
    }

    function getStoredPeriodConfig() {
        try {
            const stored = JSON.parse(localStorage.getItem(PERIOD_STORAGE_KEY)) || {};
            const preset = ALLOWED_PRESETS.has(stored.preset) ? stored.preset : 'last30';
            const config = { preset };
            if (preset === 'custom' && stored.start && stored.end) {
                config.start = stored.start;
                config.end = stored.end;
            }
            return config;
        } catch (error) {
            console.warn('Не удалось прочитать настройки периода отчетов', error);
            return { preset: 'last30' };
        }
    }

    function savePeriodConfig(config) {
        const data = { preset: config.preset };
        if (config.preset === 'custom' && config.start && config.end) {
            data.start = config.start;
            data.end = config.end;
        }
        localStorage.setItem(PERIOD_STORAGE_KEY, JSON.stringify(data));
    }

    function getCurrentPeriod() {
        const config = getStoredPeriodConfig();
        const now = new Date();
        let start;
        let end = new Date(now);
        let label = 'Последние 30 дней';

        switch (config.preset) {
            case 'last7':
                start = addDays(end, -7);
                label = 'Последние 7 дней';
                break;
            case 'custom':
                if (config.start && config.end) {
                    start = new Date(config.start);
                    end = new Date(config.end);
                    if (start >= end) {
                        return getFallbackPeriod();
                    }
                    label = `${formatDateLabel(start)} — ${formatDateLabel(end)}`;
                    return { startDate: start, endDate: end, label };
                }
                return getFallbackPeriod();
            case 'last30':
            default:
                start = addDays(end, -30);
                label = 'Последние 30 дней';
                break;
        }

        return { startDate: start, endDate: end, label };
    }

    function getFallbackPeriod() {
        const end = new Date();
        const start = addDays(end, -30);
        return { startDate: start, endDate: end, label: 'Последние 30 дней' };
    }

    function addDays(date, amount) {
        const result = new Date(date);
        result.setDate(result.getDate() + amount);
        return result;
    }

    function formatDateLabel(date) {
        return date.toLocaleDateString('ru-RU');
    }
});
