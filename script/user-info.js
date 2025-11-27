// Скрипт для обновления информации о пользователе на всех страницах

document.addEventListener('DOMContentLoaded', function() {
    // Проверяем, что мы не на странице авторизации
    if (document.body.classList.contains('auth-page')) {
        return;
    }

    // Загружаем скрипт авторизации, если он еще не загружен
    if (typeof auth === 'undefined') {
        const script = document.createElement('script');
        script.src = 'script/auth.js';
        document.head.appendChild(script);
        
        script.onload = function() {
            updateUserInfo();
        };
    } else {
        updateUserInfo();
    }

    function updateUserInfo() {
        const user = auth.getCurrentUser();
        
        if (!user) {
            // Если пользователь не авторизован, перенаправляем на страницу входа
            window.location.href = 'login.html';
            return;
        }

        // Обновляем информацию в header
        const userNameEl = document.querySelector('.user-name');
        const userRoleEl = document.querySelector('.user-role');
        const userAvatarEl = document.querySelector('.user-avatar');

        if (userNameEl) {
            const fullName = user.fullName || user.name || 'Пользователь';
            const parts = fullName.trim().split(/\s+/);
            const shortName = parts.length >= 2 ? `${parts[0]} ${parts[1]}` : fullName;
            userNameEl.textContent = shortName;
        }

        if (userRoleEl) {
            userRoleEl.textContent = user.role || 'Пользователь';
        }

        if (userAvatarEl) {
            userAvatarEl.textContent = auth.getInitials(user.fullName || user.name || 'Пользователь');
        }
    }
});

