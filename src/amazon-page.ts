import { Page } from "puppeteer-core";
import {AmazonProduct} from "./amazon-product";

export class AmazonPage {
  constructor(public product: AmazonProduct, public page: Page) {
    page.setDefaultTimeout(1000 * 30);
  }

  get url() {
    return AmazonPage.codeToUrl(this.product.code);
  }

  async checkInventory() {
    if (this.page.url() !== 'about:blank' && !this.page.url().startsWith(this.url)) {
      return false;
    }
    await this.reload();
    return this.hasInventory();
  }

  private async reload() {
    await this.page.goto(this.url, {waitUntil: "networkidle2" });
  }

  private async hasInventory(): Promise<boolean> {
    return this.page.$eval('.olpSellerName', element => {
      if (element) {
        return element.innerHTML.includes('Amazon.co.jp');
      }
      return false;
    }).catch(() => false);
  }

  static codeToUrl(code: string) {
    return `https://www.amazon.co.jp/gp/offer-listing/${code}`;
  }
}
