self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    // IDs inconfundíveis para evitar erros de mapeamento no Android
    const actions = [
      { action: 'BOT_APPROVE', title: 'Aprovar ✅' },
      { action: 'BOT_REJECT', title: 'Recusar ❌' }
    ];

    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon.svg',
      vibrate: [100, 50, 100],
      tag: 'appointment-request-final',
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
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();

  // Mapeamento explícito das ações
  if (action === 'BOT_APPROVE' || action === 'BOT_REJECT') {
    const actionType = action === 'BOT_APPROVE' ? 'approve' : 'reject';
    
    event.waitUntil(
      self.registration.showNotification('Processando...', {
        body: `Detectado: ${actionType === 'approve' ? 'APROVAÇÃO' : 'RECUSA'}. Enviando ao servidor...`,
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
        
        // Fechar notificação de processamento
        self.registration.getNotifications({ tag: 'processing' }).then(notifications => {
          notifications.forEach(n => n.close());
        });

        if (response.ok) {
          return self.registration.showNotification('✅ Sucesso!', {
            body: actionType === 'approve' ? 'O agendamento foi aprovado.' : 'O agendamento foi recusado.',
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
          body: 'Não foi possível falar com o servidor.',
          icon: '/icon-192x192.png'
        });
      })
    );
  } else {
    event.waitUntil(clients.openWindow(data.url || '/solicitacoes'));
  }
});
