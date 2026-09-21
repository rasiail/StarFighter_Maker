const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
    page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
    
    await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
    
    // Evaluate if game is running
    const state = await page.evaluate(() => {
        return window.gameState ? window.gameState.isGameRunning : 'No gameState';
    });
    console.log('Game Running State:', state);
    
    // Check overlapping elements
    const bodyChildren = await page.evaluate(() => {
        return Array.from(document.body.children).map(c => ({id: c.id, display: window.getComputedStyle(c).display}));
    });
    console.log('Body Children:', bodyChildren);
    
    await browser.close();
})();
