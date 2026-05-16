// Service Worker for 造梦江湖 - Mock 4399 API
const CACHE_NAME = 'dream-journey-v1';
const BASE_URL = '';

// 资源路径映射
const RESOURCE_PATTERNS = [
    { pattern: /sbai\.4399\.com\/4399swf\/upload_swf\/ftp10\/honghao\/20130321\/9\/(.+)/, path: 'main-swf/$1' },
    { pattern: /cdn\.comment\.4399pk\.com\/control\/(.+)/, path: 'ctrl/$1' },
    { pattern: /api\.4399\.com\/(.+)/, path: 'api/$1' },
    { pattern: /save\.api\.4399\.com\/(.+)/, path: 'api/save/$1' },
];

// 初始化缓存
self.addEventListener('install', (event) => {
    console.log('[SW] Installing service worker...');
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('[SW] Cache opened');
            return cache;
        })
    );
    self.skipWaiting();
});

// 处理请求
self.addEventListener('fetch', (event) => {
    const url = new URL(event.request.url);
    const pathname = url.pathname;
    
    // 跳过非同源请求（除非是CDN的Ruffle）
    if (url.origin !== self.location.origin && !url.hostname.includes('jsdelivr')) {
        // 允许CDN请求
        if (url.hostname.includes('jsdelivr')) {
            return;
        }
        // 对于4399 API请求，我们需要mock
        event.respondWith(handle4399Request(event.request));
        return;
    }
    
    // 处理本地资源请求
    event.respondWith(handleLocalRequest(event.request));
});

// 处理4399 API请求
async function handle4399Request(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // flash_ctrl_version.xml
    if (pathname.includes('flash_ctrl_version.xml')) {
        return new Response(getCtrlVersionXML(), {
            headers: { 'Content-Type': 'application/xml' }
        });
    }
    
    // ctrl_mo_v5.swf 或其他4399控制文件
    if (pathname.includes('ctrl_mo_v5.swf') || pathname.includes('A4399dv_base.swf')) {
        // 尝试从本地ctrl目录加载
        const filename = pathname.split('/').pop();
        try {
            const localResponse = await fetch(new Request(`${BASE_URL}/ctrl/${filename}`));
            if (localResponse.ok) {
                return localResponse;
            }
        } catch (e) {
            console.log('[SW] Local ctrl file not found:', filename);
        }
        // 如果本地没有，返回空的SWF
        return new Response(createEmptySWF(), {
            headers: { 'Content-Type': 'application/x-shockwave-flash' }
        });
    }
    
    // 保存/读取存档API
    if (pathname.includes('savedata') || pathname.includes('getdata') || pathname.includes('getlist')) {
        return handleSaveDataRequest(request);
    }
    
    // 排行榜API
    if (pathname.includes('rank')) {
        return handleRankRequest(request);
    }
    
    // 其他4399请求返回空
    console.log('[SW] Mocking 4399 request:', pathname);
    return new Response('', { status: 200 });
}

// 处理存档请求
function handleSaveDataRequest(request) {
    const url = new URL(request.url);
    const pathname = url.pathname;
    
    // 创建一个mock的存档响应
    const mockResponse = {
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
    };
    
    // 如果是保存数据请求
    if (pathname.includes('savedata') && request.method === 'POST') {
        return new Response(JSON.stringify({
            code: 0,
            msg: 'save success'
        }), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    // 如果是获取数据请求
    if (pathname.includes('getdata') || pathname.includes('getlist')) {
        return new Response(JSON.stringify(mockResponse), {
            headers: { 'Content-Type': 'application/json' }
        });
    }
    
    return new Response('', { status: 200 });
}

// 处理排行榜请求
function handleRankRequest(request) {
    const mockRankResponse = {
        code: 0,
        msg: 'success',
        data: {
            ranklist: [],
            myrank: 0
        }
    };
    
    return new Response(JSON.stringify(mockRankResponse), {
        headers: { 'Content-Type': 'application/json' }
    });
}

// 处理本地资源请求
async function handleLocalRequest(request) {
    const url = new URL(request.url);
    let pathname = url.pathname;
    
    // 移除开头的斜杠
    if (pathname.startsWith('/')) {
        pathname = pathname.substring(1);
    }
    
    // 尝试从缓存获取
    const cache = await caches.open(CACHE_NAME);
    const cachedResponse = await cache.match(pathname);
    if (cachedResponse) {
        return cachedResponse;
    }
    
    // 尝试从文件系统获取
    try {
        const response = await fetch(request);
        if (response.ok) {
            // 缓存响应
            cache.put(pathname, response.clone());
            return response;
        }
    } catch (e) {
        console.log('[SW] Fetch failed for:', pathname);
    }
    
    // 返回404
    return new Response('Resource not found: ' + pathname, { 
        status: 404,
        headers: { 'Content-Type': 'text/plain' }
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

// 创建一个空的SWF文件（最小有效SWF）
function createEmptySWF() {
    // 这是一个最小有效的SWF文件（约50字节）
    // FWS + version(1) + length(4) + rect(5) + frameRate(2) + frameCount(2)
    const swf = new Uint8Array([
        0x46, 0x57, 0x53, // FWS signature
        0x09,             // version 9
        0x00, 0x00, 0x00, 0x00, // file length (placeholder)
        0x3f, 0x03, 0x00, 0x00, 0x00, // rect (1px)
        0x04, 0x00,       // frame rate 4fps
        0x01, 0x00,       // 1 frame
        0x00, 0x00        // end tag
    ]);
    return swf.buffer;
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
