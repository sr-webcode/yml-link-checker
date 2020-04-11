const mainRoute = require('../routes/index')
const routeManager = (app) => {
  app.get("/", (req, res) => {
    res.redirect('/home')
  })
  app.use('/home', mainRoute);
  app.get('*', function (req, res) {
    res.status(404).send('page is not found, are you drunk?');
  });
}


exports.serve = routeManager;