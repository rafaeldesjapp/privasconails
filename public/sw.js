self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    
    // Tornar as ações incondicionais para teste e remover emojis temporariamente para isolar o problema
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon.svg',
      vibrate: [100, 50, 100],
      tag: 'appointment-request',
      renotify: true,
      requireInteraction: true,
      data: {
        url: data.url || '/solicitacoes',
        appointmentId: data.appointmentId,
        date: data.date
      },
      actions: [
        { action: 'approve', title: 'Aprovar' },
        { action: 'reject', title: 'Recusar' },
        { action: 'agenda', title: 'Ver' }
      ]
    };

    event.waitUntil(
      self.registration.showNotification(data.title, options)
    );
  }
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  
  const appointmentId = event.notification.data.appointmentId;

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
        body: JSON.stringify({ appointmentId, action: actionType })
      }).then(response => {
        if (response.ok) {
          const msg = actionType === 'approve' ? 'Agendamento aprovado!' : 'Agendamento recusado!';
          return self.registration.showNotification(actionType === 'approve' ? 'Sucesso' : 'Resolvido', {
            body: msg,
            icon: '/icon-192x192.png'
          });
        }
      })
    );
  } else if (event.action === 'agenda') {
    const date = event.notification.data.date;
    const url = date ? `/agenda?date=${date}` : '/agenda';
    event.waitUntil(
      clients.openWindow(url)
    );
  } else {
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
