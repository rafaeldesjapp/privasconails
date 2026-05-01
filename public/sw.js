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
      { action: 'approve', title: 'Aprovar ✅' },
      { action: 'reject', title: 'Recusar ❌' }
    ];

    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon.svg',
      vibrate: [100, 50, 100],
      tag: 'appointment-request-v4',
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

    // (v4) para confirmar que o código novo está rodando
    event.waitUntil(
      self.registration.showNotification(data.title + ' (v4)', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const { appointmentId, solicitationId, url } = event.notification.data;

  if (event.action === 'approve' || event.action === 'reject') {
    if (!appointmentId) {
      event.waitUntil(clients.openWindow(url));
      return;
    }

    const actionType = event.action === 'approve' ? 'approve' : 'reject';

    // Notificação imediata de processamento
    event.waitUntil(
      self.registration.showNotification('Processando...', {
        body: `Ação: ${actionType === 'approve' ? 'Aprovação' : 'Recusa'} em andamento...`,
        icon: '/icon-192x192.png',
        silent: true
      }).then(() => {
        return fetch('/api/admin/handle-action-v4', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ appointmentId, solicitationId, action: actionType })
        });
      }).then(async response => {
        const result = await response.json();
        if (response.ok) {
          return self.registration.showNotification('✅ Sucesso!', {
            body: actionType === 'approve' ? 'Agendamento aprovado com sucesso.' : 'Agendamento recusado com sucesso.',
            icon: '/icon-192x192.png'
          });
        } else {
          return self.registration.showNotification('❌ Erro no Servidor', {
            body: result.error || 'Não foi possível processar a ação.',
            icon: '/icon-192x192.png'
          });
        }
      }).catch(err => {
        return self.registration.showNotification('⚠️ Erro de Conexão', {
          body: 'Verifique sua internet ou o status do servidor.',
          icon: '/icon-192x192.png'
        });
      })
    );
  } else {
    event.waitUntil(clients.openWindow(url));
  }
});
