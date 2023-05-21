import { CheerioAPI, load } from 'cheerio';
import dayjs from 'dayjs';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import puppeteer from 'puppeteer';
import { client } from '../../app.js';
import { trimNewLines, wait } from '../../helpers/common.js';
import { getTldFromUrl } from '../../helpers/productUrlHelper.js';
import { ProductParserInterface } from '../../interfaces/ProductParserInterface.js';

const getParsedProductData = ($: CheerioAPI): ProductParserInterface | undefined => {
  try {
    // const htmlLang = $('html').attr('lang');
    const locale = $('.nav-logo-locale').text();
    const title = trimNewLines($('#title #productTitle').text());
    const asin = $('#ASIN') ? '' + $('#ASIN').val() : '';
    const image = $('#imgTagWrapperId #landingImage').attr('src') || $('#imgBlkFront').attr('src');
    const primeOnly = $('#tryPrimeButton_').length > 0;
    const abroad = $('#globalStoreBadgePopoverInsideBuybox_feature_div').text()?.length > 0;
    const shippingFee = $('#mir-layout-DELIVERY_BLOCK-slot-DELIVERY_MESSAGE a').text();

    let priceText = ($('#booksHeaderSection #price').text() || $('#price_inside_buybox').text() || $('#corePrice_feature_div .a-offscreen').text() || $('#corePrice_desktop span[data-a-color=\'price\'] .a-offscreen').first().text()).replace(/[^0-9,.]/g, '');
    if (['.com.tr', '.es', '.fr', '.it', '.de'].includes(locale)) {
      priceText = priceText.replace(/\./g, '').replace(',', '.');
    }
    const price = priceText.length > 0 ? +parseFloat(priceText).toFixed(2) : undefined;

    const stockText = $('#availability_feature_div > #availability').text() || $('form#addToCart #availability').text();
    const stock = (stockText?.replace(/[^0-9]/g, '')) ? Number(stockText.replace(/[^0-9]/g, '')) : undefined;
    const sellerText = $('#merchant-info span') ?? $('div[tabular-attribute-name="Venditore"] span') ?? $('div[tabular-attribute-name="Sold by"] span') ??
      $('div[tabular-attribute-name="Vendu par"] span') ?? $('div[tabular-attribute-name="Vendido por"] span');
    const seller = trimNewLines(sellerText.first().text() || sellerText.text());

    const product: ProductParserInterface = {
      title,
      asin,
      image,
      locale: locale === '.us' ? '.com' : locale,
      primeOnly,
      abroad,
      shippingFee,

      price,

      stockText,
      stock,
      seller
    };

    return product;
  } catch (error) {
    console.error('getParsedProductData error', error);

    return undefined;
  }
};

const cookieHandler = async (page: puppeteer.Page) => {
  const cookiesElement = await page.$('#sp-cc-accept');

  if (!cookiesElement) {
    return;
  }

  // Accept cookies!
  await page.click('#sp-cc-accept');
}

const captchaHandler = async (page: puppeteer.Page, url: string, cookieFileName: string) => {
  await cookieHandler(page);

  const captchaElement = await page.$('#captchacharacters');

  if (!captchaElement) {
    return;
  }

  try {
    const $ = load((await page.content()).replace(/\n\s*\n/gm, ''));
    // captcha resim url'ini getir
    const captchaImg = $('form img').attr('src') ?? '';
    // bu ürün url'i için server'dan gelmiş captcha metnini getir
    let captchaText = client.captcha.get(url);

    // eğer captcha metni yoksa server'a resmi gönder
    if (!captchaText) {
      client.socket.send(JSON.stringify({
        type: 'captcha',
        value: captchaImg,
        data: url
      }));

      // server'dan captcha metni gelene kadar bekle
      while (!client.captcha.has(url)) {
        await wait(1000);
      }

      // server'dan gelen captcha metnini tanımla
      captchaText = client.captcha.get(url);
    }

    // captcha metni gir
    await page.type('#captchacharacters', captchaText + '');

    // server'dan gelmiş captcha metnini temizle
    client.captcha.delete(url);

    // sayfa yönlendirme beklemesi
    // ve captcha formu gönderimi için promise oluşturup bekle
    await Promise.all([page.waitForNavigation(), page.click('button[type="submit"]')]);

    // güncel cookie'leri sonradan kullanım için kaydet
    const cookieJson = JSON.stringify(await page.cookies());
    writeFileSync(cookieFileName, cookieJson);

    await captchaHandler(page, url, cookieFileName);
  } catch (error) {
    console.error('captchaHandler', error);
  }
}

const productParser = async (url: string): Promise<ProductParserInterface | undefined> => {
  const browser = await puppeteer.launch({
    headless: true
  });
  const page = await browser.newPage();

  await page.setUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/78.0.3904.108 Safari/537.36 NodeAmazonTracker/1.0.0');
  await page.setViewport({ width: 1280, height: 720 });

  try {
    const tld = getTldFromUrl(url);
    const cookieFileName = `cookies${tld}.json`;
    try {
      if (existsSync(cookieFileName)) {
        const cookies = readFileSync(cookieFileName, 'utf8');

        if (cookies) {
          await page.setCookie(...JSON.parse(cookies));
        }
      }
    } catch (error) {
      console.error('cookie parse error', error);
    }

    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (['stylesheet', 'font', 'image'].includes(req.resourceType())) {
        req.abort();
        return;
      }

      req.continue();
    });

    // Navigate to product url
    await page.goto(url, {
      timeout: 60_000
    });

    await captchaHandler(page, url, cookieFileName);

    // Load the content into cheerio for easier parsing
    const $ = load((await page.content()).replace(/\n\s*\n/gm, ''));

    const product = getParsedProductData($);

    if (product?.asin.includes('undefined')) {
      if (!existsSync('products')) {
        mkdirSync('products');
      }

      await page.screenshot({
        path: `products/${dayjs().unix()}.png`
      });

      writeFileSync(`products/${dayjs().unix()}.html`, await page.content());
      console.error('ASIN BULUNAMADI??', {
        product,
        url
      });

      return;
    }

    return product;
  } catch (error) {
    console.error('productParser error', error);

    return undefined;
  } finally {
    browser.close();
  }
};

export default productParser;
