import puppeteer from 'puppeteer-core';
import {AmazonTracker} from "./amazon-tracker";

const tracker = new AmazonTracker();
tracker.start();
