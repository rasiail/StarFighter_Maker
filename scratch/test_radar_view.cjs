const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
    
    await page.click('#btn-sortie');
    await new Promise(r => setTimeout(r, 600));
    
    // click stage 1
    await page.evaluate(() => {
        const stageBtn = document.getElementById('btn-start-selected-stage');
        if (stageBtn) stageBtn.click();
    });
    
    await new Promise(r => setTimeout(r, 2500));
    await page.screenshot({ path: 'scratch/radar_ingame.png' });
    
    await browser.close();
})();
