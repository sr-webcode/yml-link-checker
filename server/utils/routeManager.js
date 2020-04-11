const mainRoute = require('../routes/index')
const routeManager = (app) => {
  app.use('/', mainRoute);
  app.get('*', function (req, res) {
    res.status(404).send('page is not found, are you drunk?');
  });
}


exports.serve = routeManager;