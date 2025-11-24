// Система управления согласованиями с использованием JSON базы данных

const approvalsManager = {
    // Инициализация
    async init() {
        if (typeof database === 'undefined') {
            await new Promise(resolve => {
                const checkDatabase = setInterval(() => {
                    if (typeof database !== 'undefined') {
                        clearInterval(checkDatabase);
                        resolve();
                    }
                }, 100);
            });
        }
        await database.init();
    },

    // Получить все согласования
    async getAllApprovals() {
        await this.init();
        // Принудительно синхронизируем данные перед получением
        database.syncWithLocalStorage();
        const processes = database.getTable('approval_processes');
        console.log('getAllApprovals: процессы из БД (сырые):', processes);
        console.log('getAllApprovals: количество процессов:', processes.length);
        
        const mapped = processes.map(process => {
            const mapped = this._mapApprovalFromDB(process);
            console.log('getAllApprovals: маппинг процесса', process.process_id, '->', mapped);
            return mapped;
        }).filter(a => a !== null);
        
        console.log('getAllApprovals: замапленные согласования:', mapped);
        console.log('getAllApprovals: количество замапленных:', mapped.length);
        return mapped;
    },

    // Маппинг согласования из БД в формат приложения
    _mapApprovalFromDB: function(dbProcess) {
        if (!dbProcess) {
            console.error('Попытка маппинга пустого процесса согласования');
            return null;
        }
        
        console.log('Маппинг процесса согласования:', dbProcess);
        console.log('document_id процесса:', dbProcess.document_id);
        console.log('initiator_id процесса:', dbProcess.initiator_id);
        
        // Принудительно синхронизируем данные перед поиском
        database.syncWithLocalStorage();
        
        const document = database.find('documents', d => d.document_id === dbProcess.document_id);
        console.log('Найденный документ:', document);
        
        const initiator = database.find('users', u => u.user_id === dbProcess.initiator_id);
        console.log('Найденный инициатор:', initiator);
        
        const allSteps = database.findAll('approval_steps', s => s.process_id === dbProcess.process_id);
        console.log('Все шаги для процесса', dbProcess.process_id, ':', allSteps);
        
        const steps = allSteps
            .sort((a, b) => a.step_number - b.step_number)
            .map(step => {
                const assignee = database.find('users', u => u.user_id === step.assignee_id);
                const mappedStep = {
                    id: step.step_id,
                    step_id: step.step_id,
                    step_number: step.step_number,
                    approverId: step.assignee_id,
                    approverName: assignee ? assignee.full_name : 'Неизвестно',
                    status: this._mapStepStatus(step.status, step.decision),
                    approvedAt: step.completed_at,
                    comment: step.comment || ''
                };
                console.log('Маппинг шага:', step, '->', mappedStep);
                return mappedStep;
            });

        const mapped = {
            id: dbProcess.process_id,
            process_id: dbProcess.process_id,
            documentId: dbProcess.document_id,
            documentName: document ? document.name : 'Неизвестный документ',
            initiatorId: dbProcess.initiator_id,
            initiatorName: initiator ? initiator.full_name : 'Неизвестно',
            status: this._mapProcessStatus(dbProcess.status),
            createdAt: dbProcess.start_date,
            deadline: dbProcess.deadline,
            endDate: dbProcess.end_date,
            steps: steps
        };
        
        console.log('Процесс согласования замаплен:', mapped);
        console.log('Детали замапленного процесса:', JSON.stringify(mapped, null, 2));
        return mapped;
    },

    // Маппинг статуса процесса
    _mapProcessStatus: function(status) {
        const statusMap = {
            'in_progress': 'in_progress',
            'completed': 'completed',
            'rejected': 'rejected',
            'cancelled': 'cancelled'
        };
        return statusMap[status] || status;
    },

    // Маппинг статуса шага
    _mapStepStatus: function(status, decision) {
        if (status === 'completed') {
            return decision === 'approve' ? 'approved' : 'rejected';
        }
        if (status === 'pending') {
            return 'pending';
        }
        return 'waiting';
    },

    // Сохранить согласования (для обратной совместимости)
    saveApprovals: function(approvals) {
        console.warn('saveApprovals устарел, используйте методы БД');
    },

    // Получить согласование по ID
    async getApprovalById(id) {
        await this.init();
        const dbProcess = database.find('approval_processes', p => p.process_id === parseInt(id));
        if (dbProcess) {
            return this._mapApprovalFromDB(dbProcess);
        }
        return null;
    },

    // Получить согласования для документа
    async getApprovalsByDocumentId(documentId) {
        await this.init();
        const processes = database.findAll('approval_processes', p => p.document_id === parseInt(documentId));
        return processes.map(process => this._mapApprovalFromDB(process));
    },

    // Получить согласования текущего пользователя
    async getMyApprovals() {
        await this.init();
        const user = auth.getCurrentUser();
        if (!user) {
            console.log('getMyApprovals: пользователь не авторизован');
            return [];
        }

        console.log('getMyApprovals: текущий пользователь:', user);
        console.log('getMyApprovals: user_id:', user.user_id);
        
        const allProcesses = await this.getAllApprovals();
        console.log('getMyApprovals: все процессы:', allProcesses);
        
        const filtered = allProcesses.filter(approval => {
            // Находим текущий шаг согласования
            const currentStep = approval.steps.find(step => step.status === 'pending');
            console.log('getMyApprovals: проверка согласования', approval.id, 'текущий шаг:', currentStep);
            if (currentStep) {
                // Приводим к числам для корректного сравнения
                const approverId = typeof currentStep.approverId === 'string' ? parseInt(currentStep.approverId) : currentStep.approverId;
                const userId = typeof user.user_id === 'string' ? parseInt(user.user_id) : user.user_id;
                const match = approverId === userId;
                console.log('getMyApprovals: approverId:', currentStep.approverId, '->', approverId, 'user_id:', user.user_id, '->', userId, 'совпадение:', match);
                return match;
            }
            return false;
        });
        
        console.log('getMyApprovals: отфильтрованные согласования:', filtered);
        return filtered;
    },

    // Создать новое согласование
    async createApproval(documentId, steps, deadlineDate = null) {
        console.log('createApproval вызвана с documentId:', documentId, 'steps:', steps, 'deadlineDate:', deadlineDate);
        
        await this.init();
        const user = auth.getCurrentUser();
        
        if (!user) {
            console.error('Пользователь не авторизован');
            return null;
        }
        
        console.log('Текущий пользователь:', user);
        
        // Преобразуем documentId в число, если это строка
        const docId = typeof documentId === 'string' ? parseInt(documentId) : documentId;
        
        const document = await documentsManager.getDocumentById(docId);
        
        console.log('Документ найден:', document);
        
        if (!document) {
            console.error('Документ не найден с ID:', docId);
            return null;
        }
        
        if (!steps || steps.length === 0) {
            console.error('Не указаны шаги согласования');
            return null;
        }

        // Используем переданную дату дедлайна или вычисляем по умолчанию (5 дней от текущей даты)
        let deadline;
        if (deadlineDate && deadlineDate instanceof Date) {
            deadline = deadlineDate;
        } else {
            deadline = new Date();
            deadline.setDate(deadline.getDate() + 5);
        }

        // Создаем процесс согласования
        console.log('Создание процесса согласования...');
        const newProcess = database.insert('approval_processes', {
            document_id: document.document_id || document.id || docId,
            name: `Согласование: ${document.name}`,
            status: 'in_progress',
            initiator_id: user.user_id || user.id,
            start_date: new Date().toISOString(),
            deadline: deadline.toISOString(),
            end_date: null
        });
        
        console.log('Процесс согласования создан:', newProcess);

        // Создаем шаги согласования
        console.log('Создание шагов согласования...');
        steps.forEach((step, index) => {
            const stepData = {
                process_id: newProcess.process_id,
                step_number: index + 1,
                assignee_id: step.approverId,
                status: index === 0 ? 'pending' : 'waiting',
                decision: null,
                comment: '',
                assigned_at: index === 0 ? new Date().toISOString() : null,
                completed_at: null
            };
            console.log(`Создание шага ${index + 1}:`, stepData);
            database.insert('approval_steps', stepData);
        });

        // Обновляем статус документа
        console.log('Обновление статуса документа на review...');
        await documentsManager.updateDocument(docId, { status: 'review' });
        
        // Синхронизируем данные
        console.log('Синхронизация данных с localStorage...');
        database.syncWithLocalStorage();

        // Получаем свежий процесс из БД для маппинга
        const freshProcess = database.find('approval_processes', p => p.process_id === newProcess.process_id);
        console.log('Свежий процесс из БД:', freshProcess);
        
        if (!freshProcess) {
            console.error('Процесс не найден после создания!');
            return null;
        }

        const mappedApproval = this._mapApprovalFromDB(freshProcess);
        console.log('Согласование создано и замаплено:', mappedApproval);
        console.log('Детали маппированного согласования:', JSON.stringify(mappedApproval, null, 2));
        return mappedApproval;
    },

    // Согласовать шаг
    async approveStep(approvalId, stepId, comment) {
        await this.init();
        const dbStep = database.find('approval_steps', s => s.step_id === parseInt(stepId));
        if (!dbStep || dbStep.process_id !== parseInt(approvalId)) return false;

        if (dbStep.status !== 'pending') return false;

        // Обновляем шаг
        database.update('approval_steps', parseInt(stepId), {
            status: 'completed',
            decision: 'approve',
            comment: comment || '',
            completed_at: new Date().toISOString()
        });

        // Активируем следующий шаг
        const process = database.find('approval_processes', p => p.process_id === parseInt(approvalId));
        const allSteps = database.findAll('approval_steps', s => s.process_id === parseInt(approvalId))
            .sort((a, b) => a.step_number - b.step_number);
        
        const nextStep = allSteps.find(s => s.status === 'waiting');
        if (nextStep) {
            database.update('approval_steps', nextStep.step_id, {
                status: 'pending',
                assigned_at: new Date().toISOString()
            });
        } else {
            // Все шаги завершены
            database.update('approval_processes', parseInt(approvalId), {
                status: 'completed',
                end_date: new Date().toISOString()
            });
            const doc = database.find('documents', d => d.document_id === process.document_id);
            if (doc) {
                database.update('documents', doc.document_id, { status: 'approved' });
            }
        }

        return true;
    },

    // Отклонить шаг
    async rejectStep(approvalId, stepId, comment) {
        await this.init();
        const dbStep = database.find('approval_steps', s => s.step_id === parseInt(stepId));
        if (!dbStep || dbStep.process_id !== parseInt(approvalId)) return false;

        if (dbStep.status !== 'pending') return false;

        // Обновляем шаг
        database.update('approval_steps', parseInt(stepId), {
            status: 'completed',
            decision: 'reject',
            comment: comment || 'Отклонено',
            completed_at: new Date().toISOString()
        });

        // Отклоняем процесс
        database.update('approval_processes', parseInt(approvalId), {
            status: 'rejected',
            end_date: new Date().toISOString()
        });

        const process = database.find('approval_processes', p => p.process_id === parseInt(approvalId));
        if (process) {
            const doc = database.find('documents', d => d.document_id === process.document_id);
            if (doc) {
                database.update('documents', doc.document_id, { status: 'rejected' });
            }
        }

        return true;
    },

    // Вычислить дедлайн
    calculateDeadline: function(days) {
        const date = new Date();
        date.setDate(date.getDate() + days);
        return date;
    },

    // Проверить просроченные согласования
    checkOverdue: function(approval) {
        if (!approval.deadline) return false;
        const today = new Date();
        const deadline = new Date(approval.deadline);
        return today > deadline && approval.status === 'in_progress';
    },

    // Форматировать дату
    formatDate: function(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    }
};
