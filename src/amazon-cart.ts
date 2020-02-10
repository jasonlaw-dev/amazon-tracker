import { Page } from "puppeteer";
import { AmazonPageType } from './amazon-page-type';
import { sleep } from "./sleep";

export class AmazonCart {

  static url = 'https://www.amazon.co.jp/gp/cart/view.html';

  constructor(public page: Page) {
  }

  async checkInventory() {
    if (!this.page.isClosed() && this.page.url() !== 'about:blank' && this.page.url() != AmazonCart.url){
      return false;
    }
    if (await this.hasInventory()) {
      this.page.click('#sc-buy-box-ptc-button').catch(console.error);
      return true;
    }

    return false;
  }


  private async hasInventory(): Promise<boolean> {
    try {
      await this.page.goto(AmazonCart.url, { waitUntil: 'domcontentloaded' });

      const [placeOrderButton, moveToCartButton] = await Promise.all([
        this.page.$('#sc-buy-box-ptc-button'),
        this.page.$('.sc-action-move-to-cart input'),
      ]);
      if (moveToCartButton) {
        const click = () => this.page.click('.sc-action-move-to-cart input');
        await click().catch(console.error);
        await sleep(500);
        click().catch(console.error);
      }
      return moveToCartButton != null || placeOrderButton != null;
    } catch (e) {
      console.log(e);
    }
    return false;
  }
}
