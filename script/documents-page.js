// Скрипт для страницы документов

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM загружен, инициализация страницы документов...');
    
    // Ждем загрузки всех необходимых модулей
    function waitForModules() {
        return new Promise((resolve) => {
            const checkModules = setInterval(() => {
                if (typeof database !== 'undefined' && 
                    typeof auth !== 'undefined' && 
                    typeof documentsManager !== 'undefined' && 
                    typeof modals !== 'undefined') {
                    clearInterval(checkModules);
                    console.log('Все модули загружены');
                    resolve();
                }
            }, 100);
            
            // Таймаут на случай, если модули не загрузятся
            setTimeout(() => {
                clearInterval(checkModules);
                console.warn('Таймаут ожидания модулей');
                resolve();
            }, 5000);
        });
    }
    
    waitForModules().then(() => {
        // Проверка авторизации
        if (typeof auth === 'undefined' || !auth.isAuthenticated()) {
            window.location.href = 'login.html';
            return;
        }
        
        // Инициализация страницы
        initDocumentsPage();
    });

    async function initDocumentsPage() {
        console.log('Инициализация страницы документов...');
        
        // Проверка параметра поиска в URL
        const urlParams = new URLSearchParams(window.location.search);
        const searchQuery = urlParams.get('search');
        
        // Загрузка и отображение документов
        const filters = searchQuery ? { search: searchQuery } : {};
        if (searchQuery) {
            const searchInput = document.querySelector('.search-input');
            if (searchInput) {
                searchInput.value = searchQuery;
            }
        }
        
        // Обработчики событий устанавливаем сразу
        setupEventHandlers();
        
        // Создание модального окна для создания/редактирования документа
        createDocumentModal();
        
        // Небольшая задержка, чтобы модальное окно успело создаться
        await new Promise(resolve => setTimeout(resolve, 200));
        
        await renderDocuments(filters);
        
        // Поиск
        setupSearch();
        
        // Фильтры
        setupFilters();
        
        // Обновление счетчиков
        await updateFilterCounts();
        
        console.log('Страница документов инициализирована');
    }

    function createDocumentModal() {
        // Проверяем, не создано ли уже модальное окно
        if (document.getElementById('documentModal')) {
            console.log('Модальное окно уже существует');
            return;
        }
        
        console.log('Создание модального окна...');
        
        const modalContent = `
            <form id="documentForm">
                <div class="form-group">
                    <label class="form-label" for="docName">Название документа</label>
                    <input type="text" class="form-control" id="docName" name="name" required>
                </div>
                <div class="form-group">
                    <label class="form-label" for="docCategory">Категория</label>
                    <select class="form-control" id="docCategory" name="category" required>
                        <option value="Технические">Технические</option>
                        <option value="Коммерческие">Коммерческие</option>
                        <option value="Проектные">Проектные</option>
                        <option value="Отчетные">Отчетные</option>
                        <option value="Прочие">Прочие</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label" for="docDescription">Описание</label>
                    <textarea class="form-control" id="docDescription" name="description" rows="4"></textarea>
                </div>
                <div class="form-group">
                    <label class="form-label" for="docFile">Файл (URL)</label>
                    <input type="text" class="form-control" id="docFile" name="fileUrl" placeholder="https://...">
                </div>
                <input type="hidden" id="docId" name="id">
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" onclick="if(typeof modals !== 'undefined') modals.hide('documentModal')">Отмена</button>
                    <button type="submit" class="btn btn-primary">Сохранить</button>
                </div>
            </form>
        `;
        
        if (typeof modals !== 'undefined' && modals.create) {
            try {
                modals.create('documentModal', 'Документ', modalContent);
                console.log('Модальное окно создано');
                
                // Устанавливаем обработчик формы после создания модального окна
                setTimeout(() => {
                    const form = document.getElementById('documentForm');
                    if (form) {
                        // Удаляем старый обработчик, если есть
                        const newForm = form.cloneNode(true);
                        form.parentNode.replaceChild(newForm, form);
                        
                        newForm.addEventListener('submit', function(e) {
                            e.preventDefault();
                            console.log('Отправка формы документа');
                            saveDocument();
                        });
                        console.log('Обработчик формы установлен');
                    } else {
                        console.error('Форма не найдена после создания модального окна');
                    }
                }, 300);
            } catch (error) {
                console.error('Ошибка при создании модального окна:', error);
            }
        } else {
            console.error('Модуль modals не загружен. Тип modals:', typeof modals);
            // Попробуем создать модальное окно вручную
            setTimeout(() => {
                if (typeof modals !== 'undefined' && modals.create) {
                    createDocumentModal();
                }
            }, 500);
        }
    }

    async function renderDocuments(filters = {}) {
        console.log('Рендеринг документов с фильтрами:', filters);
        const documents = await documentsManager.filterDocuments(filters);
        console.log('Найдено документов:', documents.length);
        console.log('Документы:', documents);
        
        const container = document.querySelector('.document-list');
        
        if (!container) {
            console.error('Контейнер .document-list не найден');
            return;
        }

        if (documents.length === 0) {
            container.innerHTML = '<li class="document-item"><p style="text-align: center; padding: 20px;">Документы не найдены</p></li>';
            console.log('Документы не найдены');
            return;
        }

        container.innerHTML = documents.map(doc => `
            <li class="document-item" data-doc-id="${doc.id}">
                <div class="document-details">
                    <div class="document-name">${doc.name}</div>
                    <div class="document-meta">
                        <div>Изменен: ${documentsManager.formatDate(doc.updatedAt)}</div>
                        <div><span class="status ${documentsManager.getStatusClass(doc.status)}">${documentsManager.getStatusText(doc.status)}</span></div>
                        <div>Автор: ${doc.author}</div>
                        <div>Категория: ${doc.category}</div>
                    </div>
                </div>
                <div class="document-actions">
                    <button class="btn btn-download" data-doc-id="${doc.id}">Скачать</button>
                    <button class="btn btn-edit" data-doc-id="${doc.id}">Редактировать</button>
                    ${doc.status === 'draft' ? `<button class="btn btn-primary btn-send-approval" data-doc-id="${doc.id}">Отправить на согласование</button>` : ''}
                    <button class="btn btn-danger" data-doc-id="${doc.id}" onclick="deleteDocument(${doc.id})">Удалить</button>
                </div>
            </li>
        `).join('');

        // Обновление счетчиков фильтров
        updateFilterCounts();
    }

    function setupEventHandlers() {
        console.log('Установка обработчиков событий...');
        
        // Функция для открытия модального окна
        function openCreateModal() {
            console.log('Открытие модального окна создания документа...');
            
            // Убеждаемся, что модальное окно создано
            let modal = document.getElementById('documentModal');
            if (!modal) {
                console.log('Модальное окно не найдено, создаем...');
                createDocumentModal();
                // Ждем создания модального окна
                setTimeout(() => {
                    modal = document.getElementById('documentModal');
                    if (modal) {
                        showModal();
                    } else {
                        console.error('Не удалось создать модальное окно');
                        alert('Ошибка: не удалось создать модальное окно. Проверьте консоль браузера.');
                    }
                }, 500);
            } else {
                showModal();
            }
        }
        
        function showModal() {
            const form = document.getElementById('documentForm');
            const docIdField = document.getElementById('docId');
            
            if (form) {
                form.reset();
            }
            if (docIdField) {
                docIdField.value = '';
            }
            
            if (typeof modals !== 'undefined' && modals.show) {
                modals.show('documentModal');
                console.log('Модальное окно открыто успешно');
            } else {
                console.error('Модуль modals не доступен. Тип:', typeof modals);
                // Попробуем показать модальное окно напрямую
                const modal = document.getElementById('documentModal');
                if (modal) {
                    modal.classList.add('active');
                    document.body.style.overflow = 'hidden';
                    console.log('Модальное окно открыто напрямую');
                } else {
                    alert('Ошибка: модальное окно не найдено');
                }
            }
        }
        
        // Находим кнопку и устанавливаем обработчик напрямую
        const createBtn = document.querySelector('.btn-create');
        if (createBtn) {
            console.log('Кнопка создания найдена:', createBtn);
            
            // Удаляем все старые обработчики, клонируя элемент
            const newBtn = createBtn.cloneNode(true);
            createBtn.parentNode.replaceChild(newBtn, createBtn);
            
            // Устанавливаем новый обработчик
            newBtn.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                
                console.log('Кнопка создания документа нажата!');
                
                openCreateModal();
            });
            
            console.log('Обработчик кнопки установлен');
        } else {
            console.error('Кнопка .btn-create не найдена в DOM');
            
            // Используем делегирование как запасной вариант
            document.body.addEventListener('click', function(e) {
                if (e.target.classList.contains('btn-create') || e.target.closest('.btn-create')) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Кнопка найдена через делегирование');
                    openCreateModal();
                }
            });
        }
        
        // Сохраняем функции для использования в других местах
        window.openCreateModal = openCreateModal;
        
        // Редактирование документа (делегирование событий)
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-edit')) {
                const docId = e.target.getAttribute('data-doc-id');
                editDocument(docId);
            }
        });

        // Скачивание документа (делегирование событий)
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-download')) {
                const docId = e.target.getAttribute('data-doc-id');
                downloadDocument(docId);
            }
        });
        
        // Отправка на согласование (делегирование событий)
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-send-approval')) {
                const docId = e.target.getAttribute('data-doc-id');
                sendForApproval(docId);
            }
        });
    }

    async function saveDocument() {
        console.log('Сохранение документа...');
        
        const form = document.getElementById('documentForm');
        if (!form) {
            console.error('Форма не найдена');
            alert('Ошибка: форма не найдена');
            return;
        }
        
        const formData = new FormData(form);
        const docId = document.getElementById('docId')?.value;

        const documentData = {
            name: formData.get('name'),
            category: formData.get('category'),
            description: formData.get('description'),
            fileUrl: formData.get('fileUrl')
        };

        console.log('Данные документа:', documentData);

        try {
            let savedDoc;
            if (docId) {
                console.log('Обновление документа с ID:', docId);
                savedDoc = await documentsManager.updateDocument(docId, documentData);
            } else {
                console.log('Создание нового документа');
                savedDoc = await documentsManager.createDocument(documentData);
            }
            
            console.log('Документ сохранен:', savedDoc);
            
            if (!savedDoc) {
                alert('Ошибка: документ не был сохранен');
                return;
            }
            
            // Принудительно обновляем данные из кэша
            if (typeof database !== 'undefined' && database.syncWithLocalStorage) {
                database.syncWithLocalStorage();
            }
            
            // Небольшая задержка для синхронизации
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Закрываем модальное окно
            if (typeof modals !== 'undefined' && modals.hide) {
                modals.hide('documentModal');
            } else {
                const modal = document.getElementById('documentModal');
                if (modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            }
            
            // Обновляем список документов с текущими фильтрами (или без фильтров)
            // Сбрасываем фильтры, чтобы показать все документы, включая новый
            currentFilters = {};
            
            // Принудительно обновляем данные из кэша перед обновлением списка
            if (typeof database !== 'undefined' && database.syncWithLocalStorage) {
                database.syncWithLocalStorage();
            }
            
            // Небольшая задержка для гарантии синхронизации
            await new Promise(resolve => setTimeout(resolve, 200));
            
            console.log('Обновление списка документов...');
            
            // Получаем все документы напрямую для проверки
            const allDocs = await documentsManager.getAllDocuments();
            console.log('Все документы после создания:', allDocs);
            console.log('Количество документов:', allDocs.length);
            
            await renderDocuments({});
            
            // Очищаем поле поиска
            const searchInput = document.querySelector('.search-input');
            if (searchInput) {
                searchInput.value = '';
            }
            
            // Обновляем счетчики
            await updateFilterCounts();
            
            console.log('Список документов обновлен');
            
            if (allDocs.length > 0) {
                alert('Документ успешно создан!');
            } else {
                alert('Документ создан, но не отображается. Проверьте консоль браузера.');
            }
        } catch (error) {
            console.error('Ошибка при сохранении документа:', error);
            alert('Ошибка при сохранении документа: ' + error.message);
        }
    }

    async function editDocument(id) {
        const doc = await documentsManager.getDocumentById(id);
        if (!doc) return;

        document.getElementById('docId').value = doc.id;
        document.getElementById('docName').value = doc.name;
        document.getElementById('docCategory').value = doc.category;
        document.getElementById('docDescription').value = doc.description || '';
        document.getElementById('docFile').value = doc.fileUrl || '';

        modals.show('documentModal');
    }

    async function downloadDocument(id) {
        const doc = await documentsManager.getDocumentById(id);
        if (!doc) return;

        if (doc.fileUrl) {
            window.open(doc.fileUrl, '_blank');
        } else {
            alert('Файл не прикреплен к документу');
        }
    }

    window.deleteDocument = async function(id) {
        if (confirm('Вы уверены, что хотите удалить этот документ?')) {
            await documentsManager.deleteDocument(id);
            await renderDocuments();
        }
    };

    // Отправить документ на согласование
    async function sendForApproval(docId) {
        console.log('Отправка документа на согласование:', docId);
        
        // Проверяем, что approvalsManager доступен
        if (typeof approvalsManager === 'undefined') {
            alert('Ошибка: модуль согласований не загружен');
            return;
        }
        
        // Получаем список пользователей для выбора согласующих
        console.log('Получение списка пользователей...');
        const users = auth.getUsers();
        console.log('Пользователи:', users);
        
        if (!users || users.length === 0) {
            console.error('Не найдены пользователи');
            alert('Не найдены пользователи для согласования');
            return;
        }
        
        // Создаем модальное окно для выбора согласующих
        createApprovalModal(docId, users);
    }

    // Создать модальное окно для выбора согласующих
    function createApprovalModal(docId, users) {
        // Проверяем, не создано ли уже модальное окно
        const existingModal = document.getElementById('approvalModal');
        if (existingModal) {
            existingModal.remove();
        }
        
        // Создаем список пользователей (исключаем текущего пользователя)
        const currentUser = auth.getCurrentUser();
        const approversList = users
            .filter(u => u.user_id !== currentUser.user_id)
            .map(user => `
                <div class="approver-item">
                    <label style="display: flex; align-items: center; gap: 10px; cursor: pointer; padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 10px;">
                        <input type="checkbox" class="approver-checkbox" value="${user.user_id}" data-user-name="${user.fullName}">
                        <span>${user.fullName} (${user.position || user.role})</span>
                    </label>
                </div>
            `).join('');
        
        const modalContent = `
            <form id="approvalForm">
                <div class="form-group">
                    <label class="form-label">Выберите согласующих (можно выбрать несколько):</label>
                    <div id="approversList" style="max-height: 300px; overflow-y: auto; margin-top: 10px;">
                        ${approversList || '<p>Нет доступных согласующих</p>'}
                    </div>
                </div>
                <div class="form-group">
                    <label class="form-label" for="approvalComment">Комментарий (необязательно):</label>
                    <textarea class="form-control" id="approvalComment" name="comment" rows="3" placeholder="Добавьте комментарий к отправке на согласование"></textarea>
                </div>
                <input type="hidden" id="approvalDocId" value="${docId}">
                <div style="display: flex; gap: 10px; justify-content: flex-end; margin-top: 20px;">
                    <button type="button" class="btn btn-secondary" id="cancelApprovalBtn" style="cursor: pointer;">Отмена</button>
                    <button type="button" class="btn btn-primary" id="submitApprovalBtn" style="cursor: pointer;">Отправить на согласование</button>
                </div>
            </form>
        `;
        
        if (typeof modals !== 'undefined' && modals.create) {
            try {
                modals.create('approvalModal', 'Отправить на согласование', modalContent);
                console.log('Модальное окно согласования создано');
                
                // Устанавливаем обработчики с задержкой, чтобы убедиться, что DOM готов
                setTimeout(() => {
                    console.log('Настройка обработчиков для модального окна согласования...');
                    
                    const modalElement = document.getElementById('approvalModal');
                    const form = document.getElementById('approvalForm');
                    const submitBtn = document.getElementById('submitApprovalBtn');
                    const cancelBtn = document.getElementById('cancelApprovalBtn');
                    const docIdField = document.getElementById('approvalDocId');
                    
                    console.log('Элементы найдены:', {
                        modal: !!modalElement,
                        form: !!form,
                        submitBtn: !!submitBtn,
                        cancelBtn: !!cancelBtn,
                        docIdField: !!docIdField
                    });
                    
                    if (!modalElement) {
                        console.error('Модальное окно approvalModal не найдено');
                        return;
                    }
                    
                    if (!form) {
                        console.error('Форма approvalForm не найдена');
                        return;
                    }
                    
                    // Обработчик на форму (submit)
                    form.addEventListener('submit', async function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('=== ФОРМА ОТПРАВЛЕНА (submit event) ===');
                        
                        const currentDocId = docIdField ? docIdField.value : docId;
                        console.log('Используемый docId:', currentDocId);
                        
                        await submitApproval(currentDocId);
                        return false;
                    });
                    
                    // Обработчик на кнопку отправки (click) - используем once: false для возможности многократных кликов
                    if (submitBtn) {
                        // Удаляем все предыдущие обработчики
                        const newSubmitBtn = submitBtn.cloneNode(true);
                        submitBtn.parentNode.replaceChild(newSubmitBtn, submitBtn);
                        
                        // Устанавливаем новый обработчик
                        newSubmitBtn.addEventListener('click', async function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            e.stopImmediatePropagation();
                            
                            console.log('=== КНОПКА ОТПРАВКИ НАЖАТА (click event) ===');
                            console.log('Событие:', e);
                            console.log('Цель:', e.target);
                            
                            const currentDocIdField = document.getElementById('approvalDocId');
                            const currentDocId = currentDocIdField ? currentDocIdField.value : docId;
                            console.log('Используемый docId:', currentDocId);
                            
                            try {
                                await submitApproval(currentDocId);
                            } catch (error) {
                                console.error('Ошибка в submitApproval:', error);
                                alert('Ошибка: ' + error.message);
                            }
                            
                            return false;
                        }, { capture: true });
                        
                        // Также добавляем onclick для надежности
                        newSubmitBtn.setAttribute('onclick', `
                            event.preventDefault();
                            event.stopPropagation();
                            console.log('Onclick сработал');
                            const docIdField = document.getElementById('approvalDocId');
                            const docId = docIdField ? docIdField.value : '${docId}';
                            if (window.submitApproval) {
                                window.submitApproval(docId);
                            }
                            return false;
                        `);
                        
                        console.log('Обработчик на кнопку отправки установлен');
                    } else {
                        console.error('Кнопка submitApprovalBtn не найдена!');
                    }
                    
                    // Обработчик на кнопку отмены
                    if (cancelBtn) {
                        cancelBtn.addEventListener('click', function(e) {
                            e.preventDefault();
                            e.stopPropagation();
                            console.log('Отмена отправки на согласование');
                            if (typeof modals !== 'undefined' && modals.hide) {
                                modals.hide('approvalModal');
                            } else {
                                const modal = document.getElementById('approvalModal');
                                if (modal) {
                                    modal.classList.remove('active');
                                    document.body.style.overflow = '';
                                }
                            }
                            return false;
                        });
                        console.log('Обработчик на кнопку отмены установлен');
                    }
                    
                    // Делегирование на уровне модального окна (резервный вариант)
                    modalElement.addEventListener('click', function(e) {
                        // Проверяем, что клик был по кнопке отправки или её дочерним элементам
                        if (e.target && (e.target.id === 'submitApprovalBtn' || e.target.closest && e.target.closest('#submitApprovalBtn'))) {
                            console.log('Клик по кнопке отправки через делегирование');
                        }
                        // Проверяем, что клик был по кнопке отмены
                        if (e.target && (e.target.id === 'cancelApprovalBtn' || e.target.closest && e.target.closest('#cancelApprovalBtn'))) {
                            console.log('Клик по кнопке отмены через делегирование');
                        }
                    });
                    
                    console.log('Все обработчики успешно установлены');
                }, 300);
            } catch (error) {
                console.error('Ошибка при создании модального окна согласования:', error);
            }
        } else {
            console.error('Модуль modals не загружен');
        }
    }

    // Делаем функцию доступной глобально для тестирования
    window.submitApproval = async function(docId) {
        return await submitApprovalInternal(docId);
    };
    
    // Отправить на согласование
    async function submitApproval(docId) {
        return await submitApprovalInternal(docId);
    }
    
    async function submitApprovalInternal(docId) {
        console.log('=== НАЧАЛО ОТПРАВКИ НА СОГЛАСОВАНИЕ ===');
        console.log('ID документа:', docId);
        console.log('Тип ID:', typeof docId);
        
        try {
            // Проверяем доступность модулей ПЕРЕД всем остальным
            if (typeof approvalsManager === 'undefined') {
                console.error('Модуль approvalsManager не загружен');
                throw new Error('Модуль approvalsManager не загружен');
            }
            console.log('✓ approvalsManager доступен');
            
            if (typeof documentsManager === 'undefined') {
                console.error('Модуль documentsManager не загружен');
                throw new Error('Модуль documentsManager не загружен');
            }
            console.log('✓ documentsManager доступен');
            
            if (typeof database === 'undefined') {
                console.error('Модуль database не загружен');
                throw new Error('Модуль database не загружен');
            }
            console.log('✓ database доступен');
            
            // Получаем выбранные согласующие
            const checkboxes = document.querySelectorAll('.approver-checkbox:checked');
            console.log('Найдено выбранных согласующих:', checkboxes.length);
            
            if (checkboxes.length === 0) {
                alert('Выберите хотя бы одного согласующего');
                return;
            }
            
            const steps = Array.from(checkboxes).map((cb, index) => {
                const approverId = parseInt(cb.value);
                const approverName = cb.getAttribute('data-user-name');
                console.log(`Согласующий ${index + 1}: ${approverName} (ID: ${approverId})`);
                return {
                    approverId: approverId,
                    approverName: approverName
                };
            });
            
            console.log('Шаги согласования:', JSON.stringify(steps, null, 2));
            
            const comment = document.getElementById('approvalComment')?.value || '';
            console.log('Комментарий:', comment);
            
            // Преобразуем docId в число, если нужно
            const numericDocId = typeof docId === 'string' ? parseInt(docId) : docId;
            console.log('Числовой ID документа:', numericDocId);
            
            // Проверяем, что документ существует
            console.log('Получение документа из БД...');
            const doc = await documentsManager.getDocumentById(numericDocId);
            console.log('Документ получен:', doc);
            
            if (!doc) {
                console.error('Документ не найден с ID:', numericDocId);
                throw new Error('Документ не найден');
            }
            
            console.log('Документ найден:', doc.name, 'Статус:', doc.status);
            
            // Создаем процесс согласования
            console.log('Вызов approvalsManager.createApproval...');
            console.log('Параметры:', {
                documentId: numericDocId,
                steps: steps
            });
            
            const approval = await approvalsManager.createApproval(numericDocId, steps);
            
            console.log('Результат createApproval:', approval);
            
            if (approval) {
                console.log('✓✓✓ ПРОЦЕСС СОГЛАСОВАНИЯ УСПЕШНО СОЗДАН ✓✓✓');
                console.log('Детали:', JSON.stringify(approval, null, 2));
                
                // Закрываем модальное окно
                console.log('Закрытие модального окна...');
                if (typeof modals !== 'undefined' && modals.hide) {
                    modals.hide('approvalModal');
                } else {
                    const modal = document.getElementById('approvalModal');
                    if (modal) {
                        modal.classList.remove('active');
                        document.body.style.overflow = '';
                    }
                }
                
                // Небольшая задержка для синхронизации
                console.log('Ожидание синхронизации данных...');
                await new Promise(resolve => setTimeout(resolve, 300));
                
                // Обновляем список документов
                console.log('Обновление списка документов...');
                await renderDocuments(currentFilters);
                await updateFilterCounts();
                
                console.log('=== УСПЕШНОЕ ЗАВЕРШЕНИЕ ===');
                alert('Документ успешно отправлен на согласование!');
            } else {
                console.error('✗✗✗ createApproval вернула null ✗✗✗');
                console.error('Это означает, что процесс согласования не был создан');
                alert('Ошибка: не удалось создать процесс согласования. Проверьте консоль браузера для деталей.');
            }
        } catch (error) {
            console.error('✗✗✗ КРИТИЧЕСКАЯ ОШИБКА ✗✗✗');
            console.error('Ошибка:', error);
            console.error('Тип ошибки:', error.constructor.name);
            console.error('Сообщение:', error.message);
            console.error('Стек ошибки:', error.stack);
            alert('Ошибка при отправке на согласование: ' + (error.message || error));
        }
    }

    function setupSearch() {
        const searchInput = document.querySelector('.search-input');
        const searchButton = document.querySelector('.search-button');

        if (searchInput && searchButton) {
            const performSearch = async () => {
                const query = searchInput.value.trim();
                currentFilters = query ? { search: query } : {};
                await renderDocuments(currentFilters);
            };

            searchButton.addEventListener('click', performSearch);
            searchInput.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    performSearch();
                }
            });
        }
    }

    function setupFilters() {
        const filterLinks = document.querySelectorAll('.filter-options a');
        filterLinks.forEach(link => {
            link.addEventListener('click', async function(e) {
                e.preventDefault();
                const text = this.textContent.trim();
                
                let filters = {};
                if (text.includes('Черновики')) {
                    filters.status = 'draft';
                } else if (text.includes('На согласовании')) {
                    filters.status = 'review';
                } else if (text.includes('Согласованные')) {
                    filters.status = 'approved';
                } else if (text.includes('Архивные')) {
                    filters.status = 'rejected';
                } else if (text.includes('Технические')) {
                    filters.category = 'Технические';
                } else if (text.includes('Коммерческие')) {
                    filters.category = 'Коммерческие';
                } else if (text.includes('Проектные')) {
                    filters.category = 'Проектные';
                } else if (text.includes('Отчетные')) {
                    filters.category = 'Отчетные';
                }

                currentFilters = filters;
                await renderDocuments(filters);
            });
        });
    }

    async function updateFilterCounts() {
        const documents = await documentsManager.getAllDocuments();
        const counts = {
            all: documents.length,
            draft: documents.filter(d => d.status === 'draft').length,
            review: documents.filter(d => d.status === 'review').length,
            approved: documents.filter(d => d.status === 'approved').length,
            rejected: documents.filter(d => d.status === 'rejected').length
        };

        document.querySelectorAll('.filter-count').forEach(countEl => {
            const text = countEl.closest('a').textContent;
            if (text.includes('Все документы')) {
                countEl.textContent = counts.all;
            } else if (text.includes('Черновики')) {
                countEl.textContent = counts.draft;
            } else if (text.includes('На согласовании')) {
                countEl.textContent = counts.review;
            } else if (text.includes('Согласованные')) {
                countEl.textContent = counts.approved;
            } else if (text.includes('Архивные')) {
                countEl.textContent = counts.rejected;
            }
        });
    }
});

