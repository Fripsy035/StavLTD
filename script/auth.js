// Система авторизации с использованием JSON базы данных

const auth = {
    // Инициализация - убедиться, что БД загружена
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

    // Получить текущего пользователя
    getCurrentUser: function () {
        const userStr = localStorage.getItem('currentUser');
        if (userStr) {
            const user = JSON.parse(userStr);
            // Получаем полную информацию из БД
            const dbUser = database.find('users', u => u.user_id === user.user_id);
            if (dbUser) {
                return this._mapUserFromDB(dbUser);
            }
            return user;
        }
        return null;
    },

    // Получить всех пользователей
    getUsers: function () {
        const users = database.getTable('users');
        return users.map(u => this._mapUserFromDB(u));
    },

    // Маппинг пользователя из БД в формат приложения
    _mapUserFromDB: function (dbUser) {
        const department = database.find('departments', d => d.department_id === dbUser.department_id);
        return {
            id: dbUser.user_id,
            user_id: dbUser.user_id,
            email: dbUser.email,
            fullName: dbUser.full_name,
            name: dbUser.full_name,
            role: this._mapRole(dbUser.role),
            position: dbUser.position || '',
            phone: dbUser.phone || '',
            department: department ? department.name : '',
            department_id: dbUser.department_id,
            is_active: dbUser.is_active !== false
        };
    },

    // Маппинг роли
    _mapRole: function (role) {
        const roleMap = {
            'admin': 'Администратор',
            'editor': 'Редактор',
            'user': 'Пользователь'
        };
        return roleMap[role] || role;
    },

    // Вход в систему
    login: async function (email, password, remember) {
        await this.init();
        // Нормализуем email (убираем пробелы, приводим к нижнему регистру)
        const normalizedEmail = (email || '').trim().toLowerCase();
        const users = database.getTable('users');
        console.log('Все пользователи в БД:', users);
        console.log('Ищем пользователя с email:', normalizedEmail);
        const dbUser = users.find(u => {
            const userEmail = (u.email || '').trim().toLowerCase();
            return userEmail === normalizedEmail && u.is_active !== false;
        });
        console.log('Найденный пользователь:', dbUser);

        // В реальном приложении пароль должен быть хеширован
        // Для демонстрации используем простую проверку
        // Пароли хранятся в отдельной таблице или в зашифрованном виде

        if (dbUser) {
            // Проверяем пароль, если он указан в базе данных
            // Если пароль есть в БД, он должен совпадать с введенным
            // Если пароля нет в БД, разрешаем вход без пароля (для обратной совместимости)
            if (dbUser.password) {
                if (dbUser.password !== password) {
                    console.error('Неверный пароль для email:', email);
                    return { success: false, message: 'Неверный email или пароль' };
                }
            }
            const user = this._mapUserFromDB(dbUser);

            console.log('Пользователь найден в БД:', dbUser);
            console.log('Маппированный пользователь:', user);

            // Сохраняем текущего пользователя в localStorage
            const userToSave = {
                user_id: user.user_id,
                id: user.user_id, // Для обратной совместимости
                email: user.email,
                fullName: user.fullName,
                name: user.name,
                role: user.role,
                position: user.position,
                department: user.department,
                department_id: user.department_id
            };

            localStorage.setItem('currentUser', JSON.stringify(userToSave));
            console.log('Пользователь сохранен в localStorage:', userToSave);

            if (remember) {
                localStorage.setItem('rememberMe', 'true');
            }

            return { success: true, user: user };
        } else {
            console.error('Пользователь не найден в БД для email:', email);
            return { success: false, message: 'Неверный email или пароль' };
        }
    },

    // Выход из системы
    logout: function () {
        localStorage.removeItem('currentUser');
        localStorage.removeItem('rememberMe');
        return true;
    },

    // Проверка авторизации
    isAuthenticated: function () {
        return this.getCurrentUser() !== null;
    },

    // Обновление данных пользователя
    updateUser: async function (updatedUser) {
        await this.init();
        const updates = {
            full_name: updatedUser.fullName,
            email: updatedUser.email
        };

        // Обновляем телефон, если он указан
        if (updatedUser.phone !== undefined) {
            updates.phone = updatedUser.phone || '';
        }

        // Обновляем должность и отдел только если они указаны (для администратора)
        if (updatedUser.position !== undefined) {
            updates.position = updatedUser.position || '';
        }
        if (updatedUser.department_id !== undefined) {
            updates.department_id = updatedUser.department_id || null;
        }

        const dbUser = database.update('users', updatedUser.user_id, updates);

        if (dbUser) {
            // Обновляем текущего пользователя
            const user = this._mapUserFromDB(dbUser);
            localStorage.setItem('currentUser', JSON.stringify({
                user_id: user.user_id,
                email: user.email,
                fullName: user.fullName,
                name: user.name,
                role: user.role,
                position: user.position,
                phone: user.phone,
                department: user.department,
                department_id: user.department_id
            }));
            return true;
        }
        return false;
    },

    // Смена пароля (в реальном приложении нужна отдельная таблица для паролей)
    changePassword: async function (currentPassword, newPassword) {
        await this.init();
        const user = this.getCurrentUser();
        if (!user) return false;

        // В реальном приложении здесь должна быть проверка текущего пароля
        // и сохранение нового хешированного пароля
        // Для демонстрации просто возвращаем true
        return true;
    },

    // Получить инициалы из имени
    getInitials: function (fullName) {
        if (!fullName) return '??';
        const parts = fullName.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        } else if (parts.length === 1) {
            return parts[0].substring(0, 2).toUpperCase();
        }
        return '??';
    },

    // Получить пользователя по ID
    getUserById: async function (userId) {
        await this.init();
        const dbUser = database.find('users', u => u.user_id === userId);
        if (dbUser) {
            return this._mapUserFromDB(dbUser);
        }
        return null;
    }
};
