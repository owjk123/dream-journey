// Service Worker for Dream Journey
const PROXY_MAP = {
    'stat.api.4399.com/flash_ctrl_version.xml': './flash_ctrl_version.xml',
    'cdn.comment.4399pk.com/control/ctrl_mo_v5.swf': './ctrl_mo_v5.swf',
    'cdn.comment.4399pk.com/control/ctrl_mo_v4.swf': './ctrl_mo_v5.swf',
    'cdn.comment.4399pk.com/control/A4399dv_base.swf': './A4399dv_base.swf',
    'cdn.comment.4399pk.com/control/zwsf2-3.gif': './zwsf2-3.gif'
};

const ZM3_CDN_PREFIX = 'sda.4399.com/4399swf/upload_swf/ftp7/hanbao/20120107/6/';

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    
    // Proxy ZM3 game resources (SWF files)
    if (url.includes(ZM3_CDN_PREFIX)) {
        const filename = url.split('/').pop().split('?')[0];
        const localUrl = new URL('./' + filename, self.location.href).href;
        console.log('[SW] Proxy ZM3 asset:', filename);
        event.respondWith(
            fetch(localUrl).catch(() => new Response('', { status: 404 }))
        );
        return;
    }
    
    // Proxy 4399 control panel and config
    for (const [remote, local] of Object.entries(PROXY_MAP)) {
        if (url.includes(remote)) {
            const localUrl = new URL(local, self.location.href).href;
            console.log('[SW] Proxy 4399 resource:', url);
            event.respondWith(
                fetch(localUrl).catch(() => new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } }))
            );
            return;
        }
    }
    
    // Block other 4399 requests (ads, tracking, etc.)
    if (url.includes('4399.com') || url.includes('4399pk.com')) {
        console.log('[SW] Block 4399 request:', url);
        event.respondWith(
            new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } })
        );
        return;
    }
    
    event.respondWith(fetch(event.request));
});
