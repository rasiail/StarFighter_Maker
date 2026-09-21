const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    
    // Capture EVERYTHING
    page.on('console', msg => console.log('BROWSER_LOG:', msg.type(), msg.text()));
    page.on('pageerror', error => console.log('BROWSER_PAGE_ERROR:', error.message));

    await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
    await browser.close();
})();
