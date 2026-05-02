self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    // v13: Apenas UM botão para evitar confusão de ID no Android
    const actions = [
      { action: 'aprovar_v13', title: '✅ APROVAR AGENDAMENTO' }
    ];

    const options = {
      body: data.body + '\n\n(Toque aqui para RECUSAR)',
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
      self.registration.showNotification(data.title + ' (v13)', options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  const notification = event.notification;
  const action = event.action;
  const data = notification.data || {};
  
  notification.close();

  // Se clicou no botão APROVAR
  if (action === 'aprovar_v13') {
    event.waitUntil(
      self.registration.showNotification('V13: Aprovando...', {
        body: 'Enviando comando de aprovação...',
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
            action: 'approve' 
          })
        });
      }).then(async response => {
        const result = await response.json();
        self.registration.getNotifications({ tag: 'processing' }).then(n => n.forEach(x => x.close()));

        if (response.ok) {
          return self.registration.showNotification('✅ Agendamento Aprovado', {
            body: `Status: ${result.appliedStatus}`,
            icon: '/icon-192x192.png'
          });
        }
      })
    );
  } 
  // Se clicou no corpo da notificação (Ação de RECUSA na v13)
  else {
    event.waitUntil(
      self.registration.showNotification('V13: Recusando...', {
        body: 'Enviando comando de recusa...',
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
            action: 'reject' 
          })
        });
      }).then(async response => {
        const result = await response.json();
        self.registration.getNotifications({ tag: 'processing' }).then(n => n.forEach(x => x.close()));

        if (response.ok) {
          self.registration.showNotification('❌ Agendamento Recusado', {
            body: `Status: ${result.appliedStatus}`,
            icon: '/icon-192x192.png'
          });
        }
        return clients.openWindow(data.url || '/solicitacoes');
      })
    );
  }
});
