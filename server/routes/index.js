const mainRouter = require('express').Router(),
  { postRequest } = require('../controllers/index')

mainRouter.route("/")
  .get((req, res) => {
    res.render('pages/home')
  })
  .post(postRequest);

module.exports = mainRouter;