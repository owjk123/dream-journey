// Service Worker for Dream Journey - 代理4399资源请求到本地
const PROXY_MAP = {
    // flash_ctrl_version.xml
    'stat.api.4399.com/flash_ctrl_version.xml': './flash_ctrl_version.xml',
    // 4399控制面板
    'cdn.comment.4399pk.com/control/ctrl_mo_v5.swf': './ctrl_mo_v5.swf',
    'cdn.comment.4399pk.com/control/ctrl_mo_v4.swf': './ctrl_mo_v5.swf',
    // 广告SWF
    'cdn.comment.4399pk.com/control/A4399dv_base.swf': './A4399dv_base.swf',
    // 加载GIF
    'cdn.comment.4399pk.com/control/zwsf2-3.gif': './zwsf2-3.gif',
    // ZM3游戏资源根路径
    'sda.4399.com/4399swf/upload_swf/ftp7/hanbao/20120107/6/': './'
};

self.addEventListener('install', (event) => {
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(clients.claim());
});

self.addEventListener('fetch', (event) => {
    const url = event.request.url;
    
    // 代理ZM3游戏资源（SWF文件）
    if (url.includes('sda.4399.com/4399swf/upload_swf/ftp7/hanbao/20120107/6/')) {
        const filename = url.split('/').pop().split('?')[0];
        const localUrl = new URL('./' + filename, self.location.href).href;
        console.log('[SW] Proxy ZM3 asset:', url, '->', localUrl);
        event.respondWith(
            fetch(localUrl).catch(() => new Response('', { status: 404 }))
        );
        return;
    }
    
    // 代理4399控制面板和配置
    for (const [remote, local] of Object.entries(PROXY_MAP)) {
        if (url.includes(remote.split('/').pop().split('?')[0])) {
            const localUrl = new URL(local, self.location.href).href;
            console.log('[SW] Proxy 4399 resource:', url, '->', localUrl);
            event.respondWith(
                fetch(localUrl).catch(() => new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } }))
            );
            return;
        }
    }
    
    // 其他4399请求返回空响应（不阻塞）
    if (url.includes('4399.com') || url.includes('4399pk.com')) {
        console.log('[SW] Block 4399 request:', url);
        event.respondWith(
            new Response('', { status: 200, headers: { 'Content-Type': 'text/plain' } })
        );
        return;
    }
    
    event.respondWith(fetch(event.request));
});
