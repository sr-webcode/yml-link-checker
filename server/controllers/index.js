const fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  { Cluster } = require('puppeteer-cluster'),
  { REIT_FOR_SCRAPING } = require("../utils/reitException"),
  { http, https } = require('follow-redirects');


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
  return { name: company.name, linkMaps: mappedResult }
}

const getValidUrls = (dataSet) => {
  return dataSet.filter((link) => {
    if (link) { //not null
      const hasProtocol = (link.indexOf('https:') > -1 || link.indexOf('https:') > -1);
      if (hasProtocol) return link;
    }
  })
}


const promisifyLinkRequest = (link, section) => {
  const protocol = new URL(link).protocol;
  return new Promise((resolve, reject) => {
    switch (protocol) {
      case 'http:':
        http.get(link, (res) => {
          resolve({ link, section, status: res.statusCode });
        })
        break;
      case 'https:':
        https.get(link, (res) => {
          resolve({ link, section, status: res.statusCode });
        })
        break;
      default:
        reject('something went wrong')
        break;
    }
  })
}


const checkLinks = async ({ name, linkMaps }) => {
  let finalResult;
  let promiseLinks = [];
  const isForScraping = REIT_FOR_SCRAPING.filter(reit => reit.name === name).length > 0;
  if (!isForScraping) {
    //url follow redirect
    for (let section in linkMaps) {
      const validLinks = getValidUrls(linkMaps[section]);
      if (validLinks.length > 0) {
        for (let y = 0; y < validLinks.length; y++) {
          promiseLinks.push(promisifyLinkRequest(validLinks[y], section))
        }
      }
    }
    finalResult = promiseLinks;
  } else {

    let clusterResult = [];
    ///scraping method
    const cluster = await Cluster.launch({
      concurrency: Cluster.CONCURRENCY_CONTEXT,
      maxConcurrency: 5,
      skipDuplicateUrls: false,
      puppeteerOptions: {
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
        ]
      }
    });

    await cluster.task(async ({ page, data: { url, section } }) => {
      const baseHostName = new URL(url).hostname;
      const baseMatched = REIT_FOR_SCRAPING.filter((each) => each.urlBases.indexOf(baseHostName) > -1);
      const result = await page.goto(url);

      if (baseMatched.length > 0) {
        const selector = baseMatched[0].scrapeElem;
        clusterResult.push({ link: url, section, status: result.status() });
        const text = await page.evaluate((selector) => {
          return document.querySelector(selector).textContent;
        }, selector);

        if (text && text === baseMatched[0].scrapeText) {
          // clusterResult.push({ link: url, section, status: 404 });
          //overwriting those 404 links already inside...
          clusterResult = clusterResult.map((each) => {
            if (each.link === url) {
              return { link: url, section, status: 404 }
            }
            return each;
          })
        }
      } else {
        clusterResult.push({ link: url, section, status: result.status() });
      }
    });

    for (let section in linkMaps) {
      for (let x = 0; x < linkMaps[section].length; x++) {
        cluster.queue({ url: linkMaps[section][x], section });
      }
    }
    await cluster.idle();
    await cluster.close();
    finalResult = clusterResult;
  }
  // return resultLinks;
  return finalResult;
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
        checkLinks(mapData).then((checkResults) => {
          if (checkResults[0] instanceof Promise) {
            //this was result of follow-redirects
            Promise.all(checkResults).then((data) => {
              const results = [...data];
              res.status(200).json(results);
            }).catch(err => console.log(err))
          } else {
            //this was using puppeteer cluster
            res.status(200).json(checkResults);
          }
        }).catch(err => console.log(err))
      } catch (error) {
        console.log(error);
        res.status(409).send({ error: true, details: error })
      }
    })

  } else {
    res.status(400).send('something went wrong...')
  }

}
exports.postRequest = postRequest;
