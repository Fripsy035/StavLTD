// Система управления документами с использованием JSON базы данных

const documentsManager = {
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

    // Получить все документы
    async getAllDocuments() {
        await this.init();
        // Принудительно обновляем данные из кэша перед получением
        database.syncWithLocalStorage();
        const documents = database.getTable('documents');
        console.log('Документы из БД (сырые):', documents);
        console.log('Количество документов в БД:', documents.length);
        
        const mapped = documents
            .map(doc => this._mapDocumentFromDB(doc))
            .filter(doc => doc !== null); // Убираем null значения
        
        console.log('Документы после маппинга:', mapped);
        console.log('Количество документов после маппинга:', mapped.length);
        return mapped;
    },

    // Маппинг документа из БД в формат приложения
    _mapDocumentFromDB: function(dbDoc) {
        if (!dbDoc) {
            console.error('Попытка маппинга пустого документа');
            return null;
        }
        
        const author = database.find('users', u => u.user_id === dbDoc.author_id);
        const category = database.find('categories', c => c.category_id === dbDoc.category_id);
        const docType = database.find('document_types', t => t.type_id === dbDoc.type_id);
        const versions = database.findAll('document_versions', v => v.document_id === dbDoc.document_id);
        const latestVersion = versions.length > 0 
            ? versions.sort((a, b) => b.version_number - a.version_number)[0]
            : null;

        const mapped = {
            id: dbDoc.document_id,
            document_id: dbDoc.document_id,
            name: dbDoc.name || 'Без названия',
            author: author ? author.full_name : (auth.getCurrentUser() ? auth.getCurrentUser().fullName : 'Неизвестно'),
            authorId: dbDoc.author_id,
            status: dbDoc.status || 'draft',
            category: category ? category.name : 'Без категории',
            category_id: dbDoc.category_id,
            type_id: dbDoc.type_id,
            type: docType ? docType.name : '',
            createdAt: dbDoc.created_at || new Date().toISOString(),
            updatedAt: dbDoc.updated_at || dbDoc.created_at || new Date().toISOString(),
            description: latestVersion ? latestVersion.change_comment : '',
            fileUrl: latestVersion ? latestVersion.file_name : '',
            fileSize: latestVersion ? latestVersion.file_size : 0,
            version: latestVersion ? latestVersion.version_number : 1
        };
        
        console.log('Маппинг документа:', dbDoc, '->', mapped);
        return mapped;
    },

    // Сохранить документы (для обратной совместимости)
    saveDocuments: function(documents) {
        // Не используется при работе с БД
        console.warn('saveDocuments устарел, используйте методы БД');
    },

    // Получить документ по ID
    async getDocumentById(id) {
        await this.init();
        const dbDoc = database.find('documents', d => d.document_id === parseInt(id));
        if (dbDoc) {
            return this._mapDocumentFromDB(dbDoc);
        }
        return null;
    },

    // Создать новый документ
    async createDocument(documentData) {
        await this.init();
        const user = auth.getCurrentUser();
        if (!user) {
            console.error('Пользователь не авторизован');
            return null;
        }

        console.log('Создание документа пользователем:', user);
        console.log('Данные документа:', documentData);

        // Проверяем user_id
        const authorId = user.user_id || user.id;
        if (!authorId) {
            console.error('У пользователя нет user_id или id');
            return null;
        }

        // Найти категорию по имени или создать новую
        let category = database.find('categories', c => c.name === documentData.category);
        if (!category && documentData.category) {
            category = database.insert('categories', {
                name: documentData.category,
                parent_id: null,
                path: documentData.category
            });
            console.log('Создана новая категория:', category);
        }

        // Найти тип документа (по умолчанию первый)
        const docType = database.getTable('document_types')[0];
        const typeId = docType ? docType.type_id : null;

        // Создаем документ
        const newDoc = database.insert('documents', {
            name: documentData.name,
            type_id: typeId,
            category_id: category ? category.category_id : null,
            status: 'draft',
            author_id: authorId,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
        });
        
        console.log('Создан документ в БД:', newDoc);

        // Создаем первую версию (всегда создаем версию, даже если нет файла или описания)
        const version = database.insert('document_versions', {
            document_id: newDoc.document_id,
            version_number: 1,
            file_name: documentData.fileUrl || '',
            file_size: 0,
            change_comment: documentData.description || 'Первоначальная версия',
            author_id: authorId,
            created_at: new Date().toISOString()
        });
        console.log('Создана версия документа:', version);

        // Принудительно обновляем данные из кэша
        database.syncWithLocalStorage();
        
        // Получаем документ заново для маппинга
        const freshDoc = database.find('documents', d => d.document_id === newDoc.document_id);
        console.log('Свежий документ из БД:', freshDoc);
        
        const mappedDoc = this._mapDocumentFromDB(freshDoc);
        console.log('Создан и замаплен документ:', mappedDoc);
        return mappedDoc;
    },

    // Обновить документ
    async updateDocument(id, documentData) {
        await this.init();
        const dbDoc = database.find('documents', d => d.document_id === parseInt(id));
        if (!dbDoc) return null;

        // Обновляем категорию если изменилась
        let categoryId = dbDoc.category_id;
        if (documentData.category && documentData.category !== dbDoc.category_id) {
            let category = database.find('categories', c => c.name === documentData.category);
            if (!category) {
                category = database.insert('categories', {
                    name: documentData.category,
                    parent_id: null,
                    path: documentData.category
                });
            }
            categoryId = category.category_id;
        }

        // Обновляем документ
        const updateData = {
            name: documentData.name || dbDoc.name,
            category_id: categoryId,
            updated_at: new Date().toISOString()
        };
        
        // Если передан статус, обновляем его
        if (documentData.status) {
            updateData.status = documentData.status;
        }
        
        console.log('Обновление документа с ID:', id, 'данные:', updateData);
        const updated = database.update('documents', parseInt(id), updateData);
        console.log('Документ обновлен:', updated);

        // Создаем новую версию если есть изменения
        if (documentData.fileUrl || documentData.description) {
            const latestVersion = database.findAll('document_versions', v => v.document_id === parseInt(id))
                .sort((a, b) => b.version_number - a.version_number)[0];
            const newVersionNumber = latestVersion ? latestVersion.version_number + 1 : 1;

            database.insert('document_versions', {
                document_id: parseInt(id),
                version_number: newVersionNumber,
                file_name: documentData.fileUrl || (latestVersion ? latestVersion.file_name : ''),
                file_size: 0,
                change_comment: documentData.description || 'Обновление документа',
                author_id: auth.getCurrentUser().user_id,
                created_at: new Date().toISOString()
            });
        }

        return this._mapDocumentFromDB(updated);
    },

    // Удалить документ
    async deleteDocument(id) {
        await this.init();
        // Удаляем все версии
        const versions = database.findAll('document_versions', v => v.document_id === parseInt(id));
        versions.forEach(v => database.delete('document_versions', v.version_id));
        
        // Удаляем документ
        return database.delete('documents', parseInt(id));
    },

    // Фильтрация документов
    async filterDocuments(filters) {
        await this.init();
        let documents = await this.getAllDocuments();
        
        // Фильтр по статусу
        if (filters.status) {
            documents = documents.filter(doc => doc.status === filters.status);
        }
        
        // Фильтр по категории
        if (filters.category) {
            documents = documents.filter(doc => doc.category === filters.category);
        }
        
        // Фильтр по автору
        if (filters.authorId) {
            documents = documents.filter(doc => doc.authorId === parseInt(filters.authorId));
        }
        
        // Поиск по названию/описанию
        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            documents = documents.filter(doc => 
                doc.name.toLowerCase().includes(searchLower) ||
                doc.description.toLowerCase().includes(searchLower) ||
                doc.author.toLowerCase().includes(searchLower)
            );
        }
        
        return documents;
    },

    async getDocumentStats() {
        await this.init();
        const documents = await this.getAllDocuments();
        const categories = database.getTable('categories') || [];
        const categoryCounts = {};

        categories.forEach(category => {
            if (category && category.name) {
                categoryCounts[category.name] = 0;
            }
        });

        documents.forEach(doc => {
            if (doc.category) {
                if (typeof categoryCounts[doc.category] === 'undefined') {
                    categoryCounts[doc.category] = 0;
                }
                categoryCounts[doc.category] += 1;
            }
        });

        const byStatus = {
            draft: documents.filter(d => d.status === 'draft').length,
            review: documents.filter(d => d.status === 'review').length,
            approved: documents.filter(d => d.status === 'approved').length,
            rejected: documents.filter(d => d.status === 'rejected').length
        };

        return {
            total: documents.length,
            byStatus,
            byCategory: categoryCounts
        };
    },

    // Получить статус текстом
    getStatusText: function(status) {
        const statusMap = {
            'draft': 'Черновик',
            'review': 'На согласовании',
            'approved': 'Согласован',
            'rejected': 'Отклонен',
            'completed': 'Завершен'
        };
        return statusMap[status] || status;
    },

    // Получить класс статуса
    getStatusClass: function(status) {
        const classMap = {
            'draft': 'status-draft',
            'review': 'status-review',
            'approved': 'status-approved',
            'rejected': 'status-rejected',
            'completed': 'status-completed'
        };
        return classMap[status] || 'status-draft';
    },

    // Форматировать дату
    formatDate: function(dateString) {
        if (!dateString) return '';
        const date = new Date(dateString);
        return date.toLocaleDateString('ru-RU');
    }
};
