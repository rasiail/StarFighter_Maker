const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    page.on('console', msg => console.log('BROWSER_LOG:', msg.text()));
    page.on('pageerror', error => console.log('BROWSER_ERROR:', error.message));
    
    await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
    
    await page.click('#btn-sortie');
    await new Promise(r => setTimeout(r, 1000));
    
    await page.evaluate(() => {
        const stageBtn = document.querySelector('.stage-btn');
        if (stageBtn) stageBtn.click();
    });
    await new Promise(r => setTimeout(r, 1000));
    
    // Press ESC to open options menu
    await page.keyboard.press('Escape');
    await new Promise(r => setTimeout(r, 1000));
    
    const optionsDisplay = await page.evaluate(() => {
        const el = document.getElementById('options-modal');
        return el ? window.getComputedStyle(el).display : 'null';
    });
    console.log('Options Modal:', optionsDisplay);

    await browser.close();
})();
