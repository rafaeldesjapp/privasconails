self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    const actions = [
      { action: 'aprov_v9', title: 'Aprovar' },
      { action: 'recus_v9', title: 'Recusar' }
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
      self.registration.showNotification(data.title + ' (v9)', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  const notification = event.notification;
  const action = event.action || '';
  const data = notification.data || {};
  
  notification.close();

  // Mapeamento v9 Flexível (Busca por palavra-chave para evitar erros de caractere)
  if (action.includes('aprov') || action.includes('recus')) {
    const actionType = action.includes('aprov') ? 'approve' : 'reject';
    
    event.waitUntil(
      self.registration.showNotification('V9: Processando...', {
        body: `Lido: "${action}" | Comando: ${actionType.toUpperCase()}`,
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
          return self.registration.showNotification('✅ Resposta V9', {
            body: `ID: "${action}" | Servidor: ${result.appliedStatus}`,
            icon: '/icon-192x192.png'
          });
        } else {
          return self.registration.showNotification('❌ Erro', {
            body: result.error || 'Falha ao processar.',
            icon: '/icon-192x192.png'
          });
        }
      }).catch(err => {
        return self.registration.showNotification('⚠️ Erro de Conexão', {
          body: 'Falha ao conectar.',
          icon: '/icon-192x192.png'
        });
      })
    );
  } else {
    event.waitUntil(clients.openWindow(data.url || '/solicitacoes'));
  }
});
