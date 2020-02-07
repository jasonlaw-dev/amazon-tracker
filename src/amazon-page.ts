import { Page } from 'puppeteer-core';
import { AmazonPageType } from './amazon-page-type';
import { AmazonProduct } from './amazon-product';

export class AmazonPage {

  currentPageType = AmazonPageType.Offer_Listing;

  constructor(public product: AmazonProduct, public page: Page) {
    page.setDefaultTimeout(1000 * 30);
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
    return this.hasInventory();
  }


  private async hasInventory(): Promise<boolean> {
    const url = this.currentPageType === AmazonPageType.Offer_Listing ? this.offerListingUrl : this.productUrl;
    const navigationFinished = this.page.waitForNavigation({ waitUntil: 'networkidle2' });
    await this.page.goto(url, { waitUntil: 'networkidle2' });

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
