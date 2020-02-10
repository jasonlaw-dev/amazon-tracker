import notifier from 'node-notifier';
import PQueue from 'p-queue';
import puppeteer, {Browser, Page} from "puppeteer-core";
import { AmazonCart } from './amazon-cart';
import {AmazonPage} from "./amazon-page";
import {AmazonProduct} from "./amazon-product";
import { sleep } from './sleep';

/*
    Run in terminal: /Applications/Google\ Chrome.app/Contents/MacOS/Google\ Chrome --remote-debugging-port=9222
  */

export class AmazonTracker {

  products: AmazonProduct[] = [
    // {code: "B0006L0120", desc: 'Test Item'},
    // {code: "B07YY9ZD7M", desc: 'Presto red 200'},
    // {code: "B07ZPB2NQT", desc: '快適防護 60個獨立包裝'},
    // {code: "B00EP56O0G", desc: 'BMC 60'},
    // {code: "B008WX2OY2", desc: 'BMC 50'},
    // {code: "B01545GQ9O", desc: 'fitty 30 ind'},
    {code: "B07T3MNKKW", desc: 'Presto green 120'},
    {code: "B07YY9Q6LK", desc: 'Presto blue 120'},
    {code: "B0785VKT85", desc: 'Presto blue 120'},
    {code: "B0785VW2SH", desc: 'Presto blue 200'},
    {code: "B07T5V4TCV", desc: 'Presto green 200'},
    // {code: "B07571223K", desc: 'BMC 80 ind'},
    // {code: "B00YM1NSPC", desc: '超立體 50個'},
    // {code: "B0141ZPO1E", desc: '白元60'},
    // {code: "B07MJKHYDC", desc: '白元120'},
    // {code: "B075MWTSMJ", desc: 'fitty 50'},
    // {code: "B016DCAOOA", desc: 'fitty 100 ind'},
    // {code: "B07573632C", desc: 'fitty 60'},
    {code: "B07YXX7ZDN", desc: 'Comdia 240'},
    {code: "B07YXX6SJF", desc: 'Comdia 150'},
  ];

  amazonPages: AmazonPage[] = [];

  browser: Browser = null!;

  async start() {
    const browser = await puppeteer.connect({browserURL: 'http://127.0.0.1:9222', defaultViewport: null});
    this.browser = browser;

    await this.initPages();

    let found = false;

    const queue = new PQueue({
      autoStart: true,
      // concurrency: 2,
      interval: 1500,
      intervalCap: 2,
    });

    const addToQueue = (amazonPage: AmazonPage) => {
      queue.add(async () => {
        amazonPage.checkInventory().then(async (isFound) => {
          if (isFound) {
            if (!found) {
              found = true;
              await amazonPage.page.bringToFront();
            }
            notifier.notify({
              title: `${amazonPage.product.code}${amazonPage.product.desc ? ' - ' + amazonPage.product.desc : ''} is found!`,
              message: 'Click to view',
              sound: 'Ping',
              timeout: 10,
            }, (err, response) => {
              if (response === 'activate') {
                amazonPage.page.bringToFront().catch(console.error);
              }
            });
          }
          setTimeout(() => addToQueue(amazonPage), isFound ? 1000 * 60 : 1000 * 5);
        });
      })
    };

    this.amazonPages.forEach((amazonPage) => addToQueue(amazonPage));

    const cartPage = (await this.browser.pages()).find(page => page.url() === AmazonCart.url) || await browser.newPage();
    const cart = new AmazonCart(cartPage);
    while (true) {
      if (await cart.checkInventory()) {
        notifier.notify({
          title: `Cart has inventory!`,
          message: 'Click to view',
          sound: 'Ping',
          timeout: 10,
        }, (err, response) => {
          if (response === 'activate') {
            cart.page.bringToFront().catch(console.error);
          }
        });
        cart.page.bringToFront().catch(console.error);

        await sleep(1000);

        try {
          if (cart.page.url() === 'https://www.amazon.co.jp/gp/buy/spc/handlers/display.html?hasWorkingJavascript=1') {
            const validProducts = this.products.filter(({ desc }) => desc && !desc.toLowerCase().includes('test'));
            const innerHTML = await cart.page.$eval('#spc-orders', el => el.innerHTML);
            if (validProducts.some(({ code }) => innerHTML.includes(code))) {
              await cart.page.click('.place-your-order-button');
            } else {
              console.log('test product found');
            }
          }
        } catch (e) {
          console.error(e);
        }

        await sleep(1000 * 30);
      } else {
        await sleep(1000);
      }
    }
  }

  async initPages() {
    const pages = await this.browser.pages();
    const urls = pages.map(page => page.url());
    this.amazonPages = await Promise.all(this.products.map(async (product) => {
      const pageIndex = urls.findIndex(url => url === AmazonPage.codeToOfferListingUrl(product.code) || url === AmazonPage.codeToProductUrl(product.code));
      let page: Page;
      if (pageIndex >= 0) {
        page = pages[pageIndex];
      } else {
        page = await this.browser.newPage();
      }
      return new AmazonPage(product, page);
    }));
  }
}
