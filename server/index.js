const express = require('express'),
  app = express(),
  port = process.env.PORT || 8080,
  routeManager = require('./utils/routeManager'),
  path = require('path'),
  expBars = require('express-handlebars'),
  cors = require('cors');

app.use(cors());
app.use(express.static(path.join(__dirname, "./public")));
app.use(express.json());
app.use(express.urlencoded({
  extended: false
}));

app.engine(
  "hbs",
  expBars({
    defaultLayout: "main",
    extname: ".hbs",
  })
);

app.set("view engine", "hbs");
app.set("views", path.join(__dirname, "./views"));
routeManager.serve(app);

app.listen(port);