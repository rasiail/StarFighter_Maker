const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
    page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
    
    await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
    
    // Click start button
    await page.click('#btn-sortie');
    await new Promise(r => setTimeout(r, 1000));
    
    const isModalVisible = await page.evaluate(() => {
        const el = document.getElementById('stage-modal');
        return el ? window.getComputedStyle(el).display : 'null';
    });
    console.log('Stage Modal:', isModalVisible);

    await browser.close();
})();
