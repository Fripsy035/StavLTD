// Модуль для работы с JSON базой данных

const database = {
    _data: null,
    _filePath: 'json/bd.json',

    // Загрузить данные из JSON файла
    async load() {
        try {
            const response = await fetch(this._filePath);
            if (!response.ok) {
                throw new Error('Не удалось загрузить базу данных');
            }
            this._data = await response.json();
            return this._data;
        } catch (error) {
            console.error('Ошибка загрузки базы данных:', error);
            // Если файл не найден, создаем пустую структуру
            this._data = this._getEmptyStructure();
            return this._data;
        }
    },

    // Сохранить данные в JSON файл
    async save() {
        try {
            // В браузере нельзя напрямую записывать файлы
            // Используем localStorage как кэш и предлагаем скачать обновленный файл
            localStorage.setItem('database_cache', JSON.stringify(this._data));
            localStorage.setItem('database_updated', new Date().toISOString());
            
            // Создаем ссылку для скачивания обновленного файла
            this._downloadDatabase();
            return true;
        } catch (error) {
            console.error('Ошибка сохранения базы данных:', error);
            return false;
        }
    },

    // Скачать обновленную базу данных
    _downloadDatabase() {
        const dataStr = JSON.stringify(this._data, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'bd.json';
        link.style.display = 'none';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    },

    // Получить пустую структуру базы данных
    _getEmptyStructure() {
        return {
            departments: [],
            users: [],
            document_types: [],
            categories: [],
            documents: [],
            document_versions: [],
            approval_processes: [],
            approval_steps: [],
            notifications: []
        };
    },

    // Инициализация - загрузить данные
    async init() {
        if (!this._data) {
            // Сначала пытаемся загрузить из кэша
            if (this.syncWithLocalStorage()) {
                console.log('Данные загружены из localStorage кэша');
            } else {
                // Если кэша нет, загружаем из файла
                await this.load();
                // Сохраняем в кэш
                if (this._data) {
                    localStorage.setItem('database_cache', JSON.stringify(this._data));
                }
            }
        }
        return this._data;
    },

    // Получить все данные
    getData() {
        return this._data || this._getEmptyStructure();
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

    // Добавить запись в таблицу
    insert(tableName, record) {
        const data = this.getData();
        if (!data[tableName]) {
            data[tableName] = [];
        }
        
        // Генерируем ID если его нет
        const idField = this._getIdField(tableName);
        if (!record[idField]) {
            const maxId = data[tableName].length > 0 
                ? Math.max(...data[tableName].map(r => r[idField] || 0))
                : 0;
            record[idField] = maxId + 1;
        }
        
        data[tableName].push(record);
        this._data = data;
        
        // Сохраняем в localStorage сразу
        localStorage.setItem('database_cache', JSON.stringify(this._data));
        localStorage.setItem('database_updated', new Date().toISOString());
        
        console.log(`Запись добавлена в ${tableName}:`, record);
        console.log(`Всего записей в ${tableName}:`, data[tableName].length);
        
        // Не вызываем save() автоматически, чтобы не скачивать файл при каждом изменении
        // this.save();
        return record;
    },

    // Обновить запись в таблице
    update(tableName, id, updates) {
        const data = this.getData();
        const idField = this._getIdField(tableName);
        const index = data[tableName].findIndex(r => r[idField] === id);
        
        if (index !== -1) {
            data[tableName][index] = { ...data[tableName][index], ...updates };
            this._data = data;
            
            // Сохраняем в localStorage сразу
            localStorage.setItem('database_cache', JSON.stringify(this._data));
            localStorage.setItem('database_updated', new Date().toISOString());
            
            console.log(`Запись обновлена в ${tableName} с ID ${id}:`, data[tableName][index]);
            
            // Не вызываем save() автоматически
            // this.save();
            return data[tableName][index];
        }
        return null;
    },

    // Удалить запись из таблицы
    delete(tableName, id) {
        const data = this.getData();
        const idField = this._getIdField(tableName);
        const index = data[tableName].findIndex(r => r[idField] === id);
        
        if (index !== -1) {
            data[tableName].splice(index, 1);
            this._data = data;
            
            // Сохраняем в localStorage сразу
            localStorage.setItem('database_cache', JSON.stringify(this._data));
            localStorage.setItem('database_updated', new Date().toISOString());
            
            console.log(`Запись удалена из ${tableName} с ID ${id}`);
            
            // Не вызываем save() автоматически
            // this.save();
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

    // Синхронизировать с localStorage (для работы без сервера)
    syncWithLocalStorage() {
        const cache = localStorage.getItem('database_cache');
        if (cache) {
            try {
                this._data = JSON.parse(cache);
                console.log('Данные синхронизированы из localStorage');
                return true;
            } catch (e) {
                console.error('Ошибка парсинга кэша:', e);
            }
        }
        return false;
    },
    
    // Принудительно обновить данные из кэша
    refresh() {
        this._data = null;
        return this.syncWithLocalStorage() || this.load();
    }
};

// Инициализация при загрузке
document.addEventListener('DOMContentLoaded', async function() {
    try {
        // Пытаемся загрузить из localStorage (кэш)
        if (!database.syncWithLocalStorage()) {
            // Если кэша нет, загружаем из файла
            console.log('Загрузка данных из JSON файла...');
            await database.load();
            // Сохраняем в кэш
            if (database._data) {
                localStorage.setItem('database_cache', JSON.stringify(database._data));
                console.log('Данные из JSON файла сохранены в кэш');
            }
        }
    } catch (error) {
        console.error('Ошибка инициализации базы данных:', error);
    }
});

