self.addEventListener('push', function(event) {
  if (event.data) {
    const data = event.data.json();
    const options = {
      body: data.body,
      icon: '/icon-192x192.png',
      badge: '/icon.svg',
      vibrate: [100, 50, 100],
      data: {
        url: data.url || '/solicitacoes',
        appointmentId: data.appointmentId,
        date: data.date
      },
      actions: data.appointmentId ? [
        { action: 'approve', title: '✅ Aprovar' },
        { action: 'agenda', title: '📅 Ver na Agenda' }
      ] : []
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
    event.waitUntil(
      fetch('/api/admin/approve-fast', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appointmentId })
      }).then(response => {
        if (response.ok) {
          return self.registration.showNotification('✅ Sucesso', {
            body: 'O agendamento foi aprovado com sucesso!',
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
    // Clique normal na notificação
    event.waitUntil(
      clients.openWindow(event.notification.data.url)
    );
  }
});
