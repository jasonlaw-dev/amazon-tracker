import { Page } from 'puppeteer-core';
import { AmazonCart } from './amazon-cart';
import { AmazonPageType } from './amazon-page-type';
import { AmazonProduct } from './amazon-product';
import { sleep } from './sleep';

export class AmazonPage {

  currentPageType = AmazonPageType.Offer_Listing;

  constructor(public product: AmazonProduct, public page: Page) {
    page.setDefaultTimeout(1000 * 30);
    page.setCacheEnabled(false);
    page.setRequestInterception(true);
    page.on('request', interceptedRequest => {
      if (interceptedRequest.resourceType() === 'image') {
        interceptedRequest.abort();
      } else {
        interceptedRequest.continue();
      } 
    });
  }

  get offerListingUrl() {
    return AmazonPage.codeToOfferListingUrl(this.product.code);
  }
  get productUrl() {
    return AmazonPage.codeToProductUrl(this.product.code);
  }

  async checkInventory() {
    if (!this.page.isClosed() && this.page.url() !== 'about:blank' && !this.page.url().startsWith(this.offerListingUrl) && !this.page.url().startsWith(this.productUrl)) {
      return false;
    }
    if (this.currentPageType === AmazonPageType.Offer_Listing) {
      this.currentPageType = AmazonPageType.Product;
    } else {
      this.currentPageType = AmazonPageType.Offer_Listing;
    }
    if (await this.hasInventory()) {
      this.addToCart();
      return true;
    }
    return false;
  }

  private async addToCart() {
    if (this.currentPageType === AmazonPageType.Offer_Listing) {
      await this.page.click('.a-button-input');
    } else {
      await this.page.click('#add-to-cart-button');
    }
    await sleep(500);
    await this.page.goto(AmazonCart.url);
  }

  private async hasInventory(): Promise<boolean> {
    const url = this.currentPageType === AmazonPageType.Offer_Listing ? this.offerListingUrl : this.productUrl;
    const navigationFinished = this.page.waitForNavigation({ waitUntil: 'networkidle2' });
    await this.page.goto(url, { waitUntil: 'domcontentloaded' });

    if (this.currentPageType === AmazonPageType.Offer_Listing) {
      await Promise.race([navigationFinished, this.page.waitForSelector('.olpSellerName')]);
      return this.page.$eval('.olpSellerName', element => {
        if (element) {
          return element.innerHTML.includes('Amazon.co.jp');
        }
        return false;
      }).catch(() => false)
    }

    await Promise.race([navigationFinished, this.page.waitForSelector('#merchant-info')]);
    return this.page.$eval('#merchant-info', element => {
      if (element) {
        let innerHTML = element.innerHTML;
        return innerHTML.includes('643004')
          || innerHTML.includes('Amazon.co.jp') && (innerHTML.includes('Ships from and sold by') || innerHTML.includes('販売、発送します'));
      }
      return false;
    }).catch(() => false);
  }

  static codeToOfferListingUrl(code: string) {
    return `https://www.amazon.co.jp/gp/offer-listing/${code}`;
  }

  static codeToProductUrl(code: string) {
    return `https://www.amazon.co.jp/dp/${code}`;
  }
}
