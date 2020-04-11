const fs = require('fs'),
  path = require('path'),
  yaml = require('js-yaml'),
  http = require('http'),
  url = require('url');


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


const checkLinksHealth = (mapData) => {
  let linksResult = [];
  return new Promise((resolve, reject) => {

    const performHttpRequest = (link, section) => {

      return new Promise((resolve, reject) => {
        const options = {
          method: "HEAD",
          host: url.parse(link).hostname,
          port: 80,
          path: url.parse(link).pathname,
        }
        const request = http.request(options, (re) => {
          resolve({ section, link, status: re.statusCode });
        })
        request.on('error', (err) => {
          reject(err)
        })
        request.end();
      })
    }

    for (let section in mapData) {
      mapData[section].forEach((link) => {
        if (link) {
          performHttpRequest(link, section).then((res) => {
            linksResult.push(res)
          })
        }
      })
    }

    resolve(linksResult)

  })
}


const postRequest = (req, res) => {
  const { data } = req.body;
  if (data) {
    // write files on local directory first
    const location = path.join(__dirname, "../files/data.yml");
    const ws = fs.createWriteStream(location, "utf8");
    ws.write(data);
    // convert data to json and check links health
    try {
      fs.readFile(location, "utf8", (err, data) => {
        const jsonRecord = yaml.safeLoad(data, "utf8");
        const mapData = mapImportantEntries(jsonRecord);
        checkLinksHealth(mapData).then((results) => {
          setTimeout(() => {
            res.status(200).json(results)
          }, 2000);
        }).catch((err) => {
          res.status(400).json(err)
        })

      })
    } catch (error) {
      console.log(error);
    }
  } else {
    res.status(400).send('something went wrong...')
  }

}

exports.postRequest = postRequest;

