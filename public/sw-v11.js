self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    // IDs v11 com lógica invertida para compensar o comportamento do Xiaomi
    const actions = [
      { action: '1', title: 'Aprovar' },
      { action: '2', title: 'Recusar' }
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
      self.registration.showNotification(data.title + ' (v11)', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();

  if (action === '1' || action === '2') {
    // Lógica v11 Invertida: Se o celular manda 2 ao clicar no 1º botão (Aprovar), 
    // então tratamos o 2 como aprovação e o 1 como recusa.
    const actionType = action === '2' ? 'approve' : 'reject';
    
    event.waitUntil(
      self.registration.showNotification('V11: Processando...', {
        body: `Código: "${action}" | Interpretado: ${actionType.toUpperCase()}`,
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
          return self.registration.showNotification('✅ Sucesso V11', {
            body: `Botão: "${action}" | Servidor: ${result.appliedStatus}`,
            icon: '/icon-192x192.png'
          });
        } else {
          return self.registration.showNotification('❌ Erro V11', {
            body: result.error || 'Falha ao processar.',
            icon: '/icon-192x192.png'
          });
        }
      }).catch(err => {
        return self.registration.showNotification('⚠️ Erro V11', {
          body: 'Falha ao conectar.',
          icon: '/icon-192x192.png'
        });
      })
    );
  } else {
    event.waitUntil(clients.openWindow(data.url || '/solicitacoes'));
  }
});
