self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    // Simplificação máxima para evitar conflitos de cache no Android
    const actions = [
      { action: 'sim', title: 'Aprovar' },
      { action: 'nao', title: 'Recusar' }
    ];

    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon.svg',
      vibrate: [100, 50, 100],
      // Tag dinâmica para forçar o sistema a ler as novas ações a cada notificação
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
      self.registration.showNotification(data.title + ' (v7)', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();

  if (action === 'sim' || action === 'nao') {
    const actionType = action === 'sim' ? 'approve' : 'reject';
    
    event.waitUntil(
      self.registration.showNotification('Processando...', {
        body: `Enviando: ${actionType.toUpperCase()} (ID: ${action})...`,
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
        
        // Fechar processamento
        self.registration.getNotifications({ tag: 'processing' }).then(notifications => {
          notifications.forEach(n => n.close());
        });

        if (response.ok) {
          return self.registration.showNotification('✅ Sucesso!', {
            body: `Servidor confirmou: ${result.appliedStatus}`,
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
