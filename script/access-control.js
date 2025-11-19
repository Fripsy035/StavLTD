// Скрипт для контроля доступа на основе ролей пользователей

document.addEventListener('DOMContentLoaded', function() {
    // Ждем загрузки модуля auth
    function waitForAuth() {
        return new Promise((resolve) => {
            const checkAuth = setInterval(() => {
                if (typeof auth !== 'undefined' && auth.isAuthenticated()) {
                    clearInterval(checkAuth);
                    resolve();
                }
            }, 100);
            setTimeout(() => {
                clearInterval(checkAuth);
                resolve();
            }, 3000);
        });
    }

    waitForAuth().then(() => {
        const user = auth.getCurrentUser();
        if (!user) return;

        const isRegularUser = user.role === 'Пользователь';

        if (isRegularUser) {
            // Скрываем ссылку на согласования в навигации
            const approvalsLink = document.querySelector('nav a[href="approvals.html"]');
            if (approvalsLink) {
                approvalsLink.parentElement.style.display = 'none';
            }
            
            // Скрываем ссылку на отчеты в навигации
            const reportsLink = document.querySelector('nav a[href="reports.html"]');
            if (reportsLink) {
                reportsLink.parentElement.style.display = 'none';
            }
        }
    });
});

