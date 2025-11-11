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
        const processes = database.getTable('approval_processes');
        return processes.map(process => this._mapApprovalFromDB(process));
    },

    // Маппинг согласования из БД в формат приложения
    _mapApprovalFromDB: function(dbProcess) {
        if (!dbProcess) {
            console.error('Попытка маппинга пустого процесса согласования');
            return null;
        }
        
        console.log('Маппинг процесса согласования:', dbProcess);
        
        const document = database.find('documents', d => d.document_id === dbProcess.document_id);
        const initiator = database.find('users', u => u.user_id === dbProcess.initiator_id);
        const steps = database.findAll('approval_steps', s => s.process_id === dbProcess.process_id)
            .sort((a, b) => a.step_number - b.step_number)
            .map(step => {
                const assignee = database.find('users', u => u.user_id === step.assignee_id);
                return {
                    id: step.step_id,
                    step_id: step.step_id,
                    step_number: step.step_number,
                    approverId: step.assignee_id,
                    approverName: assignee ? assignee.full_name : 'Неизвестно',
                    status: this._mapStepStatus(step.status, step.decision),
                    approvedAt: step.completed_at,
                    comment: step.comment || ''
                };
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
        if (!user) return [];

        const allProcesses = await this.getAllApprovals();
        return allProcesses.filter(approval => {
            // Находим текущий шаг согласования
            const currentStep = approval.steps.find(step => step.status === 'pending');
            return currentStep && currentStep.approverId === user.user_id;
        });
    },

    // Создать новое согласование
    async createApproval(documentId, steps) {
        console.log('createApproval вызвана с documentId:', documentId, 'steps:', steps);
        
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

        // Вычисляем deadline (5 дней от текущей даты)
        const deadline = new Date();
        deadline.setDate(deadline.getDate() + 5);

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
        database.syncWithLocalStorage();

        const mappedApproval = this._mapApprovalFromDB(newProcess);
        console.log('Согласование создано и замаплено:', mappedApproval);
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
