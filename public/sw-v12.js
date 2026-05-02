self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    // IDs v12: Diferenciação total de formato para forçar o Android a separar
    const actions = [
      { action: 'SIM_CONFIRMAR', title: 'Aprovar' },
      { action: '0', title: 'Recusar' }
    ];

    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon.svg',
      vibrate: [100, 50, 100],
      tag: 'req-' + Date.now(),
      renotify: true,
      requireInteraction: true,
      data: {
        url: data.date ? `/agenda?date=${data.date}` : (data.url || '/solicitacoes'),
        appointmentId: data.appointmentId,
        solicitationId: data.solicitationId,
        date: data.date
      },
      actions: actions
    };

    event.waitUntil(
      self.registration.showNotification(data.title + ' (v12)', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();

  if (action === 'SIM_CONFIRMAR' || action === '0') {
    const actionType = action === 'SIM_CONFIRMAR' ? 'approve' : 'reject';
    
    event.waitUntil(
      self.registration.showNotification('V12: Processando...', {
        body: `ID Detectado: "${action}" | Ação: ${actionType.toUpperCase()}`,
        icon: '/icon-192x192.png',
        silent: true,
        tag: 'processing'
      }).then(() => {
        return fetch('/api/admin/handle-action-v5', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            appointmentId: data.appointmentId, 
            solicitationId: data.solicitationId, 
            action: actionType 
          })
        });
      }).then(async response => {
        const result = await response.json();
        
        self.registration.getNotifications({ tag: 'processing' }).then(notifications => {
          notifications.forEach(n => n.close());
        });

        if (response.ok) {
          return self.registration.showNotification('✅ Sucesso V12', {
            body: `Botão: "${action}" | Servidor: ${result.appliedStatus}`,
            icon: '/icon-192x192.png'
          });
        } else {
          return self.registration.showNotification('❌ Erro V12', {
            body: result.error || 'Falha ao processar.',
            icon: '/icon-192x192.png'
          });
        }
      }).catch(err => {
        return self.registration.showNotification('⚠️ Erro V12', {
          body: 'Falha ao conectar.',
          icon: '/icon-192x192.png'
        });
      })
    );
  } else {
    event.waitUntil(clients.openWindow(data.url || '/solicitacoes'));
  }
});
