// Service Worker for 造梦江湖 - Mock 4399 API
const CACHE_NAME = 'dream-journey-v1-v2';

// 静态资源文件列表（会被缓存）
const STATIC_ASSETS = [
    'gamefile.swf',
    'index.html'
];

// 初始化缓存
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Cache opened');
            return cache.addAll(STATIC_ASSETS.map(url => '/' + url));
        }).then(() => {
            console.log('[SW] Static assets cached');
            return self.skipWaiting();
        })
    );
});

// 处理请求
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    
    // 跳过非同源请求（除非是CDN）
    if (url.origin !== self.location.origin && !url.hostname.includes('jsdelivr')) {
        event.respondWith(handle4399Request(event.request));
        return;
    }
    
    // 处理本地请求
    event.respondWith(handleRequest(event.request));
});

// 处理所有请求
async function handleRequest(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 检查是否是资源请求
    if (isResourceRequest(pathname)) {
        return handleResourceRequest(request, pathname);
    }
    
    // 尝试网络请求
    try {
        const response = await fetch(request);
        return response;
    } catch (e) {
        // 网络失败，从缓存获取
        const cached = await caches.match(request);
        if (cached) {
            return cached;
        }
        return new Response('Resource not found', { status: 404 });
    }
}

// 判断是否是游戏资源请求
function isResourceRequest(pathname) {
    const resourceExtensions = ['.swf', '.xml', '.mp3', '.png', '.jpg', '.gif'];
    return resourceExtensions.some(ext => pathname.endsWith(ext));
}

// 处理资源请求
async function handleResourceRequest(request, pathname) {
    // 移除开头的斜杠
    const cleanPath = pathname.replace(/^\//, '');
    
    // 1. 尝试从缓存获取
    const cached = await caches.match(cleanPath);
    if (cached) {
        console.log('[SW] Cache hit:', cleanPath);
        return cached;
    }
    
    // 2. 尝试从本地assets目录获取
    const localPath = getLocalPath(pathname);
    if (localPath) {
        try {
            const response = await fetch(new Request(localPath));
            if (response.ok) {
                // 缓存并返回
                const cache = await caches.open(CACHE_NAME);
                cache.put(cleanPath, response.clone());
                console.log('[SW] Local asset found:', localPath);
                return response;
            }
        } catch (e) {
            console.log('[SW] Local asset not found:', localPath);
        }
    }
    
    // 3. 如果是gamefile.swf请求，返回本地版本
    if (pathname.endsWith('gamefile.swf') || pathname.endsWith('gamefile.bin')) {
        const response = await fetch(new Request('/gamefile.swf'));
        if (response.ok) {
            return response;
        }
    }
    
    // 4. 返回空响应
    console.log('[SW] Returning empty for:', pathname);
    return createEmptyResponse(pathname);
}

// 获取本地资源路径
function getLocalPath(pathname) {
    // 4399 sbai资源
    if (pathname.includes('sbai.4399.com')) {
        const match = pathname.match(/sbai\.4399\.com.*\/(.+)$/);
        if (match) {
            return `/assets-swf/${match[1]}`;
        }
    }
    
    // 4399控制文件
    if (pathname.includes('cdn.comment.4399pk.com')) {
        const match = pathname.match(/([^\/]+\.swf)$/);
        if (match) {
            return `/ctrl/${match[1]}`;
        }
    }
    
    // 其他资源
    const filename = pathname.split('/').pop();
    if (filename) {
        return `/assets-swf/${filename}`;
    }
    
    return null;
}

// 处理4399 API请求
async function handle4399Request(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    console.log('[SW] Mocking 4399 request:', pathname);
    
    // flash_ctrl_version.xml
    if (pathname.includes('flash_ctrl_version')) {
        return new Response(getCtrlVersionXML(), {
            headers: { 'Content-Type': 'application/xml; charset=utf-8' }
        });
    }
    
    // 4399控制SWF文件
    if (pathname.includes('ctrl_mo_v5.swf') || 
        pathname.includes('A4399dv_base.swf') ||
        pathname.includes('zwsf2-3.gif')) {
        const filename = pathname.split('/').pop();
        const localPath = `/ctrl/${filename}`;
        
        try {
            const response = await fetch(new Request(localPath));
            if (response.ok) {
                return response;
            }
        } catch (e) {
            console.log('[SW] Ctrl file not found:', filename);
        }
        
        // 返回空SWF
        return createEmptyResponse(pathname);
    }
    
    // 存档API
    if (pathname.includes('save.api.4399') || 
        pathname.includes('savedata') || 
        pathname.includes('getdata') ||
        pathname.includes('getlist')) {
        return handleSaveDataRequest(request);
    }
    
    // 排行榜API
    if (pathname.includes('rank')) {
        return handleRankRequest(request);
    }
    
    // 支付API
    if (pathname.includes('payMoney') || pathname.includes('GamePay')) {
        return handlePayRequest(request);
    }
    
    // 商城API
    if (pathname.includes('shop')) {
        return handleShopRequest(request);
    }
    
    // 其他API返回成功
    return new Response(JSON.stringify({ code: 0, msg: 'success' }), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// 处理存档请求
async function handleSaveDataRequest(request) {
    const url = new URL(request.request.url);
    const pathname = url.pathname;
    
    console.log('[SW] Save API:', request.method, pathname);
    
    // 保存存档
    if (pathname.includes('savedata') || request.method === 'POST') {
        return new Response(JSON.stringify({
            code: 0,
            msg: 'save success',
            data: { timestamp: Date.now() }
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
    
    // 获取存档列表
    if (pathname.includes('getlist')) {
        return new Response(JSON.stringify({
            code: 0,
            msg: 'success',
            data: {
                list: [],
                total: 0
            }
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
    
    // 获取存档数据
    if (pathname.includes('getdata')) {
        return new Response(JSON.stringify({
            code: 0,
            msg: 'success',
            data: {
                uid: 'local_user_001',
                gameid: '100023042',
                gamename: '造梦江湖之小宝传奇',
                savedata: null,
                createtime: Date.now(),
                updatetime: Date.now()
            }
        }), {
            headers: { 
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            }
        });
    }
    
    return new Response('', { status: 200 });
}

// 处理排行榜请求
function handleRankRequest(request) {
    return new Response(JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
            ranklist: [],
            myrank: 0
        }
    }), {
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

// 处理支付请求
function handlePayRequest(request) {
    return new Response(JSON.stringify({
        code: 0,
        msg: '支付成功（本地模式）',
        data: {
            orderid: 'local_' + Date.now(),
            status: 'success'
        }
    }), {
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

// 处理商城请求
function handleShopRequest(request) {
    return new Response(JSON.stringify({
        code: 0,
        msg: 'success',
        data: {
            items: [],
            currency: 99999,
            gold: 99999
        }
    }), {
        headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*'
        }
    });
}

// 生成flash_ctrl_version.xml内容
function getCtrlVersionXML() {
    return `<?xml version="1.0" encoding="utf-8"?>
<flash>
    <version>20120417</version>
    <url>ctrl_mo_v5.swf</url>
</flash>`;
}

// 创建空响应
async function createEmptyResponse(pathname) {
    const ext = pathname.split('.').pop().toLowerCase();
    
    if (ext === 'swf') {
        // 返回一个最小有效的空SWF
        return new Response(createMinimalSWF(), {
            headers: { 'Content-Type': 'application/x-shockwave-flash' }
        });
    }
    
    if (ext === 'xml') {
        return new Response('<?xml version="1.0"?><root></root>', {
            headers: { 'Content-Type': 'application/xml' }
        });
    }
    
    if (['mp3', 'ogg', 'wav'].includes(ext)) {
        return new Response('', {
            headers: { 'Content-Type': 'audio/' + ext }
        });
    }
    
    if (['png', 'jpg', 'jpeg', 'gif'].includes(ext)) {
        // 返回1x1透明像素
        return new Response(atob('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=='), {
            headers: { 'Content-Type': 'image/' + (ext === 'jpg' ? 'jpeg' : ext) }
        });
    }
    
    return new Response('', { status: 200 });
}

// 创建最小有效SWF
function createMinimalSWF() {
    // FWS header + minimal content
    const header = new Uint8Array([
        0x46, 0x57, 0x53, // FWS signature
        0x0C,             // version 12 (支持Starling)
        0x00, 0x00, 0x00, 0x00, // file length
        // Rect: 1 pixel (0 bits = 1 pixel)
        0x03, 0x00, 0x00, 0x00, 0x00,
        // Frame rate: 60 fps
        0x40, 0x1E,
        // Frame count: 1
        0x01, 0x00
    ]);
    
    // End tag
    const endTag = new Uint8Array([0x00, 0x00]);
    
    const buffer = new Uint8Array(header.length + endTag.length);
    buffer.set(header, 0);
    buffer.set(endTag, header.length);
    
    // 设置长度
    const len = buffer.length;
    buffer[4] = len & 0xFF;
    buffer[5] = (len >> 8) & 0xFF;
    buffer[6] = (len >> 16) & 0xFF;
    buffer[7] = (len >> 24) & 0xFF;
    
    return buffer.buffer;
}

// 激活service worker
self.addEventListener('activate', (event) => {
    console.log('[SW] Activating service worker...');
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        console.log('[SW] Deleting old cache:', cacheName);
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
    self.clients.claim();
});
