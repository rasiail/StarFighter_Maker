const puppeteer = require('puppeteer');
(async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });
    await page.goto('http://127.0.0.1:8000', { waitUntil: 'networkidle2' });
    
    // open options
    await page.evaluate(() => {
        document.getElementById('options-modal').style.display = 'flex';
    });
    await new Promise(r => setTimeout(r, 1000));
    
    await page.screenshot({ path: 'scratch/options.png' });
    
    await browser.close();
})();
