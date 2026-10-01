// Service Worker do Rota 8 ERP — cache mínimo, apenas para permitir
// instalação como PWA e uso offline básico. Não interfere em nenhuma
// lógica de negócio do sistema.
//
// CORREÇÃO (2026-09-28): a versão anterior (v6) reescrevia a URL de toda
// requisição de navegação para "furar" o cache da CDN, e se essa busca na
// rede falhasse por QUALQUER motivo, caía num fallback que devolvia a
// cópia salva do index.html — para QUALQUER arquivo pedido, mesmo um que
// nunca tinha sido cacheado antes (ex.: erp.html, erp-v2.html). Na prática,
// isso fazia o site inteiro mostrar sempre o index.html antigo, não
// importa qual página fosse realmente aberta. Esta versão nunca substitui
// um arquivo pelo conteúdo de outro — só usa cache como reserva para
// quando o aparelho está genuinamente offline, e só devolve o PRÓPRIO
// arquivo pedido, nunca outro.
const CACHE_NAME = 'rota8-erp-cache-v7';
const ASSETS_TO_CACHE = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(ASSETS_TO_CACHE);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames
          .filter(function(name) { return name !== CACHE_NAME; })
          .map(function(name) { return caches.delete(name); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function(event) {
  // Somente GET; deixa tudo mais (Firebase, APIs) passar direto pela rede.
  if (event.request.method !== 'GET') return;

  // Só cuida de requisições do próprio site (mesma origem). Firebase,
  // fontes do Google, CDNs de bibliotecas — tudo isso passa direto, sem
  // nenhuma interferência deste Service Worker.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  // Network-first, sempre — sem reescrever a URL da requisição. A
  // reescrita anterior (para tentar furar cache de CDN) era o ponto que
  // podia falhar e disparar o fallback errado.
  event.respondWith(
    fetch(event.request, { cache: 'no-store' }).then(function(response) {
      if (response && response.status === 200 && response.type === 'basic') {
        var responseClone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, responseClone);
        });
      }
      return response;
    }).catch(function() {
      // Sem rede (genuinamente offline): usa cache SÓ se for exatamente o
      // arquivo pedido. Nunca substitui pelo index.html ou qualquer outro
      // arquivo — se não tiver esse arquivo específico em cache, deixa
      // falhar (o navegador mostra a tela padrão de "sem conexão").
      return caches.match(event.request);
    })
  );
});
