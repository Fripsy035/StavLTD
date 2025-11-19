// Модуль работы с хранилищем в localStorage
const database = {
    _storageKey: 'sed_database',
    _data: null,

    async init() {
        if (!this._data) {
            this._loadFromStorage();
        }
        return this._data;
    },

    getData() {
        if (!this._data) {
            this._loadFromStorage();
        }
        return this._data;
    },

    // Получить таблицу
    getTable(tableName) {
        const data = this.getData();
        return data[tableName] || [];
    },

    // Найти запись в таблице
    find(tableName, predicate) {
        const table = this.getTable(tableName);
        return table.find(predicate);
    },

    // Найти все записи в таблице
    findAll(tableName, predicate) {
        const table = this.getTable(tableName);
        if (!predicate) return table;
        return table.filter(predicate);
    },

    insert(tableName, record) {
        const data = this.getData();
        if (!data[tableName]) {
            data[tableName] = [];
        }

        const idField = this._getIdField(tableName);
        if (!record[idField]) {
            const maxId = data[tableName].length > 0
                ? Math.max(...data[tableName].map(r => r[idField] || 0))
                : 0;
            record[idField] = maxId + 1;
        }

        data[tableName].push(record);
        this._data = data;

        this._saveToStorage();
        console.log(`Запись добавлена в ${tableName}:`, record);
        return record;
    },

    update(tableName, id, updates) {
        const data = this.getData();
        const idField = this._getIdField(tableName);
        const index = data[tableName].findIndex(r => r[idField] === id);

        if (index !== -1) {
            data[tableName][index] = { ...data[tableName][index], ...updates };
            this._data = data;
            this._saveToStorage();
            console.log(`Запись обновлена в ${tableName} с ID ${id}:`, data[tableName][index]);
            return data[tableName][index];
        }
        return null;
    },

    delete(tableName, id) {
        const data = this.getData();
        const idField = this._getIdField(tableName);
        const index = data[tableName].findIndex(r => r[idField] === id);

        if (index !== -1) {
            data[tableName].splice(index, 1);
            this._data = data;
            this._saveToStorage();
            console.log(`Запись удалена из ${tableName} с ID ${id}`);
            return true;
        }
        return false;
    },

    // Получить поле ID для таблицы
    _getIdField(tableName) {
        const idFields = {
            'departments': 'department_id',
            'users': 'user_id',
            'document_types': 'type_id',
            'categories': 'category_id',
            'documents': 'document_id',
            'document_versions': 'version_id',
            'approval_processes': 'process_id',
            'approval_steps': 'step_id',
            'notifications': 'notification_id'
        };
        return idFields[tableName] || 'id';
    },

    syncWithLocalStorage() {
        this._loadFromStorage();
        return !!this._data;
    },

    refresh() {
        this._data = null;
        this._loadFromStorage(true);
        return this._data;
    },

    _loadFromStorage(forceDefaults = false) {
        if (!forceDefaults) {
            const raw = localStorage.getItem(this._storageKey);
            if (raw) {
                try {
                    this._data = JSON.parse(raw);
                    return;
                } catch (error) {
                    console.error('Ошибка чтения локальных данных:', error);
                }
            }
        }
        this._data = this._getDefaultData();
        this._saveToStorage();
    },

    _saveToStorage() {
        if (!this._data) {
            return;
        }
        localStorage.setItem(this._storageKey, JSON.stringify(this._data));
        localStorage.setItem('database_updated', new Date().toISOString());
    },

    _getDefaultData() {
        return {
            departments: [
                { department_id: 1, name: 'ПТО', description: 'Производственно-технический отдел' }
            ],
            document_types: [
                { type_id: 1, name: 'Технические документы', code: 'technical', description: 'Чертежи, схемы, спецификации, технические отчеты' }
            ],
            categories: [
                { category_id: 1, name: 'Технические', parent_id: null, path: 'Технические' },
                { category_id: 2, name: 'Коммерческие', parent_id: null, path: 'Коммерческие' },
                { category_id: 3, name: 'Проектные', parent_id: null, path: 'Проектные' },
                { category_id: 4, name: 'Отчетные', parent_id: null, path: 'Отчетные' },
                { category_id: 5, name: 'Прочие', parent_id: null, path: 'Прочие' }
            ],
            users: [
                {
                    user_id: 1,
                    full_name: 'Иванов Алексей Петрович',
                    position: 'Главный инженер',
                    department_id: 1,
                    email: 'ivanov@stav-ltd.ru',
                    role: 'admin',
                    is_active: true
                }
            ],
            documents: [],
            document_versions: [],
            approval_processes: [],
            approval_steps: [],
            notifications: []
        };
    }
};

// Инициализируем данные сразу после загрузки скрипта
database.init();
