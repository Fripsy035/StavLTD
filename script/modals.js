// Система модальных окон

const modals = {
    // Создать модальное окно
    create: function(id, title, content) {
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.id = id;
        modal.innerHTML = `
            <div class="modal-overlay"></div>
            <div class="modal-content">
                <div class="modal-header">
                    <h3>${title}</h3>
                    <button class="modal-close" data-modal="${id}">&times;</button>
                </div>
                <div class="modal-body">
                    ${content}
                </div>
            </div>
        `;
        document.body.appendChild(modal);
        this.init();
    },

    // Показать модальное окно
    show: function(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        }
    },

    // Скрыть модальное окно
    hide: function(id) {
        const modal = document.getElementById(id);
        if (modal) {
            modal.classList.remove('active');
            document.body.style.overflow = '';
        }
    },

    // Инициализация обработчиков
    init: function() {
        // Закрытие по клику на overlay (только для новых модальных окон)
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            // Проверяем, не установлен ли уже обработчик
            if (!overlay.hasAttribute('data-listener-attached')) {
                overlay.setAttribute('data-listener-attached', 'true');
                overlay.addEventListener('click', function() {
                    const modal = this.closest('.modal');
                    if (modal) {
                        modals.hide(modal.id);
                    }
                });
            }
        });

        // Закрытие по кнопке (только для новых кнопок)
        document.querySelectorAll('.modal-close').forEach(btn => {
            if (!btn.hasAttribute('data-listener-attached')) {
                btn.setAttribute('data-listener-attached', 'true');
                btn.addEventListener('click', function() {
                    const modalId = this.getAttribute('data-modal');
                    modals.hide(modalId);
                });
            }
        });

        // Закрытие по Escape (устанавливаем один раз)
        if (!document.hasAttribute('data-escape-listener')) {
            document.setAttribute('data-escape-listener', 'true');
            document.addEventListener('keydown', function(e) {
                if (e.key === 'Escape') {
                    document.querySelectorAll('.modal.active').forEach(modal => {
                        modals.hide(modal.id);
                    });
                }
            });
        }
    }
};

// Стили для модальных окон (добавятся в CSS)
const modalStyles = `
<style>
.modal {
    display: none;
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    z-index: 1000;
}

.modal.active {
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.5);
}

.modal-content {
    position: relative;
    background: white;
    border-radius: 8px;
    max-width: 600px;
    width: 90%;
    max-height: 90vh;
    overflow-y: auto;
    box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
    z-index: 1001;
}

.modal-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 20px;
    border-bottom: 1px solid var(--border-color);
}

.modal-header h3 {
    margin: 0;
    color: var(--primary-color);
}

.modal-close {
    background: none;
    border: none;
    font-size: 2rem;
    cursor: pointer;
    color: var(--light-text);
    line-height: 1;
    padding: 0;
    width: 30px;
    height: 30px;
    display: flex;
    align-items: center;
    justify-content: center;
}

.modal-close:hover {
    color: var(--text-color);
}

.modal-body {
    padding: 20px;
}
</style>
`;

// Добавляем стили в head
if (!document.getElementById('modal-styles')) {
    const styleEl = document.createElement('div');
    styleEl.id = 'modal-styles';
    styleEl.innerHTML = modalStyles;
    document.head.appendChild(styleEl);
}

