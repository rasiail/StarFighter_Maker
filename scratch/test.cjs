const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
    page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
    page.on('requestfailed', req => console.log('404_ERROR:', req.url()));
    
    await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
    
    await browser.close();
})();
