const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Capture EVERYTHING
    page.on('console', msg => console.log('BROWSER_LOG:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('BROWSER_PAGE_ERROR:', error.message));
    page.on('requestfailed', req => console.log('BROWSER_REQ_FAIL:', req.url()));

    // Inject error listener
    await page.evaluateOnNewDocument(() => {
        window.addEventListener('error', e => console.log('WINDOW_ERROR:', e.message, e.filename, e.lineno));
        window.addEventListener('unhandledrejection', e => console.log('PROMISE_REJECT:', e.reason));
    });

    await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
    
    await page.click('#btn-sortie');
    await new Promise(r => setTimeout(r, 1000));
    
    // click stage 1
    await page.evaluate(() => {
        const stageBtn = document.querySelector('.stage-btn');
        if (stageBtn) stageBtn.click();
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    await browser.close();
})();
