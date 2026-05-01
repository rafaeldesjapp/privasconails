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
      { action: 'approve', title: 'Aprovar Agora' },
      { action: 'agenda', title: 'Ver na Agenda' }
    ];

    const options = {
      body: data.body + ' [A:' + actions.length + ']',
      icon: '/icon-192x192.png',
      badge: '/icon.svg',
      vibrate: [100, 50, 100],
      tag: 'appointment-request-' + (data.appointmentId || 'default'),
      renotify: true,
      requireInteraction: true,
      data: {
        url: data.url || '/solicitacoes',
        appointmentId: data.appointmentId,
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
  
  if (event.action === 'approve') {
    const appointmentId = event.notification.data.appointmentId;
    if (!appointmentId) {
      event.waitUntil(clients.openWindow(event.notification.data.url));
      return;
    }

    event.waitUntil(
      fetch('/api/admin/approve-fast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId })
      }).then(response => {
        if (response.ok) {
          return self.registration.showNotification('Sucesso', {
            body: 'Agendamento aprovado!',
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
