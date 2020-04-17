const fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  { Cluster } = require('puppeteer-cluster'),
  { REIT_FOR_SCRAPING } = require("../utils/reitException")


const mapImportantEntries = (entries) => {
  const { company, management, trustStructure, videos, portfolios } = entries,
    recordSet = [{ name: "company", data: company }, { name: "management", data: management }, { name: "trustStructure", data: trustStructure }, { name: "videos", data: videos }, { name: "portfolios", data: portfolios }];
  let mappedResult = {};
  recordSet.forEach((entry) => {
    switch (entry.name) {
      case "company":
        const { logo, images, companyInformation, location } = entry.data;
        mappedResult = Object.assign({}, mappedResult, { company: [logo, ...images, companyInformation, location.map] })
        break;
      case "management":
        const managerImages = entry.data.map((each) => {
          return each.image;
        })
        mappedResult = Object.assign({}, mappedResult, { management: [...managerImages] });
        break;
      case "trustStructure":
        if (!entry.data) {
          return mappedResult;
        }
        mappedResult = Object.assign({}, mappedResult, { trustStructure: [entry.data.image] });
        break;
      case "videos":
        if (!entry.data) {
          return mappedResult;
        }
        let videoArrList = [];
        entry.data.forEach((video) => {
          videoArrList = [...videoArrList, video.thumbnail, video.link]
        });
        mappedResult = Object.assign({}, mappedResult, { videos: videoArrList });
        break;
      case "portfolios":
        let portfolioImageList = [];
        entry.data.map((each) => {
          portfolioImageList = [...portfolioImageList, each.images, each.link]
        })
        mappedResult = Object.assign({}, mappedResult, { portfolios: portfolioImageList });
        break;
      default:
        return null;
    }
  })
  return mappedResult;
}


const checkLinks = async (mapData) => {
  const resultLinks = [];
  const cluster = await Cluster.launch({
    concurrency: Cluster.CONCURRENCY_CONTEXT,
    maxConcurrency: 5,
    skipDuplicateUrls: true,
    puppeteerOptions: {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
      ]
    }
  });

  await cluster.task(async ({ page, data: { url, section } }) => {
    //CHECKING PER-LINK REMEMBER!
    const baseHostName = new URL(url).hostname;
    const baseMatched = REIT_FOR_SCRAPING.filter((link) => link.urlBase === baseHostName);
    const result = await page.goto(url);

    if (baseMatched.length > 0) {
      // const text = await page.evaluate(() => document.querySelector('.c-section-content__hdr').textContent);
      // console.log(text)

      const selector = baseMatched[0].scrapeElem;
      const text = await page.evaluate((selector) => {
        return document.querySelector(selector).textContent;
      }, selector)

      if (text === baseMatched[0].scrapeText) {
        resultLinks.push({ link: url, section, status: 404 });
      } else {
        resultLinks.push({ link: url, section, status: result.status() });
      }
    } else {
      resultLinks.push({ link: url, section, status: result.status() });
    }
  });

  for (let section in mapData) {
    for (let x = 0; x < mapData[section].length; x++) {
      cluster.queue({ url: mapData[section][x], section });
    }
  }
  await cluster.idle();
  await cluster.close();
  return resultLinks;
}


const postRequest = (req, res) => {
  const { data } = req.body;
  if (data) {
    // write files on local directory first
    const location = path.join(__dirname, "../files/data.yml");
    const ws = fs.createWriteStream(location, "utf8");
    ws.write(data);
    // convert data to json and check links health
    fs.readFile(location, "utf8", (err, data) => {
      try {
        const jsonRecord = yaml.safeLoad(data, "utf8");
        const mapData = mapImportantEntries(jsonRecord);
        //perform lookup on mapped links
        checkLinks(mapData).then((clusterResult) => {
          res.status(200).send(clusterResult);
        }).catch(err => console.log(err))

      } catch (error) {
        res.status(409).send({ error: true, details: error })
      }
    })

  } else {
    res.status(400).send('something went wrong...')
  }

}
exports.postRequest = postRequest;
