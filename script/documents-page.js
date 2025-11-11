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
                    <button class="btn btn-danger" data-doc-id="${doc.id}" onclick="deleteDocument(${doc.id})">Удалить</button>
                </div>
            </li>
        `).join('');

        // Обновление счетчиков фильтров
        updateFilterCounts();
    }

    function setupEventHandlers() {
        console.log('Установка обработчиков событий...');
        
        // Находим кнопку и устанавливаем обработчик напрямую
        const createBtn = document.querySelector('.btn-create');
        if (createBtn) {
            console.log('Кнопка создания найдена');
            
            // Удаляем все старые обработчики
            const newBtn = createBtn.cloneNode(true);
            createBtn.parentNode.replaceChild(newBtn, createBtn);
            
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
            document.addEventListener('click', function(e) {
                if (e.target.classList.contains('btn-create') || e.target.closest('.btn-create')) {
                    e.preventDefault();
                    e.stopPropagation();
                    console.log('Кнопка найдена через делегирование');
                    openCreateModal();
                }
            });
        }
        
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

        // Форма документа (обработчик устанавливается в createDocumentModal)
        // Дополнительная проверка на случай, если форма уже существует
        const form = document.getElementById('documentForm');
        if (form && !form.hasAttribute('data-submit-handler')) {
            form.setAttribute('data-submit-handler', 'true');
            form.addEventListener('submit', function(e) {
                e.preventDefault();
                saveDocument();
            });
        }

        // Редактирование документа
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-edit')) {
                const docId = e.target.getAttribute('data-doc-id');
                editDocument(docId);
            }
        });

        // Скачивание документа
        document.addEventListener('click', function(e) {
            if (e.target.classList.contains('btn-download')) {
                const docId = e.target.getAttribute('data-doc-id');
                downloadDocument(docId);
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

