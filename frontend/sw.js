self.addEventListener('install',()=>self.skipWaiting());
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
// Text sharing is handled by the manifest's GET share_target and the page.
// WhatsApp image/PDF direct share needs a separate POST share-target implementation.
