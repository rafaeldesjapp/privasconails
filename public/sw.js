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
      tag: 'appointment-request',
      renotify: true,
      requireInteraction: true,
      data: {
        url: data.date ? `/agenda?date=${data.date}` : (data.url || '/solicitacoes'),
        appointmentId: data.appointmentId,
        solicitationId: data.solicitationId, // Passando o ID direto agora
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
  event.notification.close();
  
  const appointmentId = event.notification.data.appointmentId;
  const solicitationId = event.notification.data.solicitationId;

  if (event.action === 'approve' || event.action === 'reject') {
    if (!appointmentId) {
      event.waitUntil(clients.openWindow(event.notification.data.url));
      return;
    }

    const actionType = event.action === 'approve' ? 'approve' : 'reject';

    event.waitUntil(
      fetch('/api/admin/handle-fast-action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId, solicitationId, action: actionType })
      }).then(response => {
        if (response.ok) {
          const msg = actionType === 'approve' ? 'Agendamento aprovado!' : 'Agendamento recusado!';
          return self.registration.showNotification(actionType === 'approve' ? '✅ Sucesso' : '❌ Resolvido', {
            body: msg,
            icon: '/icon-192x192.png'
          });
        }
      })
    );
  } else {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
