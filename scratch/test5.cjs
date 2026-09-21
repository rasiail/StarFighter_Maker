const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
    page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
    
    await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
    
    await page.click('#btn-sortie');
    await new Promise(r => setTimeout(r, 1000));
    
    // click stage 1
    await page.evaluate(() => {
        const stageBtn = document.querySelector('.stage-btn');
        if (stageBtn) stageBtn.click();
    });
    
    await new Promise(r => setTimeout(r, 2000));
    
    const isGameRunning = await page.evaluate(() => window.gameState ? window.gameState.isGameRunning : false);
    console.log('Game Running:', isGameRunning);

    await browser.close();
})();
