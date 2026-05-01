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
      { action: 'approve_v5', title: 'Aprovar ✅' },
      { action: 'reject_v5', title: 'Recusar ❌' }
    ];

    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon.svg',
      vibrate: [100, 50, 100],
      tag: 'appointment-request-v5',
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
      self.registration.showNotification(data.title + ' (v5 - Final)', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();

  // Se for um clique em um dos botões v5
  if (action === 'approve_v5' || action === 'reject_v5') {
    const actionType = action === 'approve_v5' ? 'approve' : 'reject';
    
    event.waitUntil(
      self.registration.showNotification('Processando...', {
        body: `Sua solicitação de ${actionType === 'approve' ? 'aprovação' : 'recusa'} está sendo enviada.`,
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
        // Fechar a notificação de processamento
        self.registration.getNotifications({ tag: 'processing' }).then(notifications => {
          notifications.forEach(n => n.close());
        });

        if (response.ok) {
          return self.registration.showNotification('✅ Sucesso!', {
            body: actionType === 'approve' ? 'O agendamento foi aprovado.' : 'O agendamento foi recusado.',
            icon: '/icon-192x192.png'
          });
        } else {
          return self.registration.showNotification('❌ Erro no Servidor', {
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
    // Clique normal (abre a agenda na data ou solicitações)
    event.waitUntil(
      clients.openWindow(data.url || '/solicitacoes')
    );
  }
});
