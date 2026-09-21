const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    page.on('console', msg => console.log('LOG:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('PAGE_ERROR:', error.message));
    page.on('requestfailed', req => console.log('REQ_FAIL:', req.url(), req.failure()?.errorText));
    
    await page.goto('http://127.0.0.1:8000/ui_editor.html', { waitUntil: 'networkidle2', timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
    
    const editorVisible = await page.evaluate(() => {
        const panel = document.querySelector('[style*="zIndex: 10000"], [style*="z-index: 10000"]');
        return !!panel;
    });
    console.log('Editor panel visible:', editorVisible);
    
    await page.screenshot({ path: 'scratch/editor.png' });
    await browser.close();
})();
